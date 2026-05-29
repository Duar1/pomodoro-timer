// Resize 番茄娃娃.png (2048x2048 RGB) to 128x128 RGBA icon
const fs = require('fs');
const zlib = require('zlib');

function parsePNG(filePath) {
  const buf = fs.readFileSync(filePath);
  let offset = 8; // skip signature
  const chunks = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString();
    const data = buf.slice(offset + 8, offset + 8 + len);
    chunks.push({ type, data });
    offset += 12 + len;
  }
  return chunks;
}

function decodePNG(chunks) {
  // Get IHDR
  const ihdr = chunks.find(c => c.type === 'IHDR').data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const bytesPerPixel = colorType === 2 ? 3 : 4; // RGB or RGBA

  // Collect all IDAT data
  const idatData = Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data));
  const raw = zlib.inflateSync(idatData);

  // Decode filtered scanlines
  const rowSize = 1 + width * bytesPerPixel; // filter byte + pixel data
  const pixels = Buffer.alloc(width * height * 4); // always output RGBA

  let prevRow = Buffer.alloc(width * bytesPerPixel);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    const filter = raw[rowStart];
    const filtered = raw.slice(rowStart + 1, rowStart + rowSize);

    const row = Buffer.alloc(width * bytesPerPixel);

    for (let x = 0; x < width; x++) {
      for (let b = 0; b < bytesPerPixel; b++) {
        const idx = x * bytesPerPixel + b;
        let val = filtered[idx];

        const left = x > 0 ? row[(x - 1) * bytesPerPixel + b] : 0;
        const up = y > 0 ? prevRow[idx] : 0;
        const upLeft = (x > 0 && y > 0) ? prevRow[(x - 1) * bytesPerPixel + b] : 0;

        switch (filter) {
          case 0: break;
          case 1: val += left; break;
          case 2: val += up; break;
          case 3: val += Math.floor((left + up) / 2); break;
          case 4:
            const p = left + up - upLeft;
            const pL = Math.abs(p - left);
            const pU = Math.abs(p - up);
            const pUL = Math.abs(p - upLeft);
            val += (pL <= pU && pL <= pUL) ? left : (pU <= pUL) ? up : upLeft;
            break;
        }
        row[idx] = val & 0xFF;
      }
    }

    // Copy to RGBA output
    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 4;
      const inIdx = x * bytesPerPixel;
      if (colorType === 2) {
        // RGB -> RGBA
        row.copy(pixels, outIdx, inIdx, inIdx + 3);
        pixels[outIdx + 3] = 255; // full opacity
      } else {
        row.copy(pixels, outIdx, inIdx, inIdx + 4);
      }
    }

    prevRow = row;
  }

  return { width, height, pixels };
}

// Box-filter resize
function resize(pixels, srcW, srcH, dstW, dstH) {
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;
  const out = Buffer.alloc(dstW * dstH * 4);

  for (let dy = 0; dy < dstH; dy++) {
    const syStart = Math.floor(dy * scaleY);
    const syEnd = Math.min(srcH, Math.ceil((dy + 1) * scaleY));

    for (let dx = 0; dx < dstW; dx++) {
      const sxStart = Math.floor(dx * scaleX);
      const sxEnd = Math.min(srcW, Math.ceil((dx + 1) * scaleX));

      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let sy = syStart; sy < syEnd; sy++) {
        for (let sx = sxStart; sx < sxEnd; sx++) {
          const idx = (sy * srcW + sx) * 4;
          r += pixels[idx];
          g += pixels[idx + 1];
          b += pixels[idx + 2];
          a += pixels[idx + 3];
          count++;
        }
      }

      const outIdx = (dy * dstW + dx) * 4;
      out[outIdx] = Math.round(r / count);
      out[outIdx + 1] = Math.round(g / count);
      out[outIdx + 2] = Math.round(b / count);
      out[outIdx + 3] = Math.round(a / count);
    }
  }

  return out;
}

// Encode and write PNG
function encodePNG(pixels, width, height, outputPath) {
  // Filter: None for all rows
  const filtered = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    filtered[y * (1 + width * 4)] = 0; // filter type: None
    pixels.copy(filtered, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
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
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(typeData), 0);
    return Buffer.concat([len, typeData, crcVal]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  fs.writeFileSync(outputPath, png);
  console.log(`Written: ${outputPath} (${width}x${height})`);
}

// Main
console.log('Reading 番茄娃娃.png...');
const chunks = parsePNG('C:/Users/Lenovo/Downloads/FIRST-CC/番茄娃娃.png');
const { width, height, pixels } = decodePNG(chunks);
console.log(`Decoded: ${width}x${height}`);

console.log('Resizing to 128x128...');
const resized = resize(pixels, width, height, 128, 128);

const iconPath = 'C:/Users/Lenovo/Downloads/FIRST-CC/assets/icon.png';
encodePNG(resized, 128, 128, iconPath);
console.log('Done!');
