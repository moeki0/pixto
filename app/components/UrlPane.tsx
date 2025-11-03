"use client";
import { useEffect, useMemo, useState } from "react";

export function UrlPane(props: {
  value: string;
  url: string;
  htmlUrl: string;
  onChange: (v: string) => void;
  onReset?: () => void;
}) {
  const { value, url, htmlUrl, onChange, onReset } = props;
  // Avoid hydration mismatch by rendering empty URL text until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ marginTop: 6 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          {url ? (
            <a
              href={mounted ? url : ""}
              style={{
                wordBreak: "break-all",
                background: "#eee",
                padding: "6px 10px",
                color: "#333",
                textDecoration: "none",
                borderRadius: "3px",
                border: "1px solid #999",
              }}
              suppressHydrationWarning
              target="_blank"
            >
              View SVG
            </a>
          ) : null}
          {htmlUrl ? (
            <a
              href={mounted ? htmlUrl : ""}
              style={{
                wordBreak: "break-all",
                background: "#eee",
                padding: "6px 10px",
                color: "#333",
                textDecoration: "none",
                borderRadius: "3px",
                border: "1px solid #999",
              }}
              suppressHydrationWarning
              target="_blank"
            >
              View HTML
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
