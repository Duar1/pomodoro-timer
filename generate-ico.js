// Generate ICO file from PNG
const fs = require('fs');
const path = require('path');

const pngData = fs.readFileSync(path.join(__dirname, 'assets', 'icon.png'));

// ICO Header (6 bytes)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);   // Reserved
header.writeUInt16LE(1, 2);   // Type: ICO
header.writeUInt16LE(1, 4);   // Count: 1

// ICO Dir Entry (16 bytes) for PNG-in-ICO
const entry = Buffer.alloc(16);
entry[0] = 128;               // Width (0 for 256)
entry[1] = 128;               // Height (0 for 256)
entry[2] = 0;                 // Colors
entry[3] = 0;                 // Reserved
entry.writeUInt16LE(1, 4);    // Planes
entry.writeUInt16LE(32, 6);   // BPP
entry.writeUInt32LE(pngData.length, 8);  // Size
entry.writeUInt32LE(22, 12);  // Offset (6 + 16 = 22)

const ico = Buffer.concat([header, entry, pngData]);
fs.writeFileSync(path.join(__dirname, 'assets', 'icon.ico'), ico);
console.log('ICO created: assets/icon.ico');
