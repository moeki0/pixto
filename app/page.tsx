"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PixelGrid } from "./components/PixelGrid";
import { Palette } from "./components/Palette";
import { Controls } from "./components/Controls";
import { UrlPane } from "./components/UrlPane";

const DEFAULT_ROWS = 16;

type Grid = number[][];
const origin = typeof window !== "undefined" ? window.location.origin : "";

function normalizeUrl(input: string, origin: string) {
  const s = input.trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const path = s.startsWith("/") ? s : `/${s}`;
  const [basePath, queryPart] = path.split("?", 2);
  const segs = basePath.split("/").filter(Boolean);
  const hasDataSegment = segs.length >= 4 && segs[3].length > 0;
  const suffix = queryPart != null ? `?${queryPart}` : "";
  const finalPath = hasDataSegment
    ? `${basePath}.svg${suffix ? suffix.replace(/^\?/, "?") : ""}`
    : `${basePath}${suffix}`;
  return `${origin}${finalPath}`;
}

function makeEmptyGrid(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );
}

function buildPathFromGrid(
  grid: Grid,
  palette: string[]
): { path: string; query: string } {
  const cols: string[] = [];
  const totalCols = grid[0]?.length ?? 0;
  const totalRows = grid.length;
  const DEFAULT_BLUE = "#2c7be5";
  for (let x = 0; x < totalCols; x++) {
    const segs: string[] = [];
    let runColorIdx: number = 0;
    let runStartY: number = -1;

    const flushRun = (endY: number) => {
      if (!runColorIdx) return;
      const label = runColorIdx === 1 ? "" : `c${runColorIdx}`;
      if (runStartY === endY) {
        segs.push(label ? `${runStartY}.${label}` : `${runStartY}`);
      } else {
        segs.push(
          label ? `${runStartY}-${endY}.${label}` : `${runStartY}-${endY}`
        );
      }
    };

    for (let y = 1; y <= totalRows; y++) {
      const uiRow = totalRows - y;
      const idx = grid[uiRow][x];
      if (idx !== runColorIdx) {
        if (runColorIdx !== 0) {
          flushRun(y - 1);
        }
        runColorIdx = idx;
        if (idx !== 0) runStartY = y;
      }
    }
    if (runColorIdx !== 0) flushRun(totalRows);
    cols.push(segs.length ? segs.join("_") : "_");
  }

  const data = cols.join("/");

  const used = new Set<number>();
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < totalCols; c++) {
      const v = grid[r][c];
      if (v > 0) used.add(v);
    }
  }
  const q = Array.from(used)
    .sort((a, b) => a - b)
    .map((i) => {
      const col = palette[i - 1];
      if (!col) return null;
      const sCol = String(col).trim();
      const norm = (sCol.startsWith("#") ? sCol : `#${sCol}`).toLowerCase();
      if (norm === DEFAULT_BLUE) return null;
      return `pal_c${i}=${encodeURIComponent(sCol.replace(/^#/, ""))}`;
    })
    .filter(Boolean)
    .join("&");
  if (used.size === 0) return { path: "", query: "" };
  return { path: data, query: q };
}

