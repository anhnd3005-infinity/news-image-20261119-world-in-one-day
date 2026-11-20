import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IEND = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const MAX_BYTES = 1048576;
const MAX_DIM = 1024;

interface ImageMeta {
  format: 'png' | 'jpeg';
  width: number;
  height: number;
}

function parsePngMeta(data: Buffer): ImageMeta {
  if (data.length < 45) {
    throw new Error(`Invalid PNG byte length: ${data.length}`);
  }
  if (!data.subarray(data.length - 12).equals(PNG_IEND)) {
    throw new Error('PNG trailer is missing the final IEND chunk');
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
  return { format: 'png', width, height };
}

function parseJpegMeta(data: Buffer): ImageMeta {
  if (data.length < 24 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) {
    throw new Error('Asset header is not a valid JPEG SOI signature');
  }
  if (data[data.length - 2] !== 0xff || data[data.length - 1] !== 0xd9) {
    throw new Error('JPEG trailer is missing the final EOI marker');
  }

  let offset = 2;
  while (offset + 3 < data.length) {
    while (offset < data.length && data[offset] === 0xff) {
      offset++;
    }
    if (offset >= data.length) break;
    const marker = data[offset++];
    if (marker === 0xd9 || marker === 0xda) break; // EOI or SOS (entropy data follows)
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      continue;
    }
    if (offset + 2 > data.length) {
      throw new Error('Truncated JPEG segment length');
    }
    const segLen = data.readUInt16BE(offset);
    if (segLen < 2 || offset + segLen > data.length) {
      throw new Error(`Invalid JPEG segment length: ${segLen}`);
    }
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSof && segLen >= 7) {
      const height = data.readUInt16BE(offset + 3);
      const width = data.readUInt16BE(offset + 5);
      if (width === 0 || height === 0 || width > MAX_DIM || height > MAX_DIM) {
        throw new Error(`Invalid JPEG dimensions: ${width}x${height}`);
      }
      return { format: 'jpeg', width, height };
    }
    offset += segLen;
  }
  throw new Error('JPEG SOF frame dimensions not found');
}

function assertValidImage(data: Buffer): ImageMeta {
  if (data.length > MAX_BYTES) {
    throw new Error(`Asset exceeds 1 MiB limit: ${data.length} bytes`);
  }
  if (data.length >= 8 && data.subarray(0, 8).equals(PNG_MAGIC)) {
    return parsePngMeta(data);
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return parseJpegMeta(data);
  }
  throw new Error('Asset header is neither PNG nor JPEG');
}

function main(): void {
  const rootDir = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(rootDir, 'entry.png');
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const outPath = join(outDir, 'entry.png');

  const bytes = readFileSync(sourcePath);
  const { format, width, height } = assertValidImage(bytes);
  const expectedHash = createHash('sha256').update(bytes).digest('hex');

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, bytes);

  const writtenHash = createHash('sha256').update(readFileSync(outPath)).digest('hex');
  if (writtenHash !== expectedHash) {
    throw new Error(`Output hash mismatch (${format} ${width}x${height})`);
  }
}

main();
