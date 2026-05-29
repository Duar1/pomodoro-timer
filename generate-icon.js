// Generate a cartoon tomato mascot icon (128x128 PNG)
const fs = require('fs');
const zlib = require('zlib');

const SIZE = 128;
const pixels = Buffer.alloc(SIZE * SIZE * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const idx = (Math.round(y) * SIZE + Math.round(x)) * 4;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = a;
}

function blendPixel(x, y, r, g, b, alpha) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE || alpha <= 0) return;
  const idx = (Math.round(y) * SIZE + Math.round(x)) * 4;
  const a = alpha / 255;
  pixels[idx] = Math.round(pixels[idx] * (1 - a) + r * a);
  pixels[idx + 1] = Math.round(pixels[idx + 1] * (1 - a) + g * a);
  pixels[idx + 2] = Math.round(pixels[idx + 2] * (1 - a) + b * a);
  pixels[idx + 3] = Math.min(255, pixels[idx + 3] + alpha);
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// Draw filled ellipse
function fillEllipse(cx, cy, rx, ry, r, g, b, a = 255) {
  for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
    for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++) {
      if (((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) <= 1) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }
}

// Soft radial gradient ellipse
function fillEllipseGradient(cx, cy, rx, ry, innerR, innerG, innerB, outerR, outerG, outerB) {
  for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
    for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++) {
      const t = ((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2);
      if (t <= 1) {
        const blend = Math.sqrt(t);
        setPixel(x, y,
          Math.round(innerR + (outerR - innerR) * blend),
          Math.round(innerG + (outerG - innerG) * blend),
          Math.round(innerB + (outerB - innerB) * blend),
          255
        );
      }
    }
  }
}

// ==========================================
// 1. Shadow
// ==========================================
fillEllipse(66, 72, 48, 52, 0, 0, 0, 40);

// ==========================================
// 2. Tomato body - main shape (slightly wider than tall)
// ==========================================
fillEllipseGradient(64, 68, 48, 50,
  255, 72, 54,    // inner: bright tomato red
  210, 38, 28     // outer: deeper red
);

// Highlight - top-left bright spot
fillEllipse(38, 40, 18, 14, 255, 160, 140, 120);
fillEllipse(34, 36, 10, 8, 255, 200, 180, 100);

// ==========================================
// 3. Tomato body ridges (the lobed sections of a tomato)
// ==========================================
// Subtle ridge lines
for (let y = 30; y <= 106; y++) {
  for (let x = 20; x <= 108; x++) {
    const bodyT = ((x - 64) ** 2) / (48 ** 2) + ((y - 68) ** 2) / (50 ** 2);
    if (bodyT > 1) continue;
    // Create subtle vertical ridge pattern
    const ridge = Math.sin((x - 64) * 0.12) * 0.5 + 0.5;
    if (ridge > 0.7) {
      const idx = (y * SIZE + x) * 4;
      const darken = (ridge - 0.7) * 0.15;
      pixels[idx] = Math.round(pixels[idx] * (1 - darken));
      pixels[idx + 1] = Math.round(pixels[idx + 1] * (1 - darken));
      pixels[idx + 2] = Math.round(pixels[idx + 2] * (1 - darken));
    }
  }
}

// ==========================================
// 4. Green leafy crown (stem + leaves)
// ==========================================
// Dark green stem
fillEllipse(64, 22, 4, 8, 34, 120, 40);

// Leaves - 5 small leaves radiating from top
function drawLeaf(cx, cy, angle, w, h) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let y = cy - h; y <= cy + h; y++) {
    for (let x = cx - w; x <= cx + w; x++) {
      const lx = (x - cx) * cos + (y - cy) * sin;
      const ly = -(x - cx) * sin + (y - cy) * cos;
      const lt = (lx / w) ** 2 + (ly / h) ** 2;
      if (lt <= 1) {
        const shade = 0.7 + 0.3 * (1 - Math.sqrt(lt));
        setPixel(x, y,
          Math.round(60 * shade),
          Math.round(160 * shade),
          Math.round(50 * shade),
          255
        );
      }
    }
  }
}

