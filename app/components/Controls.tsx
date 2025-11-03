"use client";

import { RxCross2 } from "react-icons/rx";

export function Controls(props: {
  cols: number;
  onColsChange: (v: number) => void;
  rows: number;
  onRowsChange: (v: number) => void;
  cellWidth: number;
  onCellWidth: (v: number) => void;
  cellHeight: number;
  onCellHeight: (v: number) => void;
  alpha: number;
  onAlpha: (v: number) => void;
  onClear: () => void;
}) {
  const {
    cols,
    onColsChange,
    rows,
    onRowsChange,
    cellWidth,
    onCellWidth,
    cellHeight,
    onCellHeight,
    alpha,
    onAlpha,
    onClear,
  } = props;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        margin: "10px 0",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        Canvas
        <label style={{ fontSize: 16, color: "#334155" }}>
          <input
            value={cols}
            onChange={(e) => onColsChange(Number(e.target.value))}
            style={{ width: 72, marginLeft: 6, fontSize: "16px" }}
          />
        </label>
        <RxCross2 />
        <label style={{ fontSize: 16, color: "#334155" }}>
          <input
            value={rows}
            onChange={(e) => onRowsChange(Number(e.target.value))}
            style={{ width: 72, marginLeft: 6, fontSize: "16px" }}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        Cell
        <label style={{ fontSize: 16, color: "#334155" }}>
          <input
            value={cellWidth}
            onChange={(e) => onCellWidth(Number(e.target.value))}
            style={{ width: 72, marginLeft: 6, fontSize: "16px" }}
          />
        </label>
        <RxCross2 />
        <label style={{ fontSize: 16, color: "#334155" }}>
          <input
            value={cellHeight}
            onChange={(e) => onCellHeight(Number(e.target.value))}
            style={{ width: 72, marginLeft: 6, fontSize: "16px" }}
          />
        </label>
      </div>
      <div>
        <button
          onClick={onClear}
          style={{
            padding: "6px 10px",
            borderRadius: "3px",
            border: "1px solid #999",
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
