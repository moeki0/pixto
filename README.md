汎用 SVG 生成 API (シングルバイナリ)

実装: Next.js (App Router) のルートハンドラで `GET /` が直接 SVG を返します。

起動方法
- 前提: Node.js 18+ がインストール済み
- 依存インストール: `npm install`
- 開発起動: `npm run dev` (デフォルト: http://localhost:3000)
- 本番起動: `npm run build && npm run start`

- エンドポイント
- `GET /index.svg` でグラフSVGを返します。
- `GET /` および `GET /index` で OGP メタ付きのプレビューHTMLを返します（`og:image` は `/og` を指します）。
- `GET /og` で OGP 画像（PNG, 既定 1200x630）を返します。

必須クエリ
- `direction=right|bottom` 描画方向（bottom は全体を90度回転）
- `data` カンマ区切りで各列を並べます（左から X=1,2,3,...）。列内は `|` で複数セグメントを指定できます（すべて1始まり）。
  - `Y0:Y1` … Y の範囲を塗り潰し（例: `10:20`）
    - 省略記法: `:Y1` は `1:Y1` と同じ
  - `Y` … 1〜Y を塗り潰し（例: `5` は Y=1〜5）
  - セグメント結合: `10:12|15|20:22`（Y=10〜12 と 15 と 20〜22 を塗る）

サイズクエリ
- `width`  X 軸 1 単位の幅(px)
- `height` Y 軸 1 単位の高さ(px)

任意クエリ
- `color`: 全セル共通の塗り色 (CSS 名称/16進/rgba)。
- `alpha`: 0〜1 の不透明度。既定 0.35（薄め）。
- `yGap`: Y方向のギャップ(px)。旧 `rowGap` 互換。
- `xGap`: X方向のギャップ(px)。旧 `colGap` 互換。
- `yN`: Y軸ラベル（Nは1..maxY）。旧 `rowN` 互換。
- `xN`: X軸ラベル（Nは1..maxX）。旧 `columnN` 互換。
- `xLabel`/`xLabels`: カンマ区切りでX軸ラベルを一括指定（例: `xLabel=W1,W2,W3`）。`xN` より優先。
- `yLabel`/`yLabels`: カンマ区切りでY軸ラベルを一括指定（例: `yLabel=A,B,C`）。`yN` より優先。

動作仕様
- 原点は左上の `(0,0)` に固定。コンテンツは余白ゼロで始まります。
- SVG サイズは `(maxX*width + (maxX-1)*xGap)` × `(maxY*height + (maxY-1)*yGap)`（Xラベルがある場合、下側に余白を加算）
  - maxY は `data` 内で指定された最大の Y をそのまま採用（1始まり）
- Y 軸はサーバー側で反転（大きい Y ほど上方向に描画）
 - 表示は「塗り潰しセル」方式:
  - `direction=right`: 通常向き（X 右方向、Y 上方向）で塗り潰し
  - `direction=bottom`: グラフ全体を 90 度回転して表示
  - セルの枠線は描画しません（stroke なし）
  - 図（グリッド/枠線/背景）は描画しません
  - ラベル: `xN` は下側に、`yN` は左側に表示（direction=bottom でも論理X/Yとして扱い回転に追従）
  - ラベル: `xN` は下側に、`yN` は左側に表示（direction=bottom でも論理X/Yとして扱い回転に追従）

使用例
- 例1: 範囲で指定（y=10〜20, 5〜12, 1〜3, 8〜9）
  - `http://localhost:3000/index.svg?direction=right&width=10&height=5&data=10:20,5:12,1:3,8:9&color=22c55e`

- 例2: 単値（1〜Y の塗り潰し）を混在
  - `http://localhost:3000/index.svg?direction=right&width=20&height=8&data=5,3:12,4,10:20&color=green&x1=W1&x2=W2&y1=A&y2=B`
  - 16進カラーは `#` を URL エンコードするか、`#` なしでも指定可能（例: `color=%2322c55e` または `color=22c55e`）。

  - 色を薄く: `&alpha=0.3` などで調整

- ラベル付与
  - `http://localhost:3000/index.svg?direction=bottom&width=16&height=12&data=3:8,2:6,4:7,1:5&x1=W1&x2=W2&x3=W3&x4=W4&y1=A&y2=B&y3=C&y4=D`

OGP 連携
- HTMLプレビュー（OGPメタ付き）: `http://localhost:3000/index?direction=right&width=12&height=8&data=10:20,5:12,1:3&color=22c55e`
  - `og:image` は同クエリで `/og` を指します（PNG）。
  - 直接画像URLが必要な場合は `/og?...` を `og:image` に指定してください。

エラーレスポンス
- 不正または不足パラメータ時は 400 + エラーメッセージ入り SVG を返却します。

注意
- `data` の Y は 0 以上の数値を想定しています（負値は 400）。
- 明示 X を使用する場合は 1 以上の整数を推奨します。
- `direction` は互換のため必須ですが、セル描画では挙動に影響しません。
