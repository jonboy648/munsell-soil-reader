// Draws the app icons into public/: a 3x3 grid of gray chips on a dark gray ground, a nod to
// a Page of the soil book (value down the rows). Every pixel is neutral gray, no brand color.
// Run `node scripts/make-icons.mjs`; the PNGs are committed, so this is only for changing them.
import { writeFileSync } from "node:fs"
import { deflateSync, crc32 } from "node:zlib"

const GROUND = 0x1f // the dark theme's background gray
const ROW_GRAY = [0xe8, 0xb4, 0x80] // light to dark, top to bottom
const COLUMN_STEP = 0x10 // each column to the right is a little darker

const png = (size, rgba) => {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body), body.length + 4)
    return out
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 6, 0, 0, 0], 8) // 8-bit RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

/**
 * `grid` is the share of the icon the chip grid fills; `corner` rounds the icon itself (0 for a
 * full-bleed icon that the launcher masks).
 */
function icon(size, { grid, corner }) {
  const pixels = Buffer.alloc(size * size * 4)
  const SS = 4 // 4x4 samples per pixel for smooth edges
  const gridSize = size * grid
  const origin = (size - gridSize) / 2
  const gap = gridSize * 0.07
  const cell = (gridSize - 2 * gap) / 3
  const radius = cell * 0.14
  const ground = (x, y) => {
    if (corner === 0) return true
    const dx = Math.max(corner - x, x - (size - corner), 0)
    const dy = Math.max(corner - y, y - (size - corner), 0)
    return dx * dx + dy * dy <= corner * corner
  }
  const chipGray = (x, y) => {
    const col = Math.floor((x - origin) / (cell + gap))
    const row = Math.floor((y - origin) / (cell + gap))
    if (col < 0 || col > 2 || row < 0 || row > 2) return null
    const lx = x - origin - col * (cell + gap)
    const ly = y - origin - row * (cell + gap)
    if (lx > cell || ly > cell) return null
    const dx = Math.max(radius - lx, lx - (cell - radius), 0)
    const dy = Math.max(radius - ly, ly - (cell - radius), 0)
    return dx * dx + dy * dy <= radius * radius ? ROW_GRAY[row] - col * COLUMN_STEP : null
  }
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let gray = 0
      let alpha = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS
          const y = py + (sy + 0.5) / SS
          if (!ground(x, y)) continue
          alpha++
          gray += chipGray(x, y) ?? GROUND
        }
      }
      const i = (py * size + px) * 4
      const g = alpha ? Math.round(gray / alpha) : 0
      pixels.set([g, g, g, Math.round((alpha / (SS * SS)) * 255)], i)
    }
  }
  return png(size, pixels)
}

const out = (name, data) => writeFileSync(new URL(`../public/${name}`, import.meta.url), data)
out("icon-192.png", icon(192, { grid: 0.68, corner: 192 * 0.2 }))
out("icon-512.png", icon(512, { grid: 0.68, corner: 512 * 0.2 }))
// Maskable: full bleed, grid inside the central 80% safe zone so any mask shape keeps it whole.
out("icon-maskable-512.png", icon(512, { grid: 0.5, corner: 0 }))
// iOS ignores the manifest icons and rounds the corners itself.
out("apple-touch-icon.png", icon(180, { grid: 0.6, corner: 0 }))
