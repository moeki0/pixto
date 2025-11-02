import { NextResponse } from 'next/server'
import { buildSVG, errorSVG } from '../../lib/svg'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const search = url.searchParams
    const direction = search.get('direction')
    const data = search.get('data')
    const width = search.get('width')
    const height = search.get('height')
    const color = search.get('color') || undefined
    const alphaParam = search.get('alpha')
    const alpha = alphaParam != null ? Number(alphaParam) : undefined
    const yGapParam = search.get('yGap') ?? search.get('rowGap')
    const xGapParam = search.get('xGap') ?? search.get('colGap')
    const yGap = yGapParam != null ? Number(yGapParam) : undefined
    const xGap = xGapParam != null ? Number(xGapParam) : undefined
    const yLabels: Record<number, string> = {}
    const xLabels: Record<number, string> = {}
    const xLabelStr = search.get('xLabel') ?? search.get('xLabels')
    if (xLabelStr) {
      xLabelStr.split(',').map(s => s.trim()).forEach((val, idx) => {
        if (val) xLabels[idx + 1] = val
      })
    }
    const yLabelStr = search.get('yLabel') ?? search.get('yLabels')
    if (yLabelStr) {
      yLabelStr.split(',').map(s => s.trim()).forEach((val, idx) => {
        if (val) yLabels[idx + 1] = val
      })
    }
    // Old-style overrides (x1,y1 etc.)
    search.forEach((v, k) => {
      let m: RegExpExecArray | null
      if ((m = /^(y|row)(\d+)$/.exec(k))) yLabels[Number(m[2])] = v
      else if ((m = /^(x|column)(\d+)$/.exec(k))) xLabels[Number(m[2])] = v
    })
    const svg = buildSVG({ direction, data, width, height, color, alpha, yGap, xGap, yLabels, xLabels })
    return new NextResponse(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } })
  } catch (e: any) {
    return errorSVG(e?.message || 'Bad Request', 400)
  }
}

