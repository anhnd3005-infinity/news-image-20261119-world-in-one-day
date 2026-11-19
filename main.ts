import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IEND = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const MAX_BYTES = 1048576;
const MAX_DIM = 1024;

function assertValidPng(data: Buffer): { width: number; height: number } {
  if (data.length < 45 || data.length > MAX_BYTES) {
    throw new Error(`Invalid PNG byte length: ${data.length}`);
  }
  if (!data.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new Error('Asset header is not a valid PNG signature');
  }
  if (!data.subarray(data.length - 12).equals(PNG_IEND)) {
    throw new Error('Asset trailer is missing the final PNG IEND chunk');
  }
  const ihdrType = data.subarray(12, 16).toString('ascii');
  if (ihdrType !== 'IHDR') {
    throw new Error(`Expected IHDR chunk, found ${ihdrType}`);
  }
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (width === 0 || height === 0 || width > MAX_DIM || height > MAX_DIM) {
    throw new Error(`Invalid PNG dimensions: ${width}x${height}`);
  }
  return { width, height };
}

function main(): void {
  const rootDir = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(rootDir, 'entry.png');
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const outPath = join(outDir, 'entry.png');

  const bytes = readFileSync(sourcePath);
  const { width, height } = assertValidPng(bytes);
  const expectedHash = createHash('sha256').update(bytes).digest('hex');

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, bytes);

  const writtenHash = createHash('sha256').update(readFileSync(outPath)).digest('hex');
  if (writtenHash !== expectedHash) {
    throw new Error(`Output hash mismatch (${width}x${height})`);
  }
}

main();
