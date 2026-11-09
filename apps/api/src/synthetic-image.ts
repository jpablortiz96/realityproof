import zlib from "node:zlib";
import crypto from "node:crypto";

// Minimal 5x7 bitmap font for uppercase letters, digits, and hyphen
const FONT_5X7: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b10010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110],
  "6": [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  "-": [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
  ":": [0b00000, 0b00100, 0b00100, 0b00000, 0b00100, 0b00100, 0b00000],
  " ": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
};

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

export function generateSyntheticLabelPng(params: {
  lines: string[];
  width?: number;
  height?: number;
  scale?: number;
  uniqueSeed?: string;
}): Buffer {
  const width = params.width ?? 680;
  const height = params.height ?? 260;
  const scale = params.scale ?? 4;

  // Each scanline has 1 filter byte (0) + width * 3 RGB bytes
  const stride = 1 + width * 3;
  const raw = Buffer.alloc(stride * height, 0);

  // Fill background with light industrial label gray (245, 247, 250) and dark border
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const idx = y * stride + 1 + x * 3;
      const isBorder =
        x < 8 || x >= width - 8 || y < 8 || y >= height - 8;
      if (isBorder) {
        raw[idx] = 20;
        raw[idx + 1] = 30;
        raw[idx + 2] = 50;
      } else {
        raw[idx] = 245;
        raw[idx + 1] = 247;
        raw[idx + 2] = 250;
      }
    }
  }

  const drawText = (
    text: string,
    startX: number,
    startY: number,
    charScale: number,
    color: [number, number, number]
  ) => {
    const upper = text.toUpperCase();
    let cursorX = startX;
    for (let i = 0; i < upper.length; i++) {
      const ch = upper[i]!;
      const glyph = FONT_5X7[ch] ?? FONT_5X7[" "]!;
      for (let gy = 0; gy < 7; gy++) {
        const rowBits = glyph[gy]!;
        for (let gx = 0; gx < 5; gx++) {
          if ((rowBits >> (4 - gx)) & 1) {
            for (let sy = 0; sy < charScale; sy++) {
              for (let sx = 0; sx < charScale; sx++) {
                const px = cursorX + gx * charScale + sx;
                const py = startY + gy * charScale + sy;
                if (px >= 0 && px < width && py >= 0 && py < height) {
                  const idx = py * stride + 1 + px * 3;
                  raw[idx] = color[0];
                  raw[idx + 1] = color[1];
                  raw[idx + 2] = color[2];
                }
              }
            }
          }
        }
      }
      cursorX += 6 * charScale;
    }
  };

  let currentY = 26;
  for (let i = 0; i < params.lines.length; i++) {
    const line = params.lines[i]!;
    const lineScale = i === 1 ? scale + 1 : scale - 1;
    const color: [number, number, number] =
      i === 1 ? [10, 20, 40] : [50, 65, 90];
    drawText(line, 28, currentY, lineScale, color);
    currentY += 7 * lineScale + 18;
  }

  // Draw synthetic barcode bars at the bottom
  const barYStart = height - 68;
  const barYEnd = height - 22;
  const seedHash = crypto
    .createHash("sha256")
    .update(params.uniqueSeed ?? params.lines.join("|"))
    .digest();
  for (let x = 28; x < width - 28; x += 4) {
    const bit = (seedHash[(x >> 2) % seedHash.length]! >> (x % 8)) & 1;
    if (bit) {
      for (let y = barYStart; y < barYEnd; y++) {
        for (let bx = 0; bx < 2; bx++) {
          const idx = y * stride + 1 + (x + bx) * 3;
          raw[idx] = 15;
          raw[idx + 1] = 20;
          raw[idx + 2] = 30;
        }
      }
    }
  }

  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth 8
  ihdr[9] = 2; // color type 2 (Truecolor RGB)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idatData = zlib.deflateSync(raw);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makePngChunk("IHDR", ihdr),
    makePngChunk("IDAT", idatData),
    makePngChunk("IEND", iend),
  ]);
}

