import { NextResponse } from 'next/server'
import { buildSVG } from '../../../../../../lib/svg'

export const runtime = 'edge'

export async function GET(
  request: Request,
  context: { params: { d: string; width: string; height: string; data?: string[] } }
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

    const palette: Record<string, string> = {}
    let defaultKey: string | null = null
    url.searchParams.forEach((v, k) => {
      const m = /^pal_([A-Za-z][\w-]*)$/.exec(k)
      if (m) {
        const label = m[1]
        const raw = String(v || '')
        const hex = raw.startsWith('#') ? raw.slice(1) : raw
        const norm = `#${hex}`.toLowerCase()
        if (norm === '#2c7be5') return
        if (defaultKey == null) defaultKey = label
        palette[label] = v
      }
    })

    const svg = buildSVG({ direction, data, width, height, color, alpha, yGap, xGap, yLabels: {}, xLabels: {}, palette, paletteDefaultKey: defaultKey })

    // Build OGP image URL pointing to OGP route: /ogp/{d}/{width}/{height}/{data}
    const og = new URL(request.url)
    og.pathname = `/ogp/${dir}/${width}/${height}/${data}`
    const ogImage = og.toString()

    const html = `<!doctype html><html lang=\"en\"><head>
<meta charset=\"utf-8\" />
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />
<meta property=\"og:type\" content=\"website\" />
<meta property=\"og:title\" content=\"RTNPX\" />
<meta property=\"og:image\" content=\"${ogImage}\" />
<meta name=\"twitter:card\" content=\"summary_large_image\" />
<meta name=\"twitter:image\" content=\"${ogImage}\" />
<title>RTNPX</title>
</head><body style=\"margin:0\">${svg}</body></html>`

    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  } catch (e: any) {
    return new NextResponse('Bad Request', { status: 400 })
  }
}
