# 設定と更新確認 (settings / update)

Source: `src-tauri/src/settings.rs` / `src-tauri/src/update.rs` / `src/primitives/createSettings.ts` / `src/types/settings.ts`

## 永続化

すべて tauri-plugin-store の `settings.json` ({app_data} 直下) に保存する。1 ストアに 2 種類のキーが同居する:

### 1. フロントエンドの `app_settings` (単一オブジェクト)

`createSettings` (モジュールレベル・シングルトン) が `LazyStore("settings.json")` の `app_settings` キーに読み書きする。読み込みは `DEFAULT_SETTINGS` とマージ (欠損キーはデフォルトで補完)。

| キー | 型 | デフォルト |
|---|---|---|
| `language` | `"ja" \| "en"` | `"ja"` |
| `theme` | `"light" \| "dark" \| "system"` | `"system"` |
| `whisperLanguage` | `string \| null` | `null` (自動判定) |
| `whisperModelId` | `string \| null` | `null` |
| `textModelId` | `string \| null` | `null` |
| `onboardingCompleted` | `boolean` | `false` |
| `vadEnabled` | `boolean` | `true` |

注意: `whisperModelId` / `textModelId` は型として存在するが、Transcription 画面のモデル選択はダウンロード済みモデルから実行時に導出しており、これらのフィールドによる選択永続化の配線は未確認 (仕様として保証しない)。

### 2. バックエンドのフラットキー (文字列)

`settings.rs` (get / set / delete の薄いラッパー、単発 + バッチ) 経由で Rust 側が直接読み書きする。

| キー | 用途 |
|---|---|
| `modelDownloadBaseUrl` | Whisper モデルの取得元差し替え |
| `ffmpegDownloadUrl` | ffmpeg の取得元差し替え |
| `textModelDownloadBaseUrl` | LLM GGUF の取得元差し替え |
| `textServerDownloadUrl` | llama-server の取得元差し替え |
| `notionEnabled` / `notionToken` / `notionDatabaseId` / `notionTitleProperty` | Notion 連携 ([notion.md](notion.md)) |

カスタム URL キーは未設定ならコード内のデフォルト URL を使う。社内ミラーなどへの差し替え用。

## 更新確認 (`update.rs`)

- `check_latest_version`: `GET https://api.github.com/repos/axunion/whisper-tauri/releases/latest` から `tag_name` を返す。タイムアウト 10 秒、User-Agent 必須 (ないと GitHub API が 403)
- **ユーザー起点のみ** — 自動チェックは行わない。「ネットワークアクセスはモデル DL と明示的なユーザー操作に限る」というプライバシー原則による (コード内コメントにも明記)
- FE 側は設定画面の「更新を確認」ボタン (`createUpdateCheck`) が `getVersion()` と `src/lib/version.ts::isNewerVersion` (semver-lite、ローカル > リモートは最新扱い) で比較し、結果をインライン表示。オフライン時はエラーを握りつぶさず「確認できませんでした」を出す
- アプリ本体の更新は手動ダウンロード運用 (`docs/install.md` の Updating 節)。`tauri-plugin-updater` は未署名ビルドの UX が悪く不採用