function EditorApp() {
  const [palette, setPalette] = useState<string[]>([]);
  const [selected, setSelected] = useState<number>(0);
  const [cols, setCols] = useState<number>(16);
  const [rows, setRows] = useState<number>(DEFAULT_ROWS);
  const [fullGrid, setFullGrid] = useState<Grid>(() =>
    makeEmptyGrid(DEFAULT_ROWS, 16)
  );
  const [cellWidth, setCellWidth] = useState<number>(20);
  const [cellHeight, setCellHeight] = useState<number>(20);
  const [alpha, setAlpha] = useState<number>(1);
  const cellWidthPx = Math.max(14, cellWidth);
  const cellHeightPx = Math.max(14, cellHeight);
  const LS_KEY = "rtnpx_state_v1";

  function resizeGridTo(prev: Grid, newRows: number, newCols: number): Grid {
    const curCols = prev[0]?.length ?? newCols;
    let base = prev.slice(-newRows);
    while (base.length < newRows)
      base = [Array.from({ length: curCols }, () => 0), ...base];
    return base.map((row) => {
      const next = row.slice(0, newCols);
      while (next.length < newCols) next.push(0);
      return next;
    });
  }

  const ensureFullSize = (minRows: number, minCols: number) => {
    setFullGrid((prev) => {
      let cur = prev;
      cur = cur.map((row) => {
        const next = row.slice();
        while (next.length < minCols) next.push(0);
        return next;
      });
      const curCols = cur[0]?.length || minCols || 0;
      while (cur.length < minRows)
        cur = [Array.from({ length: curCols }, () => 0), ...cur];
      return cur;
    });
  };

  const viewGrid: Grid = useMemo(() => {
    const totalRows = fullGrid.length;
    const start = Math.max(0, totalRows - rows);
    const sliceRows = fullGrid.slice(start);
    return sliceRows.map((row) => row.slice(0, cols));
  }, [fullGrid, rows, cols]);

  // Load from localStorage (but skip if URL has ?import or ?edit to avoid overriding imported state)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const sp = new URLSearchParams(window.location.search);
      const hasImport = sp.has("import") || sp.has("edit");
      if (!hasImport) {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const st = JSON.parse(raw);
        const clamp = (v: any, min: number, max: number, def: number) => {
          const n = Number(v);
          return Number.isFinite(n)
            ? Math.max(min, Math.min(max, Math.floor(n)))
            : def;
        };
        const lr = clamp(st.rows, 1, 128, rows);
        const lc = clamp(st.cols, 1, 128, cols);
        const lw = clamp(st.cellWidth, 4, 64, cellWidth);
        const lh = clamp(st.cellHeight, 4, 64, cellHeight);
        const la = (() => {
          const n = Number(st.alpha);
          return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : alpha;
        })();
        const lp = Array.isArray(st.palette)
          ? st.palette.map((x: any) => String(x || "").trim()).filter(Boolean)
          : palette;
        const ls = (() => {
          const n = Number(st.selected);
          const maxIdx = Math.max(1, lp.length);
          return Number.isFinite(n)
            ? Math.max(0, Math.min(maxIdx, Math.floor(n)))
            : selected;
        })();
        let lg: Grid = Array.isArray(st.fullGrid)
          ? st.fullGrid.map((r: any) =>
              Array.isArray(r)
                ? r.map((n: any) =>
                    Number.isFinite(Number(n)) ? Number(n) : 0
                  )
                : []
            )
          : Array.isArray(st.grid)
          ? st.grid.map((r: any) =>
              Array.isArray(r)
                ? r.map((n: any) =>
                    Number.isFinite(Number(n)) ? Number(n) : 0
                  )
                : []
            )
          : fullGrid;
        setRows(lr);
        setCols(lc);
        setCellWidth(lw);
        setCellHeight(lh);
        setAlpha(la);
        setPalette(lp);
        setSelected(ls);
        setFullGrid(lg);
      }
    } catch {
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  // Track last applied import string to avoid reapplying same value repeatedly
  const lastAppliedImportRef = useRef<string | null>(null);

  // Save to localStorage (only after hydration to avoid overwriting stored state with defaults)
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (typeof window === "undefined") return;
      const st = {
        rows,
        cols,
        fullGrid,
        cellWidth,
        cellHeight,
        alpha,
        palette,
        selected,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(st));
    } catch {}
  }, [rows, cols, fullGrid, cellWidth, cellHeight, alpha, palette, selected]);

  const applyPaint = (r: number, c: number, kind: "click" | "drag") => {
    setFullGrid((prev) => {
      const needRows = Math.max(prev.length, rows);
      const needCols = Math.max(prev[0]?.length ?? 0, cols);
      let base = resizeGridTo(prev, needRows, needCols);
      const fgRow = base.length - rows + r;
      if (fgRow < 0 || c < 0) return base;
      const next = base.map((row) => row.slice());
      if (next[fgRow] && c < next[fgRow].length) {
        next[fgRow][c] = selected;
      }
      return next;
    });
  };

  const { path, query } = useMemo(
    () => buildPathFromGrid(viewGrid, palette),
    [viewGrid, palette]
  );
  const derivedRaw = useMemo(() => {
    const base = `/r/${cellWidth}/${cellHeight}`;
    const dataPart = path ? `/${path}` : "";
    const q = [query, alpha !== 1 ? `alpha=${alpha}` : ""]
      .filter(Boolean)
      .join("&");
    return `${base}${dataPart}${q ? `?${q}` : ""}`;
  }, [path, query, cellWidth, cellHeight, alpha]);

  const [inputRaw, setInputRaw] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  const url = useMemo(() => {
    const base = inputRaw && inputRaw.trim().length > 0 ? inputRaw : derivedRaw;
    return origin ? normalizeUrl(base, origin) : "";
  }, [inputRaw, derivedRaw, origin]);
  const htmlUrl = useMemo(() => {
    if (!origin) return "";
    const q = [query, alpha !== 1 ? `alpha=${alpha}` : ""]
      .filter(Boolean)
      .join("&");
    if (!path) return "";
    const base = `/html/r/${cellWidth}/${cellHeight}/${path}`;
    return `${origin}${base}${q ? `?${q}` : ""}`;
  }, [origin, path, query, cellWidth, cellHeight, alpha]);
  useEffect(() => {
    if (hydrated) setInputRaw(derivedRaw);
  }, [derivedRaw, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (typeof window === "undefined") return;
      const v = searchParams.get("import") || searchParams.get("edit");
      if (!v) return;
      const decoded = decodeURIComponent(v);
      if (lastAppliedImportRef.current === decoded) return;
      lastAppliedImportRef.current = decoded;
      setInputRaw(decoded);
      parseAndApplyUrl(decoded);
      const cur = new URL(window.location.href);
      cur.searchParams.delete("import");
      cur.searchParams.delete("edit");
      router.replace(cur.pathname + cur.search, { scroll: false });
    } catch {}
  }, [hydrated, searchParams, router]);

  const parseAndApplyUrl = (input: string) => {
    try {
      const base =
        origin ||
        (typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost");
      const u = new URL(input, base);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length < 3) return;
      const d = parts[0];
      if (d !== "r" && d !== "b") return;
      let cw = Number(parts[1]);
      let ch = Number(parts[2]);
      let dataPartRaw = parts.slice(3).join("/");
      // Fallback: if width/height are not numeric (e.g., width mistakenly contains data like "1.c8"),
      // assume current cell size and treat from that segment as data.
      if (!Number.isFinite(cw) || !Number.isFinite(ch)) {
        if (Number.isFinite(cw) && !Number.isFinite(ch)) {
          ch = cellHeight;
          dataPartRaw = parts.slice(2).join("/");
        } else {
          cw = cellWidth;
          ch = cellHeight;
          dataPartRaw = parts.slice(1).join("/");
        }
      }
      let dataPart = dataPartRaw;
      if (dataPart.endsWith(".svg")) dataPart = dataPart.slice(0, -4);
      if (dataPart.endsWith(".png")) dataPart = dataPart.slice(0, -4);

      const pal: Record<string, string> = {};
      const palEntries: { label: string; color: string }[] = [];
      u.searchParams.forEach((v, k) => {
        const m = /^pal_([A-Za-z][\w-]*)$/.exec(k);
        if (m) {
          const color = v.startsWith("#") ? v : `#${v}`;
          const norm = color.trim().toLowerCase();
          if (norm === "#2c7be5") return;
          pal[m[1]] = color;
          palEntries.push({ label: m[1], color });
        }
      });
      const paletteDefaultLabel = palEntries[0]?.label;

      const alphaParam = u.searchParams.get("alpha");
      const a = alphaParam != null ? Number(alphaParam) : undefined;

      const colTokens = dataPart ? dataPart.split("/") : [];
      const newCols = Math.min(128, Math.max(1, colTokens.length || 1));

      // Decide new rows from the data (max referenced Y); if no data, keep current rows
      const computedRows = (() => {
        if (colTokens.length === 0) return rows;
        let maxY = 1;
        for (let xi = 0; xi < colTokens.length; xi++) {
          const token = colTokens[xi] ?? "";
          const segTokensAll = token
            .split("_")
            .map((s) => s.trim())
            .filter(Boolean);
          let segTokens = segTokensAll;
          if (segTokens.length && segTokens[0].startsWith("~")) {
            segTokens = segTokens.slice(1);
          }
          for (const st of segTokens) {
            let base = st;
            if (st.includes(".")) {
              const i = st.lastIndexOf(".");
              base = st.slice(0, i);
            }
            let y0: number;
            let y1: number;
            if (base.includes("-")) {
              const idx = base.indexOf("-");
              const a0 = base.slice(0, idx);
              const b0 = base.slice(idx + 1);
              const ya = a0 ? Number(a0) : 1;
              const yb = b0 ? Number(b0) : 1;
              y0 = Math.min(ya, yb);
              y1 = Math.max(ya, yb);
            } else {
              const y = Number(base);
              y0 = y;
              y1 = y;
            }
            y0 = Math.max(1, Math.floor(y0));
            y1 = Math.max(1, Math.floor(y1));
            if (Number.isFinite(y1)) maxY = Math.max(maxY, y1);
          }
        }
        return Math.min(128, Math.max(1, maxY));
      })();

      const newRows = computedRows;
      const newGrid: Grid = Array.from({ length: newRows }, () =>
        Array.from({ length: newCols }, () => 0)
      );

      let maxIndexUsed = 0;
      // Ensure a default blue exists as a fallback when no palette default is provided
      const DEFAULT_BLUE = "#2c7be5";
      const paletteTemp: string[] = [...palette];
      const palIndexMap = new Map<string, number>();
      const ensurePaletteIndex = (idx: number) => {
        while (paletteTemp.length < idx) paletteTemp.push(DEFAULT_BLUE);
      };

      // Pre-apply pal_* entries to GUI palette (even if not referenced in data)
      palEntries.forEach(({ label, color }) => {
        const hex = color;
        const m = /^c(\d+)$/.exec(label);
        if (m) {
          const idxNum = Number(m[1]);
          ensurePaletteIndex(idxNum);
          paletteTemp[idxNum - 1] = hex;
          palIndexMap.set(label, idxNum);
        } else {
          const target = String(hex || "")
            .trim()
            .toLowerCase();
          let idx = paletteTemp.findIndex(
            (c) =>
              String(c || "")
                .trim()
                .toLowerCase() === target
          );
          if (idx === -1) {
            paletteTemp.push(hex);
            idx = paletteTemp.length - 1;
          }
          palIndexMap.set(label, idx + 1);
        }
      });
      const findDefaultIdx = () => {
        const i = paletteTemp.findIndex(
          (c) => c.toLowerCase() === DEFAULT_BLUE.toLowerCase()
        );
        return i >= 0 ? i + 1 : 0; // 1-based palette index or 0 if not found
      };
      let defaultIndex =
        paletteDefaultLabel != null
          ? palIndexMap.get(paletteDefaultLabel) || 0
          : 0;
      if (defaultIndex === 0) {
        defaultIndex = findDefaultIdx();
      }
      if (defaultIndex === 0) {
        paletteTemp.push(DEFAULT_BLUE);
        defaultIndex = paletteTemp.length; // 1-based
      }

      for (let xi = 0; xi < newCols; xi++) {
        const token = colTokens[xi] ?? "";
        const segTokensAll = token
          .split("_")
          .map((s) => s.trim())
          .filter(Boolean);
        let segTokens = segTokensAll;
        let colDefault: string | undefined = undefined;
        if (segTokens.length && segTokens[0].startsWith("~")) {
          colDefault = segTokens[0].slice(1);
          segTokens = segTokens.slice(1);
        }
        if (segTokens.length === 0) continue;
        for (const st of segTokens) {
          let base = st;
          let label: string | undefined;
          if (st.includes(".")) {
            const i = st.lastIndexOf(".");
            base = st.slice(0, i);
            label = st.slice(i + 1);
          }
          if (!label) label = colDefault;
          let y0: number;
          let y1: number;
          if (base.includes("-")) {
            const idx = base.indexOf("-");
            const a0 = base.slice(0, idx);
            const b0 = base.slice(idx + 1);
            const ya = a0 ? Number(a0) : 1;
            const yb = b0 ? Number(b0) : 1;
            y0 = Math.min(ya, yb);
            y1 = Math.max(ya, yb);
          } else {
            const y = Number(base);
            y0 = y;
            y1 = y;
          }
          y0 = Math.max(1, Math.floor(y0));
          y1 = Math.max(1, Math.floor(y1));
          y0 = Math.min(newRows, y0);
          y1 = Math.min(newRows, y1);

          let idxNum = 0;
          if (label) {
            const m = /^c(\d+)$/.exec(label);
            if (m) {
              idxNum = Number(m[1]);
              maxIndexUsed = Math.max(maxIndexUsed, idxNum);
              const palKey = `c${idxNum}`;
              if (pal[palKey]) {
                ensurePaletteIndex(idxNum);
                paletteTemp[idxNum - 1] = pal[palKey];
              }
            } else {
              // Non-numeric label is unsupported in editor palette; fall back to palette default
              idxNum = defaultIndex;
            }
          } else {
            // No label provided -> use palette default color
            idxNum = defaultIndex;
          }

          for (let y = y0; y <= y1; y++) {
            const rr = newRows - y;
            if (rr >= 0 && rr < newRows) newGrid[rr][xi] = idxNum;
          }
        }
      }

      ensurePaletteIndex(maxIndexUsed);

      setCellWidth(Math.max(4, Math.min(64, Math.floor(cw))));
      setCellHeight(Math.max(4, Math.min(64, Math.floor(ch))));
      if (Number.isFinite(a as any))
        setAlpha(Math.max(0, Math.min(1, Number(a))));
      setFullGrid(newGrid);
      setCols(newCols);
      setRows(newRows);
      setPalette(paletteTemp);
    } catch (_e) {
      // ignore
    }
  };

  const addPaletteColor = (hex: string) => {
    const clean = hex.trim();
    if (!clean) return;
    setPalette((prev) => [...prev, clean]);
    setSelected((prev) => (prev === 0 ? 1 : prev));
  };

  return (
    <main
      style={{
        padding: 10,
        fontFamily:
          'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans JP, "Helvetica Neue", Arial',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 24 }}>RTNPX</h1>

      <section style={{ marginTop: 2 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <Controls
              cols={cols}
              rows={rows}
              onColsChange={(v) => {
                setCols(v);
                ensureFullSize(Math.max(fullGrid.length, rows), v);
              }}
              onRowsChange={(v) => {
                setRows(v);
                ensureFullSize(
                  Math.max(fullGrid.length, v),
                  Math.max(fullGrid[0]?.length || cols, cols)
                );
              }}
              cellWidth={cellWidth}
              onCellWidth={setCellWidth}
              cellHeight={cellHeight}
              onCellHeight={setCellHeight}
              alpha={alpha}
              onAlpha={setAlpha}
              onClear={() => {
                setFullGrid(makeEmptyGrid(rows, cols));
                setPalette([]);
                setSelected(0);
              }}
            />
            <PixelGrid
              rows={rows}
              cols={cols}
              cellWidthPx={cellWidthPx}
              cellHeightPx={cellHeightPx}
              palette={palette}
              grid={viewGrid}
              onCellPaint={applyPaint}
            />
          </div>

          <div style={{ minWidth: 260, flex: 1, marginTop: "10px" }}>
            <Palette
              palette={palette}
              selected={selected}
              onSelect={setSelected}
              onAddColor={addPaletteColor}
            />
            <UrlPane
              value={inputRaw}
              url={url}
              htmlUrl={htmlUrl}
              onChange={(v) => {
                setInputRaw(v);
                parseAndApplyUrl(v);
              }}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EditorApp />
    </Suspense>
  );
}
