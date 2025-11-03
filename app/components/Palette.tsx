"use client";

import { useEffect, useRef, useState } from "react";
import { BsEraser } from "react-icons/bs";

export function Palette(props: {
  palette: string[];
  selected: number;
  onSelect: (idx: number) => void;
  onAddColor: (hex: string) => void;
}) {
  const { palette, selected, onSelect, onAddColor } = props;

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const Current = () => {
    const idx = selected - 1;
    const isColor = idx >= 0 && palette[idx] != null;
    const c = isColor ? palette[idx] : undefined;
    return (
      <button
        aria-label={isColor ? `Selected color: c${selected}` : "Open palette"}
        onClick={() => setOpen((v) => !v)}
        title={isColor && c ? `c${selected}: ${c}` : "パレットを開く"}
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          border: `2px solid ${c === "#ffffff" ? "#333" : "#aaa"}`,
          background: c || "#fff",
          cursor: "pointer",
        }}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        marginBottom: "20px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <button
        aria-label="Eraser"
        onClick={() => {
          onSelect(0);
          setOpen(false);
        }}
        title="消しゴム"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          padding: 0,
          borderRadius: 6,
          border: `2px solid ${selected === 0 ? "#f01d24" : "#aaa"}`,
          background: "#ffffff",
          cursor: "pointer",
        }}
      >
        <BsEraser />
      </button>

      <Current />
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: 56,
            left: 10,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            width: 280,
            maxWidth: "calc(100vw - 40px)",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ddd",
            boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
            background: "#fff",
            zIndex: 10,
          }}
        >
          {palette.map((c, i) => (
            <button
              key={i}
              onClick={() => {
                onSelect(i + 1);
                setOpen(false);
              }}
              title={`c${i + 1}: ${c}`}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: `2px solid ${
                  selected === i + 1
                    ? "#f01d24"
                    : c === "#ffffff"
                    ? "#333"
                    : "#aaa"
                }`,
                background: c,
                cursor: "pointer",
              }}
            />
          ))}

          <ColorAdder onAddColor={(hex) => onAddColor(hex)} />
        </div>
      )}
    </div>
  );
}

function ColorAdder({ onAddColor }: { onAddColor: (hex: string) => void }) {
  let dirty = false;
  let current = "#22c55e";
  return (
    <input
      type="color"
      defaultValue={current}
      style={{ minWidth: 34, minHeight: 34, cursor: "pointer" }}
      onChange={(e) => {
        current = e.currentTarget.value;
        dirty = true;
      }}
      onBlur={() => {
        if (dirty && current) onAddColor(current);
        dirty = false;
      }}
    />
  );
}
