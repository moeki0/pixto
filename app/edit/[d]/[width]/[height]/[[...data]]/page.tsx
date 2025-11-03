import { redirect } from "next/navigation";

type Params = {
  d: string;
  width: string;
  height: string;
  data?: string[];
};

export default function EditRedirect({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: Record<string, string | string[]>;
}) {
  const { d, width, height } = params;
  const data = params.data || [];
  const base = `/${d}/${width}/${height}`;
  const path = data.length ? `${base}/${data.join("/")}` : base;
  const sp = new URLSearchParams();
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "import" || k === "edit") continue;
      if (Array.isArray(v)) {
        for (const vv of v) sp.append(k, String(vv));
      } else if (v != null) {
        sp.set(k, String(v));
      }
    }
  }
  const q = sp.toString();
  const importValue = q ? `${path}?${q}` : path;
  const target = `/?import=${encodeURIComponent(importValue)}`;
  redirect(target);
}
