// Dependency-free PNG icon generator.
// Draws a rounded violet square with a white exclamation mark ("nag/alert" motif)
// at the sizes Chrome wants, into public/icon/. Run with: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT_DIR = resolve(HERE, '..', 'public', 'icon');
const SIZES = [16, 32, 48, 128];

// --- CRC32 (for PNG chunks) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

function makePng(size) {
  const top = [139, 92, 246]; // #8B5CF6 violet-400
  const bot = [109, 40, 217]; // #6D28D9 violet-700
  const r = 0.2; // corner radius (normalized)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // PNG filter: none
    const ny = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const nx = x / (size - 1);
      let R = lerp(top[0], bot[0], ny);
      let G = lerp(top[1], bot[1], ny);
      let B = lerp(top[2], bot[2], ny);
      // white exclamation mark
      const inBar = nx > 0.44 && nx < 0.56 && ny > 0.22 && ny < 0.6;
      const dx = nx - 0.5;
      const dy = ny - 0.73;
      const inDot = dx * dx + dy * dy < 0.07 * 0.07;
      if (inBar || inDot) {
        R = 255;
        G = 255;
        B = 255;
      }
      // rounded corners -> transparent outside the radius
      const cx = nx < r ? r : nx > 1 - r ? 1 - r : nx;
      const cy = ny < r ? r : ny > 1 - r ? 1 - r : ny;
      const ex = nx - cx;
      const ey = ny - cy;
      const A = Math.sqrt(ex * ex + ey * ey) > r ? 0 : 255;
      raw[p++] = R;
      raw[p++] = G;
      raw[p++] = B;
      raw[p++] = A;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const s of SIZES) {
  writeFileSync(resolve(OUT_DIR, `${s}.png`), makePng(s));
  console.log(`wrote public/icon/${s}.png`);
}
