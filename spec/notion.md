# Notion 連携 (notion)

Source: `src-tauri/src/notion/` (`client.rs` / `commands.rs`) / `src/components/transcription/ResultViewer.tsx` / `src/lib/notion.ts`

文字起こし・AI 生成テキストを Notion データベースに新規ページとして送信する任意機能。ユーザー自身の integration token を使う。

## API

- `https://api.notion.com/v1`、`Notion-Version: 2022-06-28`、タイムアウト 30 秒
- `notion_test_connection`: DB の存在確認 + タイトルプロパティの自動検出
- `notion_create_page`: ページ作成本体

## 設定

settings.json のフラットキー: `notionEnabled` / `notionToken` / `notionDatabaseId` / `notionTitleProperty`。
トークンは**平文保存** (意図的な判断 — keyring 導入は依存最小化方針で見送り。REVIEW.md でもレビュー指摘対象外と明記)。設定 UI で「ローカルにのみ保存され外部に送信されない」ことを明示する。

## 送信セマンティクス: active タブの中身だけを送る

コピー / 保存と同じく、**ユーザーが開いているタブの内容のみ**を送信する。複数 representation (メタ + 要約 + 本文) を 1 ページに同梱しない — summary の二重表示を生んだ初期案からの転換 (2026-05-21)。

`ResultViewer.tabContent(tab)` が payload を決める:

| active タブ | body | summary (構造化) |
|---|---|---|
| summary | `""` | `session.summaryResult()` |
| cleanText / timeline / text | タブのテキスト (コピーと同一) | `null` |

- ページタイトルには summary / cleanText / timeline タブのときタブ種別サフィックスを付け、同一録音からの複数送信を区別可能にする (text タブはサフィックスなし)
- メタ情報 (録音日時 / モデル / VAD 等) は本体と独立した「常時付与」枠 — コピーには載せないが、外部送信には文脈情報として付ける

## ページ構造 (`client.rs::build_create_page_children`)

```
meta callout (📋、メタ情報を列挙)
→ 構造化要約ブロック (headline は heading_1、各セクションは heading_2 + paragraph / bulleted_list_item)
→ divider (上部と本文が両方あるときのみ)
→ 本文 paragraph 群
```

## Notion API 制限への対応

- 1 リクエスト最大 **100 ブロック**: 先頭 100 個を `POST /pages` に載せ、残りは 100 個ずつ `PATCH` で追記 (`split_children_for_create`)
- 1 ブロック最大 **2,000 字**: `chunk_string` で分割。タイトルも 2,000 字で切り詰め
- 追記バッチが失敗した場合はエラーにせず `NotionPageRef.partial = true` を立て、UI が「一部のみ送信」を警告する

## エラーの取り扱い

Notion API の生のレスポンスボディはユーザー向けエラーに echo しない — 構造化された `message` フィールドのみ表示し、なければステータス行にフォールバック (生ボディは開発時診断用に stderr へ)。リクエストデータがエラーボディに反射された場合の漏えい面を広げないための縦深防御。エラー prefix は `Notion API error` / `Invalid response from Notion API` (`src/lib/errors.ts::PREFIX_MAP` と同期)。

## コマンド一覧

`notion_get_settings` / `notion_set_settings` / `notion_test_connection` / `notion_create_page`
