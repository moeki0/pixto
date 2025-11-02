import { NextResponse } from 'next/server'

export function escapeXML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function sanitizeColor(input: string | null | undefined, fallback = '#2c7be5'): string {
  if (!input) return fallback
  let s = String(input).trim()
  if (/^0x[0-9a-fA-F]{6,8}$/.test(s)) s = '#' + s.slice(2)
  if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{4}$|^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/.test(s)) s = '#' + s
  const ok = /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$|^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$|^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(?:0|1|0?\.\d+)\s*\)$/.test(
    s
  )
  return ok ? s : fallback
}

type Seg = { y0: number; y1: number }

export function parseData(dataStr: string | null): Seg[][] {
  if (dataStr == null) throw new Error('data is required')
  const tokens = dataStr.split(',').map((t) => t.trim())
  if (tokens.length === 0) return []
  const cols: Seg[][] = []
  for (const tok of tokens) {
    if (tok === '') { cols.push([]); continue }
    const parts = tok.split('|').map((p) => p.trim()).filter(Boolean)
    if (!parts.length) { cols.push([]); continue }
    const segs: Seg[] = []
    for (const part of parts) {
      let y0: number
      let y1: number
      if (part.includes(':')) {
        const [a, b] = part.split(':')
        const hasA = a !== ''
        const hasB = b !== ''
        if (!hasB) throw new Error(`invalid data token: ${part}`)
        const ya = hasA ? Number(a) : 1
        const yb = Number(b)
        if (!Number.isFinite(ya) || !Number.isFinite(yb)) throw new Error(`invalid data token: ${part}`)
        y0 = Math.min(ya, yb)
        y1 = Math.max(ya, yb)
      } else {
        const y = Number(part)
        if (!Number.isFinite(y)) throw new Error(`invalid data token: ${part}`)
        y0 = 1
        y1 = y
      }
      if (y0 < 1 || y1 < 1) throw new Error(`y must be >= 1: ${part}`)
      if (y1 < y0) throw new Error(`invalid range: ${part}`)
      segs.push({ y0, y1 })
    }
    cols.push(segs)
  }
  return cols
}

export function buildSVG(params: {
  direction: string | null
  data: string | null
  width: string | null
  height: string | null
  color?: string | null
  alpha?: number
  yGap?: number
  xGap?: number
  yLabels: Record<number, string>
  xLabels: Record<number, string>
}): string {
  const { direction, data, width, height, color, alpha = 0.35, yGap = 0, xGap = 0, yLabels, xLabels } = params
  if (!direction || (direction !== 'right' && direction !== 'bottom')) {
    throw new Error("direction must be 'right' or 'bottom'")
  }
  if (!data) throw new Error('data is required')
  const cw = Number(width)
  const ch = Number(height)
  if (!Number.isFinite(cw) || cw <= 0) throw new Error('width must be a positive number')
  if (!Number.isFinite(ch) || ch <= 0) throw new Error('height must be a positive number')

  const cols = parseData(data)
  const maxX = cols.length
  let maxY = 1
  for (const segs of cols) {
    for (const s of segs) {
      maxY = Math.max(maxY, Math.floor(s.y1))
    }
  }
  if (cols.length === 0) maxY = 0

  const rg = Math.max(0, Number(yGap) || 0)
  const cg = Math.max(0, Number(xGap) || 0)
  const stepsX = maxX > 0 ? (maxX - 1) : 0
  const stepsY = maxY > 0 ? (maxY - 1) : 0
  const contentWidth = maxX > 0 ? maxX * cw + stepsX * cg : 0
  const contentHeight = maxY > 0 ? maxY * ch + stepsY * rg : 0
  const marginBottom = Object.keys(xLabels).length ? 56 : 0
  const marginLeft = Object.keys(yLabels).length ? 56 : 0
  const W = marginLeft + contentWidth
  const H = contentHeight + marginBottom

  const px = (x: number) => marginLeft + (x - 1) * (cw + cg)
  const py = (y: number) => contentHeight - (y * ch + (y - 1) * rg)

  const normCols: Seg[][] = cols.map((segs) =>
    segs.map((s) => ({ y0: Math.max(1, Math.floor(s.y0)), y1: Math.max(1, Math.floor(s.y1)) }))
  )
  const baseFill = sanitizeColor(color, '#2c7be5')
  const cellElems: string[] = []
  for (let xi = 1; xi <= maxX; xi++) {
    const segs = normCols[xi - 1] || []
    for (const r of segs) {
      for (let yi = r.y0; yi <= r.y1; yi++) {
        const rx = px(xi)
        const ry = py(yi)
        cellElems.push(`<rect x="${rx}" y="${ry}" width="${cw}" height="${ch}" fill="${baseFill}" stroke="none"/>`)
      }
    }
  }

  const labelElems: string[] = []
  if (Object.keys(xLabels).length) {
    for (let i = 1; i <= maxX; i++) {
      if (xLabels[i]) {
        const cx = px(i) + cw / 2
        const cy = contentHeight + 20
        const rotAttr = direction === 'bottom' ? ` transform="rotate(-90 ${cx} ${cy})"` : ''
        labelElems.push(
          `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="12" fill="#334155"${rotAttr}>${escapeXML(String(
            xLabels[i]
          ))}</text>`
        )
      }
    }
  }
  if (Object.keys(yLabels).length) {
    for (let j = 1; j <= maxY; j++) {
      if (yLabels[j]) {
        const rx = Math.max(2, (Object.keys(yLabels).length ? 56 : 0) - 6)
        const ry = py(j) + ch - 4
        const rotAttr = direction === 'bottom' ? ` transform="rotate(-90 ${rx} ${ry})"` : ''
        labelElems.push(
          `<text x="${rx}" y="${ry}" text-anchor="start" font-size="12" fill="#334155"${rotAttr}>${escapeXML(String(
            yLabels[j]
          ))}</text>`
        )
      }
    }
  }

  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 0.35
  let outW = W
  let outH = H
  let groupTransform = ''
  if (direction === 'bottom') {
    // Apply translate first, then rotate 90deg around origin
    groupTransform = ` transform="translate(${H},0) rotate(90)"`
    outW = H
    outH = W
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}">` +
    `<g class="content"${groupTransform}>` +
      `<g class="cells" fill-opacity="${safeAlpha}">${cellElems.join('')}</g>` +
      `${labelElems.join('')}` +
    `</g>` +
    `</svg>`

  return svg
}

export function errorSVG(message: string, status = 400) {
  const safe = escapeXML(message)
  const svg = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n` +
    `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"80\" viewBox=\"0 0 600 80\">` +
    `<rect width=\"100%\" height=\"100%\" fill=\"#fff5f5\"/>` +
    `<text x=\"10\" y=\"50\" fill=\"#d32f2f\" font-family=\"monospace\" font-size=\"16\">Error: ${safe}</text>` +
    `</svg>`
  return new NextResponse(svg, {
    status,
    headers: { 'content-type': 'image/svg+xml; charset=utf-8' },
  })
}