drawLeaf(56, 28, -0.6, 6, 12);
drawLeaf(72, 28, 0.6, 6, 12);
drawLeaf(50, 30, -1.1, 5, 10);
drawLeaf(78, 30, 1.1, 5, 10);
drawLeaf(64, 24, 0, 5, 13);

// ==========================================
// 5. Cute face
// ==========================================

// Eyes - big white circles
fillEllipse(48, 58, 13, 14, 255, 255, 255);
fillEllipse(80, 58, 13, 14, 255, 255, 255);

// Eye outline (dark)
function drawCircle(cx, cy, r, width, r, g, b) {
  for (let y = Math.ceil(cy - r - width); y <= Math.floor(cy + r + width); y++) {
    for (let x = Math.ceil(cx - r - width); x <= Math.floor(cx + r + width); x++) {
      const d = dist(x, y, cx, cy);
      if (d > r && d <= r + width) {
        setPixel(x, y, r, g, b, 255);
      }
    }
  }
}
drawCircle(48, 58, 13.5, 1.5, 40, 22, 16);
drawCircle(80, 58, 13.5, 1.5, 40, 22, 16);

// Iris - big dark circles
fillEllipse(50, 57, 7, 8, 40, 22, 16);
fillEllipse(82, 57, 7, 8, 40, 22, 16);

// Pupils - tiny black
fillEllipse(51, 56, 3.5, 4, 15, 8, 6);
fillEllipse(83, 56, 3.5, 4, 15, 8, 6);

// Eye shine - white dots
fillEllipse(47, 52, 4, 3.5, 255, 255, 255, 230);
fillEllipse(79, 52, 4, 3.5, 255, 255, 255, 230);
// Small secondary shine
fillEllipse(53, 59, 2, 1.8, 255, 255, 255, 150);
fillEllipse(85, 59, 2, 1.8, 255, 255, 255, 150);

// Blush cheeks
fillEllipse(34, 70, 9, 6, 255, 140, 130, 120);
fillEllipse(94, 70, 9, 6, 255, 140, 130, 120);

// Mouth - cute smile arc
for (let y = 72; y <= 82; y++) {
  for (let x = 56; x <= 72; x++) {
    const mouthY = 76 + 4 * Math.sin((x - 64) * 0.2);
    const d = Math.abs(y - mouthY);
    if (d <= 2.5 && ((x - 64) ** 2) / (10 ** 2) + ((y - 76) ** 2) / (5 ** 2) <= 1.2) {
      setPixel(x, y, 120, 30, 20, 255);
    }
  }
}
// Mouth interior pink
for (let y = 76; y <= 80; y++) {
  for (let x = 60; x <= 68; x++) {
    const mouthY = 77.5 + 3.5 * Math.sin((x - 64) * 0.2);
    const d = Math.abs(y - mouthY);
    if (d <= 1.5 && ((x - 64) ** 2) / (6 ** 2) + ((y - 77.5) ** 2) / (2.5 ** 2) <= 1) {
      setPixel(x, y, 200, 80, 70, 255);
    }
  }
}

// ==========================================
// 6. Anti-alias edge: smooth body boundary
// ==========================================
for (let y = 15; y < 115; y++) {
  for (let x = 12; x < 116; x++) {
    const bodyT = ((x - 64) ** 2) / (48 ** 2) + ((y - 68) ** 2) / (50 ** 2);
    if (bodyT > 1 && bodyT < 1.05) {
      const alpha = Math.round((1.05 - bodyT) / 0.05 * 255);
      const idx = (y * SIZE + x) * 4;
      if (pixels[idx + 3] < alpha) {
        const blend = bodyT - 1;
        setPixel(x, y, 220, 42, 30, alpha * 0.7);
      }
    }
  }
}

// ==========================================
// Encode PNG
// ==========================================
const filtered = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  filtered[y * (1 + SIZE * 4)] = 0;
  pixels.copy(filtered, y * (1 + SIZE * 4) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const compressed = zlib.deflateSync(filtered);

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeData = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcData = Buffer.concat([Buffer.from(type), data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeData, crcVal]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync('assets/icon.png', png);
console.log('Cartoon tomato icon generated: assets/icon.png');
