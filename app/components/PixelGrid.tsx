"use client";
import { useEffect, useRef } from "react";

export type Grid = number[][];

export function PixelGrid(props: {
  rows: number;
  cols: number;
  cellWidthPx: number;
  cellHeightPx: number;
  palette: string[];
  grid: Grid;
  onCellPaint: (r: number, c: number, kind: "click" | "drag") => void;
}) {
  const { rows, cols, cellWidthPx, cellHeightPx, palette, grid, onCellPaint } =
    props;
  const paintingRef = useRef(false);
  const lastCellRef = useRef<{ r: number; c: number } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const up = () => (paintingRef.current = false);
    window.addEventListener("mouseup", up);
    window.addEventListener("mouseleave", up);
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mouseleave", up);
    };
  }, []);

  // Translate pointer position to cell (r, c). Clamped within bounds.
  const getCellFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor(x / cellWidthPx);
    const r = Math.floor(y / cellHeightPx);
    if (Number.isNaN(c) || Number.isNaN(r)) return null;
    if (c < 0 && r < 0) return null;
    return {
      r: Math.max(0, Math.min(rows - 1, r)),
      c: Math.max(0, Math.min(cols - 1, c)),
    };
  };

  // Bresenham line between two cells (inclusive)
  const cellsOnLine = (r0: number, c0: number, r1: number, c1: number) => {
    const cells: { r: number; c: number }[] = [];
    let x0 = c0,
      y0 = r0,
      x1 = c1,
      y1 = r1;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      cells.push({ r: y0, c: x0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return cells;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = gridRef.current;
    if (el && (e.target as Element)) {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
    }
    paintingRef.current = true;
    const cell = getCellFromEvent(e);
    if (cell) {
      lastCellRef.current = cell;
      onCellPaint(cell.r, cell.c, "click");
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!paintingRef.current) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    const last = lastCellRef.current;
    if (!last) {
      lastCellRef.current = cell;
      onCellPaint(cell.r, cell.c, "drag");
      return;
    }
    if (last.r === cell.r && last.c === cell.c) return;
    const line = cellsOnLine(last.r, last.c, cell.r, cell.c);
    for (const p of line) onCellPaint(p.r, p.c, "drag");
    lastCellRef.current = cell;
  };

  const endPaint = (e: React.PointerEvent<HTMLDivElement>) => {
    paintingRef.current = false;
    lastCellRef.current = null;
    const el = gridRef.current;
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  return (
    <div>
      <div
        style={{
          overflowX: "scroll",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <div
            ref={gridRef}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, ${cellWidthPx}px)`,
              gridTemplateRows: `repeat(${rows}, ${cellHeightPx}px)`,
              border: "1px solid #ccc",
              background: "#ffffff",
              boxShadow: "inset 0 0 0 1px #f1f5f9",
              userSelect: "none",
              touchAction: "none",
              cursor: "crosshair",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPaint}
            onPointerCancel={endPaint}
          >
            {grid.map((row, r) =>
              row.map((v, c) => {
                const DEFAULT_BLUE = "#2c7be5";
                const color =
                  v === 0 ? "#ffffff" : palette[v - 1] || DEFAULT_BLUE;
                return (
                  <div
                    key={`${r}-${c}`}
                    style={{
                      width: cellWidthPx,
                      height: cellHeightPx,
                      background: color,
                      outline: "1px solid #ccc",
                      boxSizing: "border-box",
                    }}
                    title={`${c + 1},${rows - r}`}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
