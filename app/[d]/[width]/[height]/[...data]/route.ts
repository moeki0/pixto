import { NextResponse } from 'next/server'
import { buildSVG, errorSVG } from '../../../../../lib/svg'

function parseAxisLabels(params: URLSearchParams): { yLabels: Record<number, string>; xLabels: Record<number, string> } {
  const yLabels: Record<number, string> = {}
  const xLabels: Record<number, string> = {}

  // Explicit numbered params: rowN / columnN
  params.forEach((v, k) => {
    let m: RegExpExecArray | null
    if ((m = /^row(\d+)$/i.exec(k))) {
      const idx = Number(m[1])
      if (idx > 0) yLabels[idx] = v
    } else if ((m = /^column(\d+)$/i.exec(k))) {
      const idx = Number(m[1])
      if (idx > 0) xLabels[idx] = v
    }
  })

  // Shorthand: rows=... / columns=... / ylabel=... / xlabel=... / y=... / x=...
  const csvToMap = (csv: string): string[] => csv.split(',').map((s) => s.trim()).filter(Boolean)
  const fillSeq = (arr: string[], target: Record<number, string>) => {
    arr.forEach((label, i) => {
      const idx = i + 1
      if (!(idx in target)) target[idx] = label
    })
  }
  const rows = params.get('rows') || params.get('row') || params.get('ylabel') || params.get('y')
  if (rows) fillSeq(csvToMap(rows), yLabels)
  const cols = params.get('columns') || params.get('column') || params.get('xlabel') || params.get('x')
  if (cols) fillSeq(csvToMap(cols), xLabels)

  // Generic: label= y:... or x:...  (also accept 'yの', 'xの', fullwidth '：')
  const labelParams = params.getAll('label')
  for (const raw of labelParams) {
    const s = String(raw)
    const m = /^(x|y)[：:の](.*)$/.exec(s)
    if (m) {
      const axis = m[1]
      const rest = m[2]
      const items = csvToMap(rest)
      if (axis === 'y') fillSeq(items, yLabels)
      else if (axis === 'x') fillSeq(items, xLabels)
      continue
    }
  }

  return { yLabels, xLabels }
}

export const runtime = 'edge'

export async function GET(
  request: Request,
  context: { params: { d: string; width: string; height: string; data: string[] } }
) {
  try {
    const { params } = context
    const dir = params.d
    const width = params.width
    const height = params.height
    const dataParts = params.data || []
    const data = Array.isArray(dataParts) ? dataParts.join('/') : String(dataParts || '')

    const url = new URL(request.url)
    const direction = dir === 'r' ? 'right' : dir === 'b' ? 'bottom' : null
    if (!direction) throw new Error("first path segment must be 'r' or 'b'")

    const color = url.searchParams.get('color') || undefined
    const alphaParam = url.searchParams.get('alpha')
    const alpha = alphaParam != null ? Number(alphaParam) : undefined

    let yGap: number | undefined = undefined
    let xGap: number | undefined = undefined
    const gapPair = url.searchParams.get('gap')
    if (gapPair) {
      const [gx, gy] = gapPair.split(',')
      if (gy !== undefined && gy !== '') yGap = Number(gy)
      if (gx !== undefined && gx !== '') xGap = Number(gx)
    }
    const yGapParam = url.searchParams.get('yGap') ?? url.searchParams.get('rowGap')
    const xGapParam = url.searchParams.get('xGap') ?? url.searchParams.get('colGap')
    if (yGapParam != null) yGap = Number(yGapParam)
    if (xGapParam != null) xGap = Number(xGapParam)

    // Palette: pal<Label>=<color>
    // NOTE: Do not treat default blue as part of the palette; default blue applies only when no pal_* is given.
    const palette: Record<string, string> = {}
    let defaultKey: string | null = null

    url.searchParams.forEach((v, k) => {
      const m = /^pal_([A-Za-z][\w-]*)$/.exec(k)
      if (m) {
        const label = m[1]
        const raw = String(v || '')
        const hex = raw.startsWith('#') ? raw.slice(1) : raw
        const norm = `#${hex}`.toLowerCase()
        if (norm === '#2c7be5') {
          // Skip default blue from palette; use server fallback when palette is effectively empty
          return
        }
        if (defaultKey == null) defaultKey = label
        palette[label] = v
      }
    })
    const { yLabels, xLabels } = parseAxisLabels(url.searchParams)
    const svg = buildSVG({ direction, data, width, height, color, alpha, yGap, xGap, yLabels, xLabels, palette, paletteDefaultKey: defaultKey })
    return new NextResponse(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } })
  } catch (e: any) {
    return errorSVG(e?.message || 'Bad Request', 400)
  }
}
