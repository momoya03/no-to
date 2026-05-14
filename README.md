# PDF ノートメーカー

日本語 PPT（PDF）から学習ノートを自動生成するウェブアプリケーションです。

## 主な機能

- ✅ PDF アップロード（クリック・ドラッグ＆ドロップ）
- ✅ PDF テキスト抽出
- ✅ OCR 対応（画像PDF・スキャン資料）
- ✅ ノート自動生成（詳細モード・試験モード）
- ✅ ページごと表示・全体表示
- ✅ PDF/TXT エクスポート
- ✅ クリップボードコピー
- ✅ AI アシスタント内蔵
- ✅ レスポンシブデザイン（PC・スマホ対応）
- ✅ ダークモード対応

## 技術スタック

- Next.js 15
- TypeScript
- TailwindCSS
- shadcn/ui
- pdfjs-dist
- Tesseract.js
- react-pdf

## ローカルでの実行方法

1. リポジトリをクローンまたはコピーします

2. 依存パッケージをインストールします：
```bash
npm install
```

3. 環境変数ファイルをコピーします：
```bash
cp .env.example .env
```

4. 開発サーバーを起動します：
```bash
npm run dev
```

5. ブラウザで `http://localhost:3000` を開きます

## Vercel デプロイ方法

1. GitHub リポジトリにプッシュします

2. Vercel で新規プロジェクトを作成し、リポジトリをインポートします

3. 環境変数を設定します（必要に応じて）

4. デプロイを実行します

## 使い方

1. ホームページで PDF ファイルをアップロードします
2. 自動的に処理が開始されます
3. ノートページでは左側に PDF、右側に生成されたノートが表示されます
4. 必要に応じて表示モードを切り替えます
5. AI アシスタントに質問することもできます
6. 「エクスポート」ボタンで PDF または TXT 形式で保存できます

## モバイルでの保存

- iOS Safari: 「共有」メニューから「ファイルに保存」
- Android Chrome: ダウンロードボタンで直接保存
- Web Share API に対応しているブラウザでは共有メニューが表示されます

## AI アシスタントの設定（任意）

.env ファイルで以下の環境変数を設定することで、より高度な AI 機能を利用できます：

- `AI_PROVIDER`: openai / gemini / claude
- `OPENAI_API_KEY`: OpenAI API キー
- `GEMINI_API_KEY`: Gemini API キー
- `CLAUDE_API_KEY`: Claude API キー

## ライセンス

MIT
