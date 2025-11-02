export const runtime = 'edge'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const qs = url.search
  const origin = `${url.protocol}//${url.host}`

  const ogUrl = `${origin}/og${qs}`
  const ogw = Number(url.searchParams.get('ogw') || 1200)
  const ogh = Number(url.searchParams.get('ogh') || 630)
  const secureOgUrl = ogUrl.startsWith('http://') ? ogUrl.replace('http://', 'https://') : ogUrl
  const svgUrl = `${origin}/index.svg${qs}`

  const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>index.svg preview</title>
    <meta property="og:title" content="index.svg" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${ogUrl}" />
    <meta property="og:image:secure_url" content="${secureOgUrl}" />
    <meta property="og:image:width" content="${ogw}" />
    <meta property="og:image:height" content="${ogh}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:url" content="${origin}${url.pathname}${qs}" />
    <meta property="og:image:alt" content="Dynamic SVG graph preview" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${ogUrl}" />
  </head>
  <body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;">
    <img src="${svgUrl}" alt="svg graph" style="max-width:100%;max-height:100vh;object-fit:contain" />
  </body>
  </html>`

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
