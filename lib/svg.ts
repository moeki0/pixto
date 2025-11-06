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

type Seg = { y0: number; y1: number; openEnd?: boolean; colorLabel?: string }

export function parseData(dataStr: string | null): { cols: Seg[][]; colDefaults: (string | undefined)[] } {
  if (dataStr == null) throw new Error('data is required')
  let s = String(dataStr).trim()
  if (s.endsWith('.svg')) s = s.slice(0, -4)
  if (s.endsWith('.png')) s = s.slice(0, -4)

  const useV1 = s.includes(':') || s.includes('|')
  const cols: Seg[][] = []
  const colDefaults: (string | undefined)[] = []

  if (useV1) {
    const tokens = s.split(',')
    for (const tokRaw of tokens) {
      const tok = tokRaw.trim()
      if (tok === '') { cols.push([]); continue }
      const parts = tok.split('|').map((p) => p.trim()).filter(Boolean)
      if (!parts.length) { cols.push([]); continue }
      const segs: Seg[] = []
      for (const part of parts) {
        let y0: number
        let y1: number
        let openEnd = false
        if (part.includes(':')) {
          const [a, b] = part.split(':')
          const hasA = a !== ''
          const hasB = b !== ''
          if (!hasA && !hasB) throw new Error()
          if (hasA && !hasB) {
            const ya = Number(a)
            if (!Number.isFinite(ya)) throw new Error()
            y0 = ya
            y1 = ya
            openEnd = true
          } else {
            const ya = hasA ? Number(a) : 1
            const yb = Number(b)
            if (!Number.isFinite(ya) || !Number.isFinite(yb)) throw new Error()
            y0 = Math.min(ya, yb)
            y1 = Math.max(ya, yb)
          }
        } else {
          const y = Number(part)
          if (!Number.isFinite(y)) throw new Error()
          y0 = y
          y1 = y
        }
        if (y0 < 1 || y1 < 1) throw new Error()
        if (y1 < y0) throw new Error()
        segs.push({ y0, y1, openEnd })
      }
      cols.push(segs)
      colDefaults.push(undefined)
    }
    return { cols, colDefaults }
  }

  // v2: '/' for columns, '_' for segments, '-' for range
  const colTokens = s.split('/')
  for (const c of colTokens) {
    const col = c.trim()
    if (col === '') { cols.push([]); continue }
    const rawTokens = col.split('_').map((p) => p.trim()).filter(Boolean)
    let segTokens = rawTokens
    let colDefault: string | undefined = undefined
    if (segTokens.length && segTokens[0].startsWith('~')) {
      const lab = segTokens[0].slice(1).trim()
      if (!lab) throw new Error('empty column color label after ~')
      colDefault = lab
      segTokens = segTokens.slice(1)
    }
    const segs: Seg[] = []
    for (const stRaw of segTokens) {
      const st = stRaw
      let y0: number
      let y1: number
      let openEnd = false
      let colorLabel: string | undefined = undefined
      let base = st
      if (st.includes('.')) {
        const dotIdx = st.lastIndexOf('.')
        base = st.slice(0, dotIdx)
        colorLabel = st.slice(dotIdx + 1)
        if (!colorLabel) throw new Error('empty color label after .')
      }
      if (base.includes('-')) {
        const idx = base.indexOf('-')
        const a = base.slice(0, idx)
        const b = base.slice(idx + 1)
        const hasA = a !== ''
        const hasB = b !== ''
        if (!hasA && !hasB) throw new Error()
        if (hasA && !hasB) {
          const ya = Number(a)
          if (!Number.isFinite(ya)) throw new Error()
          y0 = ya
          y1 = ya
          openEnd = true
        } else {
          const ya = hasA ? Number(a) : 1
          const yb = Number(b)
          if (!Number.isFinite(ya) || !Number.isFinite(yb)) throw new Error()
          y0 = Math.min(ya, yb)
          y1 = Math.max(ya, yb)
        }
      } else {
        const y = Number(base)
        if (!Number.isFinite(y)) throw new Error()
        y0 = y
        y1 = y
      }
      if (y0 < 1 || y1 < 1) throw new Error()
      if (y1 < y0) throw new Error()
      segs.push({ y0, y1, openEnd, colorLabel })
    }
    cols.push(segs)
    colDefaults.push(colDefault)
  }
  return { cols, colDefaults }
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
  palette?: Record<string, string>
  paletteDefaultKey?: string | null
}): string {
  const { direction, data, width, height, color, alpha = 1, yGap = 0, xGap = 0, yLabels, xLabels, palette = {}, paletteDefaultKey = null } = params
  if (!direction || (direction !== 'right' && direction !== 'bottom')) {
    throw new Error("direction must be 'right' or 'bottom'")
  }
  if (data == null) throw new Error('data is required')
  const cw = Number(width)
  const ch = Number(height)
  if (!Number.isFinite(cw) || cw <= 0) throw new Error('width must be a positive number')
  if (!Number.isFinite(ch) || ch <= 0) throw new Error('height must be a positive number')

  const parsed = parseData(data)
  const cols = parsed.cols
  const colDefaults = parsed.colDefaults
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
    segs.map((s) => ({ y0: Math.max(1, Math.floor(s.y0)), y1: Math.max(1, Math.floor(s.y1)), colorLabel: s.colorLabel }))
  )
  // Resolve palette colors
  const palResolved: Record<string, string> = {}
  let firstKey: string | null = null
  for (const k of Object.keys(palette)) {
    if (firstKey == null) firstKey = k
    palResolved[k] = sanitizeColor(palette[k], '#2c7be5')
  }
  const fallbackBase = sanitizeColor(color, '#2c7be5')
  const defaultKey = paletteDefaultKey || firstKey
  const cellElems: string[] = []
  for (let xi = 1; xi <= maxX; xi++) {
    const segs = normCols[xi - 1] || []
    const colDef = colDefaults[xi - 1]
    for (const r of segs) {
      for (let yi = r.y0; yi <= r.y1; yi++) {
        const rx = px(xi)
        const ry = py(yi)
        // Resolve fill color priority:
        // 1) segment colorLabel as palette key
        // 2) segment colorLabel as direct color token (#rgb, rgb(), named, 0x...)
        // 3) column default palette key
        // 4) palette default key (first pal_*)
        // 5) fallback base color (query `color` or default blue)
        let fill: string | undefined
        if (r.colorLabel) {
          if (palResolved[r.colorLabel]) {
            fill = palResolved[r.colorLabel]
          } else {
            const direct = sanitizeColor(r.colorLabel, '')
            if (direct) fill = direct
          }
        }
        if (!fill && colDef && palResolved[colDef]) {
          fill = palResolved[colDef]
        } else if (!fill && defaultKey && palResolved[defaultKey]) {
          fill = palResolved[defaultKey]
        }
        if (!fill) fill = fallbackBase
        cellElems.push(`<rect x="${rx}" y="${ry}" width="${cw}" height="${ch}" fill="${fill}" stroke="none"/>`)
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
    const ml = Object.keys(yLabels).length ? 56 : 0
    for (let j = 1; j <= maxY; j++) {
      if (yLabels[j]) {
        const rx = Math.max(2, ml - 6)
        const ry = py(j) + ch / 2
        const rotAttr = direction === 'bottom' ? ` transform="rotate(-90 ${rx} ${ry})"` : ''
        labelElems.push(
          `<text x="${rx}" y="${ry}" text-anchor="end" dominant-baseline="middle" font-size="12" fill="#334155"${rotAttr}>${escapeXML(String(
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
  const hasLabels = Object.keys(xLabels).length > 0 || Object.keys(yLabels).length > 0
  const outerPad = hasLabels ? 8 : 0
  const rootW = outW + outerPad * 2
  const rootH = outH + outerPad * 2
  const bgRect = hasLabels ? `<rect width="100%" height="100%" fill="#ffffff"/>` : ''
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${rootW}" height="${rootH}" viewBox="0 0 ${rootW} ${rootH}">` +
    `${bgRect}` +
    `<g transform="translate(${outerPad},${outerPad})">` +
      `<g class="content"${groupTransform}>` +
        `<g class="cells" fill-opacity="${safeAlpha}">${cellElems.join('')}</g>` +
        `${labelElems.join('')}` +
      `</g>` +
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
