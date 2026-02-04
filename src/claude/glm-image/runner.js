/**
 * GLM-Image Runner
 *
 * Generates images using Zhipu's GLM-Image API (cogview series models).
 * Uses official REST API with ZHIPU_API_KEY from environment.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const API_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/images/generations';

const VALID_MODELS = ['glm-image'];

// Valid sizes must be:
// - Width/Height: 512-2880px, multiple of 32
// - Total pixels: < 2^22 (4,194,304)
const VALID_SIZES = [
  '1024x1024',  // 1:1 square
  '1280x1280',  // 1:1 large square
  '768x1344',   // 4:7 portrait
  '1344x768',   // 7:4 landscape (use instead of 16:9)
  '864x1152',   // 3:4 portrait
  '1152x864',   // 4:3 landscape
  '1024x1792',  // 9:16 portrait
  '1792x1024',  // 16:9 landscape (recommended for slides)
  '960x1280',   // 3:4 portrait
  '1280x960',   // 4:3 landscape
];

const DEFAULT_MODEL = 'glm-image';
const DEFAULT_SIZE = '1024x1024';
const DEFAULT_QUALITY = 'hd';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callApi(prompt, model, size, quality, watermark, apiKey) {
  const body = {
    model,
    prompt,
    size,
    quality,
    watermark_enabled: watermark,
  };

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText}\n${text}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(`API error: ${result.error.code} - ${result.error.message}`);
  }

  return result;
}

async function downloadImage(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function normalizeOutputPath(imagePath, cwd) {
  if (!imagePath) {
    const timestamp = formatTimestamp(new Date());
    return path.join(cwd, `generated-${timestamp}.png`);
  }

  // If absolute path, use as-is
  if (path.isAbsolute(imagePath)) {
    return imagePath;
  }

  // Relative path - resolve against cwd
  const full = path.resolve(cwd, imagePath);
  const ext = path.extname(full);
  if (ext) return full;
  return `${full}.png`;
}

/**
 * Generate an image using Zhipu GLM-Image API
 *
 * @param {Object} options
 * @param {string} options.prompt - Image generation prompt (required)
 * @param {string} options.imagePath - Output image path (relative to cwd)
 * @param {string} options.cwd - Working directory for relative paths
 * @param {string} options.model - Model ID (default: cogview-4)
 * @param {string} options.size - Image size (default: 1024x1024)
 * @param {string} options.quality - Quality level: hd, standard (default: hd)
 * @param {boolean} options.watermark - Enable watermark (default: false)
 * @returns {Object} Result with savedImage path and metadata
 */
export async function generateImage({
  prompt,
  imagePath,
  cwd,
  model = DEFAULT_MODEL,
  size = DEFAULT_SIZE,
  quality = DEFAULT_QUALITY,
  watermark = false,
} = {}) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    throw new Error('ZHIPU_API_KEY environment variable is required');
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Prompt is required');
  }

  // Validate model
  if (!VALID_MODELS.includes(model)) {
    throw new Error(`Invalid model: ${model}. Valid models: ${VALID_MODELS.join(', ')}`);
  }

  // Warn about size (API will reject invalid sizes)
  if (!VALID_SIZES.includes(size)) {
    console.error(`[glm-image] Warning: Size ${size} may not be supported.`);
  }

  const resolvedCwd = cwd || process.cwd();
  const outputPath = normalizeOutputPath(imagePath, resolvedCwd);

  let result;
  let retries = 1;

  while (true) {
    try {
      result = await callApi(prompt, model, size, quality, watermark, apiKey);
      break;
    } catch (e) {
      if (retries > 0) {
        retries--;
        console.error(`[glm-image] Generation failed, retrying... (${e.message})`);
        await sleep(1000);
        continue;
      }
      throw e;
    }
  }

  if (!result.data || result.data.length === 0 || !result.data[0]?.url) {
    throw new Error('No image URL returned from API');
  }

  const imageUrl = result.data[0].url;
  const savedPath = await downloadImage(imageUrl, outputPath);

  // Convert absolute path to relative for filesCreated (frontend expects relative paths)
  const relativePath = path.relative(resolvedCwd, savedPath);

  return {
    success: true,
    savedImage: relativePath,
    filesCreated: [relativePath],  // Required for frontend image preview
    model,
    size,
    quality,
    watermark,
    url: imageUrl,
    created: result.created,
  };
}
