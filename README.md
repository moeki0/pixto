RTNPX - 汎用ピクセルSVG生成 API（Next.js）

実装: Next.js (App Router) のルートハンドラ

起動方法
- 前提: Node.js 18+ がインストール済み
- 依存インストール: npm install
- 開発起動: npm run dev (デフォルト: http://localhost:3000)
- 本番起動: npm run build && npm run start

エンドポイント（/r は right, /b は bottom）
- SVG（デフォルト/専用）
  - GET /r/{width}/{height}/{data}
  - GET /b/{width}/{height}/{data}
  - もしくは拡張子付き: /r/{...}/{data}.svg, /b/{...}/{data}.svg

- HTML プレビュー（OGP メタ付き、専用）
  - GET /r/{width}/{height}/html/{data}
  - GET /b/{width}/{height}/html/{data}
  - og:image は同じパスの PNG を指します（/r/{w}/{h}/png/{data}）

- OGP 用 PNG（専用・直接画像URLが必要なとき）
  - GET /r/{width}/{height}/png/{data}
  - GET /b/{width}/{height}/png/{data}
  - 画像サイズは ogw, ogh（既定 1200x630）

クエリ（共通）
- width: X 軸 1 単位の幅(px)
- height: Y 軸 1 単位の高さ(px)
- color: 塗り色（#22c55e, 22c55e, red, rgb(), rgba() など）
- alpha: 0〜1 の不透明度（省略時 1）
- gap: xGap,yGap をカンマ区切りで指定（省略時 0,0）
- yGap / xGap: 方向別に個別指定（gap より後勝ち）
- ラベル（任意・複数の書き方をサポート）
  - 行（Y）: `row1=ラベル`, `row2=ラベル` ...
  - 列（X）: `column1=ラベル`, `column2=ラベル` ...
  - 省略記法: `rows=ラベル1,ラベル2,...` / `columns=ラベル1,ラベル2,...`
  - 別名: `y=...` / `x=...`, `ylabel=...` / `xlabel=...`
  - 汎用: `label=y:ラベル1,ラベル2` / `label=x:W1,W2`
    - 日本語の「の」や全角コロンもOK: `label=yのラベル1,ラベル2`, `label=x：W1,W2`

data の書き方（新記法のみ、エンコード不要）
- 列区切り: /（スラッシュ）
- 列内のセグメント区切り: _（アンダースコア）
- 範囲: -（ハイフン）
  - 1-5 = 1〜5
  - -5  = 1〜5
  - 3-  = 3〜maxY
  - 4   = 4のみ
  - 空列は /_/ のようにアンダースコアで明示（// ではなく）

動作仕様
- 原点は左上の (0,0)。コンテンツは余白ゼロから開始
- SVG サイズは (maxX*width + (maxX-1)*xGap) × (maxY*height + (maxY-1)*yGap)
- Y 軸はサーバー側で反転（大きい Y ほど上方向に描画）
- 表示は「塗り潰しセル」方式（枠線なし／グリッドなし）
- /b は全体を 90 度回転して描画

使用例
- SVG: http://localhost:3000/r/10/5/10-20/5-12/1-3/8-9
- HTML: http://localhost:3000/r/10/8/html/4-6_9
- PNG: http://localhost:3000/r/10/8/png/4-6_9?ogw=1200&ogh=630
- ラベル付き例: http://localhost:3000/r/10/5/3-5/2-4/1-3?label=yの上,中,下&columns=W1,W2,W3

エラーレスポンス
- 不正または不足パラメータ時は 400 + エラーメッセージ入り SVG/PNG/HTML を返却


カラー指定（パレット）
- セグメント末尾に `.ラベル` を付けると、クエリの `pal_ラベル=カラー` で色を指定できます
- 列全体のデフォルトは列先頭で `~ラベル`（例: `~c2 1-3 5-6.c3`）
- パレットの最初の色（最初に現れた pal_*）は `.c1` を省略できます（ラベルなしでOK）
- pal_* が 1 つも無い場合はデフォルト色（青 `#2c7be5`）が使われます
  - `pal_*` に `#2c7be5` を入れてもサーバー側では既定色として扱うためパレットに入りません
 - 直接色指定（パレット不要）: `.green`, `.36d96c`, `.0x36D96C`, `.rgb(54,217,108)`, `.rgba(54,217,108,0.8)` のように、ドットの後にCSSカラーを記述可能です
   - パレットキーに一致しない場合は、直接色として解釈されます
