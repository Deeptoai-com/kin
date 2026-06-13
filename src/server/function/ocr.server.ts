/**
 * OCR converter history (OCR module O2 #2) — server functions over `ocr_jobs`.
 *
 * The converter auto-saves each conversion (file already uploaded via initDocumentUpload's
 * file-only path, then saveOcrJob records the per-page text). History is per-user, separate
 * from the KB document library. "加入知识库" (addOcrJobToKb) creates a `documents` row from a
 * job — reusing its already-stored file — and schedules RAG ingest.
 */
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '~/db/db-config';
import { ocrJobs, type OcrJobPage } from '~/db/schema/ocr-job.schema';
import { documents } from '~/db/schema/document.schema';
import { files } from '~/db/schema/file.schema';
import { auth } from '~/server/auth.server';
import { generateId } from '~/utils/id-generator';
import { scheduleRagIngest } from '~/server/rag/queue';
import { isRagEnabled } from '~/server/rag/flag';

const requireUser = async () => {
  const { headers } = getRequest();
  const session = await auth.api.getSession({ headers });
  if (!session?.user) throw new Error('UNAUTHORIZED');
  return session.user;
};

const normalize = <T>(input: unknown, schema: z.ZodType<T>): T => {
  const data = input && typeof input === 'object' && 'data' in (input as object) ? (input as { data: unknown }).data : input;
  return schema.parse(data);
};

const pageSchema = z.object({
  page: z.number().int(),
  text: z.string(),
  source: z.enum(['parse', 'ocr']),
});

const saveSchema = z.object({
  /** Existing job id → update (e.g. after per-page re-OCR); absent → insert new. */
  id: z.string().min(1).optional(),
  fileId: z.string().min(1).optional(),
  title: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  scanned: z.boolean().optional(),
  pages: z.array(pageSchema),
});

/** Upsert a conversion in history. Returns the job id (converter holds it for 加入知识库). */
export const saveOcrJob = createServerFn({ method: 'POST' })
  .inputValidator((input) => normalize(input, saveSchema))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (data.id) {
      const res = await db
        .update(ocrJobs)
        .set({ pages: data.pages as OcrJobPage[], pageCount: data.pages.length, scanned: data.scanned ?? false })
        .where(and(eq(ocrJobs.id, data.id), eq(ocrJobs.userId, user.id)))
        .returning({ id: ocrJobs.id });
      if (res[0]) return { id: res[0].id };
      // fell through (not found/owned) → insert fresh below
    }
    const id = generateId('ocrjob');
    await db.insert(ocrJobs).values({
      id,
      userId: user.id,
      fileId: data.fileId ?? null,
      title: data.title,
      fileName: data.fileName,
      mimeType: data.mimeType ?? null,
      pageCount: data.pages.length,
      scanned: data.scanned ?? false,
      pages: data.pages as OcrJobPage[],
    });
    return { id };
  });

/** Recent conversions (metadata only — page text omitted to keep the list light). */
export const listOcrJobs = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser();
  const rows = await db
    .select({
      id: ocrJobs.id,
      title: ocrJobs.title,
      fileName: ocrJobs.fileName,
      mimeType: ocrJobs.mimeType,
      pageCount: ocrJobs.pageCount,
      scanned: ocrJobs.scanned,
      createdAt: ocrJobs.createdAt,
    })
    .from(ocrJobs)
    .where(eq(ocrJobs.userId, user.id))
    .orderBy(desc(ocrJobs.createdAt))
    .limit(50);
  return rows;
});

/** Full job (per-page text + fileId) for reopening. */
export const getOcrJob = createServerFn({ method: 'GET' })
  .inputValidator((input) => normalize(input, z.object({ id: z.string().min(1) })))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const [job] = await db
      .select()
      .from(ocrJobs)
      .where(and(eq(ocrJobs.id, data.id), eq(ocrJobs.userId, user.id)))
      .limit(1);
    if (!job) throw new Error('OCR job not found');
    let fileUrl: string | null = null;
    if (job.fileId) {
      const [file] = await db.select({ url: files.url }).from(files).where(eq(files.id, job.fileId)).limit(1);
      fileUrl = file?.url ?? null;
    }
    return { ...job, fileUrl };
  });

export const deleteOcrJob = createServerFn({ method: 'POST' })
  .inputValidator((input) => normalize(input, z.object({ id: z.string().min(1) })))
  .handler(async ({ data }) => {
    const user = await requireUser();
    await db.delete(ocrJobs).where(and(eq(ocrJobs.id, data.id), eq(ocrJobs.userId, user.id)));
    return { ok: true as const };
  });

/** 加入知识库: create a documents row from the job (reusing its stored file) + schedule ingest. */
export const addOcrJobToKb = createServerFn({ method: 'POST' })
  .inputValidator((input) => normalize(input, z.object({ id: z.string().min(1) })))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!isRagEnabled()) throw new Error('RAG 未启用（RAG_ENABLED）');
    const [job] = await db
      .select()
      .from(ocrJobs)
      .where(and(eq(ocrJobs.id, data.id), eq(ocrJobs.userId, user.id)))
      .limit(1);
    if (!job) throw new Error('OCR job not found');
    if (!job.fileId) throw new Error('该转换记录没有可用的原始文件');

    const content = (job.pages as OcrJobPage[]).map((p) => p.text).filter(Boolean).join('\n\n');
    const [file] = await db.select().from(files).where(eq(files.id, job.fileId)).limit(1);
    const [doc] = await db
      .insert(documents)
      .values({
        title: job.title,
        content,
        fileType: job.mimeType ?? 'application/octet-stream',
        filename: job.fileName,
        totalCharCount: content.length,
        totalLineCount: content.split(/\r?\n/).length,
        sourceType: 'knowledge-base',
        source: file?.key ?? job.fileName,
        fileId: job.fileId,
        userId: user.id,
        parseStatus: 'ready',
        ingestStatus: 'pending',
      })
      .returning({ id: documents.id });
    const mode = await scheduleRagIngest(doc.id);
    return { documentId: doc.id, mode };
  });
