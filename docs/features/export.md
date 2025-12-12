# エクスポートユーティリティ

**カテゴリ**: 基本機能強化 | **優先度**: 推奨

文字起こし結果を各種フォーマットで出力する機能を実装する。

---

## 目的

- TXT / SRT / VTT 形式でのエクスポート機能
- ファイル保存機能

---

## テスト要件

### TypeScript (Vitest)

`src/lib/__tests__/export.test.ts`:

| テスト | 内容 |
|-------|------|
| toTXT | プレーンテキストを返す |
| toSRT | 正しいSRT形式を返す（インデックス付き） |
| toSRT | タイムスタンプが `HH:MM:SS,mmm` 形式 |
| toVTT | WEBVTT ヘッダーを含む |
| toVTT | タイムスタンプが `HH:MM:SS.mmm` 形式 |
| formatTimestamp (srt) | ミリ秒区切りがカンマ |
| formatTimestamp (vtt) | ミリ秒区切りがドット |
| exportResult | 各形式で正しく変換される |
| getExtension | 正しい拡張子を返す |

---

## 実装内容

### 1. エクスポート関数

`src/lib/export.ts` に以下の関数を実装：

| 関数 | 説明 |
|------|------|
| `toTXT(result)` | プレーンテキスト形式に変換（result.textをそのまま返す） |
| `toSRT(result)` | SRT (SubRip) 形式に変換 |
| `toVTT(result)` | WebVTT 形式に変換 |
| `formatTimestamp(ms, format)` | ミリ秒をタイムスタンプ形式に変換 |
| `exportResult(result, format)` | 指定形式で変換するラッパー関数 |
| `getExtension(format)` | ファイル拡張子を取得 |

### 2. タイムスタンプ形式

| 形式 | フォーマット | 例 |
|------|-------------|-----|
| SRT | `HH:MM:SS,mmm` | `00:01:23,456` |
| VTT | `HH:MM:SS.mmm` | `00:01:23.456` |

### 3. ResultViewer の更新

`src/components/transcription/ResultViewer.tsx` を更新：

- 出力形式選択のセレクトボックス（TXT / SRT / VTT）
- 保存ボタンの追加
- `@tauri-apps/plugin-dialog` の `save` でファイル保存ダイアログを表示
- `@tauri-apps/plugin-fs` の `writeTextFile` でファイル書き込み

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src/lib/__tests__/export.test.ts` | **テスト（先に作成）** |
| `src/lib/export.ts` | エクスポート関数 |
| `src/components/transcription/ResultViewer.tsx` | 更新 |

---

## 完了条件

- [ ] `pnpm test` で全テストが通る
- [ ] TXT形式で保存できる
- [ ] SRT形式で保存できる
- [ ] VTT形式で保存できる
