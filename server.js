const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

function badRequest(res, message) {
  const safe = String(message || 'Bad Request');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="80" viewBox="0 0 600 80">` +
    `<rect width="100%" height="100%" fill="#fff5f5"/>` +
    `<text x="10" y="50" fill="#d32f2f" font-family="monospace" font-size="16">Error: ${escapeXML(safe)}</text>` +
    `</svg>`;
  res.statusCode = 400;
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.end(svg);
}

function okSVG(res, svg) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.end(svg);
}

function escapeXML(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeColor(input, fallback = '#222') {
  if (!input) return fallback;
  // Allow basic CSS color tokens
  const ok = /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$|^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$|^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(?:0|1|0?\.\d+)\s*\)$/.test(input);
  return ok ? input : fallback;
}

function parseData(dataStr) {
  if (!dataStr || typeof dataStr !== 'string') throw new Error('data is required');
  const tokens = dataStr.split(',').map(t => t.trim()).filter(Boolean);
  if (!tokens.length) throw new Error('data must contain at least one value');
  let currentX = undefined;
  const pts = [];
  for (const tok of tokens) {
    let x = undefined, y = undefined;
    if (tok.includes(':')) {
      const [lx, ly] = tok.split(':');
      if (lx === '') {
        // implicit x
        if (currentX == null) currentX = 1; else currentX += 1;
        x = currentX;
        y = Number(ly);
      } else {
        x = Number(lx);
        y = Number(ly);
        currentX = x;
      }
    } else {
      // single number => y, implicit x
      if (currentX == null) currentX = 1; else currentX += 1;
      x = currentX;
      y = Number(tok);
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`invalid data token: ${tok}`);
    if (x <= 0) throw new Error(`x must be positive: ${tok}`);
    if (y < 0) throw new Error(`y must be >= 0: ${tok}`);
    pts.push({ x, y });
  }
  // sort by x ascending, stable
  pts.sort((a, b) => a.x - b.x || 0);
  return pts;
}

function buildSVG(params) {
  const { direction, data, width, height, color, rows, columns } = params;
  if (!direction || (direction !== 'right' && direction !== 'bottom')) {
    throw new Error("direction must be 'right' or 'bottom'");
  }
  if (!data) throw new Error('data is required');
  const cw = Number(width);
  const ch = Number(height);
  if (!Number.isFinite(cw) || cw <= 0) throw new Error('width must be a positive number');
  if (!Number.isFinite(ch) || ch <= 0) throw new Error('height must be a positive number');

  const pts = parseData(data);
  let maxX = 0, maxY = 0;
  for (const p of pts) { maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  if (maxX === 0 || maxY === 0) {
    // still allow drawing axes; avoid zero-size SVG
    maxX = Math.max(maxX, 1);
    maxY = Math.max(maxY, 1);
  }

  const margin = { left: 0, right: 0, top: 0, bottom: 0 };
  const contentWidth = maxX * cw;
  const contentHeight = maxY * ch;
  const extraBottom = (columns && Object.keys(columns).length) ? 24 : 0;
  const W = contentWidth;
  const H = contentHeight + extraBottom;

  const px = (x) => (x - 1) * cw;
  // Invert Y so that larger Y is higher visually (origin top-left of SVG)
  const py = (y) => (contentHeight - y * ch);

  // Build step path
  let d = '';
  if (pts.length === 1) {
    const p = pts[0];
    d = `M ${px(p.x)} ${py(p.y)} l 0 0`;
  } else {
    const first = pts[0];
    d = `M ${px(first.x)} ${py(first.y)}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (direction === 'right') {
        d += ` L ${px(b.x)} ${py(a.y)} L ${px(b.x)} ${py(b.y)}`;
      } else {
        d += ` L ${px(a.x)} ${py(b.y)} L ${px(b.x)} ${py(b.y)}`;
      }
    }
  }

  const stroke = sanitizeColor(color, '#2c7be5');

  // Build filled cells instead of grid/lines
  const colHeights = new Array(maxX).fill(0);
  for (const p of pts) {
    const ix = Math.max(1, Math.min(maxX, Math.round(p.x)));
    colHeights[ix - 1] = Math.max(colHeights[ix - 1], Math.max(0, Math.floor(p.y)));
  }
  const stroke = 'none';
  const fill = sanitizeColor(color, '#2c7be5');
  const cellElems = [];
  for (let xi = 1; xi <= maxX; xi++) {
    const h = colHeights[xi - 1];
    for (let yi = 1; yi <= h; yi++) {
      const rx = px(xi);
      const ry = py(yi);
      cellElems.push(`<rect x="${rx}" y="${ry}" width="${cw}" height="${ch}" fill="${fill}" stroke="${stroke}"/>`);
    }
  }

  // Labels
  const labelElems = [];
  // Column labels under content area
  if (columns && Object.keys(columns).length) {
    for (let i = 1; i <= maxX; i++) {
      if (columns[i]) {
        const cx = px(i) + cw / 2;
        const cy = contentHeight + 18;
        labelElems.push(`<text x="${cx}" y="${cy}" text-anchor="middle" font-size="12" fill="#334155">${escapeXML(String(columns[i]))}</text>`);
      }
    }
  }
  // Row labels on the left at each integer Y
  if (rows && Object.keys(rows).length) {
    for (let j = 1; j <= maxY; j++) {
      if (rows[j]) {
        const rx = 2;
        const ry = py(j) + ch - 4;
        labelElems.push(`<text x="${rx}" y="${ry}" text-anchor="start" font-size="12" fill="#334155">${escapeXML(String(rows[j]))}</text>`);
      }
    }
  }

  const svg = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n` +
    `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${W}\" height=\"${H}\" viewBox=\"0 0 ${W} ${H}\">` +
    `<g class=\"cells\">${cellElems.join('')}<\/g>` +
    `${labelElems.join('')}` +
    `</svg>`;

  return svg;
}

function handleRequest(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return badRequest(res, 'Only GET is supported');
  }
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname !== '/') {
    res.statusCode = 404;
    return badRequest(res, 'Not Found');
  }
  try {
    const direction = u.searchParams.get('direction');
    const data = u.searchParams.get('data');
    const width = u.searchParams.get('width');
    const height = u.searchParams.get('height');
    const color = u.searchParams.get('color') || undefined;
    const rows = {};
    const columns = {};
    for (const [k, v] of u.searchParams.entries()) {
      let m;
      if ((m = /^row(\d+)$/.exec(k))) {
        rows[Number(m[1])] = v;
      } else if ((m = /^column(\d+)$/.exec(k))) {
        columns[Number(m[1])] = v;
      }
    }
    const svg = buildSVG({ direction, data, width, height, color, rows, columns });
    okSVG(res, svg);
  } catch (err) {
    badRequest(res, err && err.message ? err.message : 'Bad Request');
  }
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`SVG server listening on http://localhost:${PORT}`);
});
