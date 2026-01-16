/**
 * Python Runner
 *
 * Executes Python code using a temp file and returns stdout/stderr.
 * Avoids shell execution to reduce attack surface.
 */

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const DEFAULT_TIMEOUT_MS = Number(process.env.PYTHON_RUNNER_TIMEOUT_MS) || 10_000;
const DEFAULT_MAX_OUTPUT_BYTES = Number(process.env.PYTHON_RUNNER_MAX_OUTPUT_BYTES) || 512_000;
const DEFAULT_MAX_CODE_BYTES = Number(process.env.PYTHON_RUNNER_MAX_CODE_BYTES) || 200_000;

function ensureAbsoluteDir(value) {
  return path.resolve(String(value || process.cwd()));
}

function createCollector(limitBytes) {
  let total = 0;
  let truncated = false;
  let content = '';

  const append = (chunk) => {
    if (truncated) return;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    const remaining = limitBytes - total;
    if (remaining <= 0) {
      truncated = true;
      return;
    }

    if (buffer.length > remaining) {
      content += buffer.subarray(0, remaining).toString('utf-8');
      total += remaining;
      truncated = true;
      return;
    }

    content += buffer.toString('utf-8');
    total += buffer.length;
  };

  return {
    append,
    get content() {
      return content;
    },
    get truncated() {
      return truncated;
    },
  };
}

export async function runPython({ code, cwd, timeoutMs, maxOutputBytes, maxCodeBytes } = {}) {
  const resolvedCwd = ensureAbsoluteDir(cwd);
  const outputLimit = Number(maxOutputBytes) || DEFAULT_MAX_OUTPUT_BYTES;
  const codeLimit = Number(maxCodeBytes) || DEFAULT_MAX_CODE_BYTES;

  if (typeof code !== 'string' || !code.trim()) {
    throw new Error('Python code is required.');
  }

  const codeBytes = Buffer.byteLength(code, 'utf-8');
  if (codeBytes > codeLimit) {
    throw new Error(`Python code exceeds size limit (${codeBytes} > ${codeLimit}).`);
  }

  const workDir = path.join(resolvedCwd, '__python__');
  await fs.mkdir(workDir, { recursive: true });

  const filename = `run_${Date.now()}_${randomBytes(4).toString('hex')}.py`;
  const filePath = path.join(workDir, filename);

  await fs.writeFile(filePath, code, 'utf-8');

  const stdoutCollector = createCollector(outputLimit);
  const stderrCollector = createCollector(outputLimit);

  let timedOut = false;
  let killedByLimit = false;

  const startedAt = Date.now();
  const timeout = Number(timeoutMs) || DEFAULT_TIMEOUT_MS;

  return await new Promise((resolve) => {
    const child = spawn('python3', ['-u', filePath], {
      cwd: resolvedCwd,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONDONTWRITEBYTECODE: '1',
        MPLBACKEND: process.env.MPLBACKEND || 'Agg',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);

    const maybeKillForLimit = () => {
      if (stdoutCollector.truncated || stderrCollector.truncated) {
        if (!killedByLimit) {
          killedByLimit = true;
          child.kill('SIGKILL');
        }
      }
    };

    child.stdout?.on('data', (chunk) => {
      stdoutCollector.append(chunk);
      maybeKillForLimit();
    });

    child.stderr?.on('data', (chunk) => {
      stderrCollector.append(chunk);
      maybeKillForLimit();
    });

    child.on('error', async (error) => {
      clearTimeout(timer);
      await fs.unlink(filePath).catch(() => {});
      resolve({
        stdout: stdoutCollector.content,
        stderr: `${stderrCollector.content}${stderrCollector.content ? '\n' : ''}${error.message}`,
        exitCode: 127,
        signal: null,
        durationMs: Date.now() - startedAt,
        timedOut: false,
        truncated: stdoutCollector.truncated || stderrCollector.truncated,
        killedByLimit,
      });
    });

    child.on('close', async (code, signal) => {
      clearTimeout(timer);
      await fs.unlink(filePath).catch(() => {});
      resolve({
        stdout: stdoutCollector.content,
        stderr: stderrCollector.content,
        exitCode: code,
        signal,
        durationMs: Date.now() - startedAt,
        timedOut,
        truncated: stdoutCollector.truncated || stderrCollector.truncated,
        killedByLimit,
      });
    });
  });
}
