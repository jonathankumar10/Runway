// Generates icons/icon16.png, icon48.png, icon128.png
// Violet (#7c3aed) square — no external dependencies needed
import { deflateSync } from 'zlib'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// CRC32 for PNG chunks
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  crcTable[i] = c
}
function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crcVal])
}

function makePNG(size, [r, g, b]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // RGB
  // compression, filter, interlace = 0

  // Raw pixel rows: 1 filter byte + size*3 RGB bytes per row
  const stride = size * 3
  const raw = Buffer.alloc((1 + stride) * size)
  for (let y = 0; y < size; y++) {
    const base = y * (1 + stride)
    raw[base] = 0  // filter None
    for (let x = 0; x < size; x++) {
      raw[base + 1 + x * 3] = r
      raw[base + 1 + x * 3 + 1] = g
      raw[base + 1 + x * 3 + 2] = b
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const violet = [124, 58, 237]  // #7c3aed
const iconsDir = join(__dirname, '../icons')

for (const size of [16, 48, 128]) {
  const out = join(iconsDir, `icon${size}.png`)
  writeFileSync(out, makePNG(size, violet))
  console.log(`Created ${out}`)
}
