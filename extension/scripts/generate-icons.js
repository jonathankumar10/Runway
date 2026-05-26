// Generates icons/icon16.png, icon48.png, icon128.png.
// The icon is drawn directly so the extension has no image build dependency.
import { deflateSync } from 'zlib'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t))
}

function inRoundedRect(x, y, size, radius) {
  const left = radius
  const right = size - radius - 1
  const top = radius
  const bottom = size - radius - 1

  if ((x >= left && x <= right) || (y >= top && y <= bottom)) return true

  const cx = x < left ? left : right
  const cy = y < top ? top : bottom
  return Math.hypot(x - cx, y - cy) <= radius
}

function isNearLine(x, y, x1, y1, x2, y2, width) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSq))
  const px = x1 + t * dx
  const py = y1 + t * dy
  return Math.hypot(x - px, y - py) <= width
}

function makeIconPixel(x, y, size) {
  if (!inRoundedRect(x, y, size, size * 0.22)) return [0, 0, 0, 0]

  const bg = mix(hexToRgb('#111827'), hexToRgb('#312e81'), y / size)
  const glow = Math.max(0, 1 - Math.hypot(x - size * 0.72, y - size * 0.28) / (size * 0.55))
  const base = mix(bg, hexToRgb('#8b5cf6'), glow * 0.45)

  const runwayA = isNearLine(x, y, size * 0.28, size * 0.82, size * 0.72, size * 0.18, size * 0.055)
  const runwayB = isNearLine(x, y, size * 0.48, size * 0.86, size * 0.86, size * 0.26, size * 0.035)
  if (runwayA || runwayB) return [...hexToRgb('#7dd3fc'), 255]

  const planeBody = isNearLine(x, y, size * 0.29, size * 0.55, size * 0.76, size * 0.34, size * 0.045)
  const planeWing = isNearLine(x, y, size * 0.46, size * 0.48, size * 0.58, size * 0.70, size * 0.04)
  const planeTail = isNearLine(x, y, size * 0.34, size * 0.53, size * 0.30, size * 0.70, size * 0.03)
  if (planeBody || planeWing || planeTail) return [...hexToRgb('#f8fafc'), 255]

  return [...base, 255]
}

function makePNG(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  const stride = size * 4
  const raw = Buffer.alloc((1 + stride) * size)
  for (let y = 0; y < size; y++) {
    const base = y * (1 + stride)
    raw[base] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = makeIconPixel(x + 0.5, y + 0.5, size)
      raw[base + 1 + x * 4] = r
      raw[base + 1 + x * 4 + 1] = g
      raw[base + 1 + x * 4 + 2] = b
      raw[base + 1 + x * 4 + 3] = a
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const iconsDir = join(__dirname, '../icons')

for (const size of [16, 48, 128]) {
  const out = join(iconsDir, `icon${size}.png`)
  writeFileSync(out, makePNG(size))
  console.log(`Created ${out}`)
}
