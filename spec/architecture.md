# アーキテクチャ

Source: `src-tauri/src/lib.rs` / `src-tauri/tauri.conf.json` / `src-tauri/capabilities/default.json` / `src/App.tsx` / `src/lib/errors.ts`

ローカル完結の音声文字起こしデスクトップアプリ。Tauri 2 (Rust バックエンド) + SolidJS (フロントエンド)。identifier は `com.whisper-tauri.desktop`。モデル・バイナリは同梱せず、初回利用時に app data ディレクトリへダウンロードする。

## モジュール構成

### バックエンド (`src-tauri/src/`)

| モジュール | 責務 | 詳細 spec |
|---|---|---|
| `whisper/` | 文字起こし (whisper-rs) + Silero VAD 前処理 | [transcription.md](transcription.md) |
| `converter/` | 音声フォーマット変換 (ffmpeg) + 長さ取得 | [transcription.md](transcription.md) |
| `recording/` | マイク録音 (cpal) | [recording.md](recording.md) |
| `history/` | 履歴 (SQLite + FTS5) | [history.md](history.md) |
| `text_processing/` | ローカル LLM (llama-server) による要約・整形・タイトル生成 | [text-processing.md](text-processing.md) |
| `notion/` | Notion API 連携 | [notion.md](notion.md) |
| `settings.rs` | tauri-plugin-store (`settings.json`) の薄いラッパー | [settings.md](settings.md) |
| `update.rs` | 手動の更新確認 (GitHub Releases API) | [settings.md](settings.md) |
| `download.rs` | 共通ダウンロードヘルパー (ストリーミング + 100ms スロットルの進捗コールバック) | — |
| `paths.rs` | app data ディレクトリ解決 + UTF-8 パス変換 | — |

ドメインモジュールは `commands.rs` / `types.rs` / `error.rs` / `mod.rs` の共通構成。全コマンドとイベントは `lib.rs::ipc_builder` に登録する (現在 53 コマンド / 6 イベント)。ここから tauri-specta が `src/bindings.ts` (型付きの `commands` / `events` と IPC 型) を生成する。生成は `cargo test` の `bindings_are_up_to_date` が行い、コミット済みのファイルが古ければ書き換えたうえで失敗する。tauri-specta はリリース候補版のため `Cargo.toml` でバージョンを完全固定している。

**共有状態** (`lib.rs` の `.manage()`):
- `std::sync::Mutex<RecordingManager>` — 録音セッション
- `tokio::sync::Mutex<LlamaServerManager>` — llama-server 子プロセス。`RunEvent::Exit` で `shutdown()` を呼び、アプリ終了時に必ず停止する

**プラグイン**: `opener` / `dialog` / `fs` / `store` / `clipboard-manager` / `notification`

### フロントエンド (`src/`)

- ルーティング: `@solidjs/router` + `AppLayout` (サイドバーレイアウト)。ルートは `/` (Dashboard) / `/transcription` / `/history` / `/settings` (lazy)。`/dev` は `import.meta.env.DEV` のときのみマウントされる開発専用画面
- 状態管理: `src/primitives/` の `create*` ファクトリ (createWhisper / createRecording / createSettings / createAiSession など)。`createSettings` はモジュールレベル・シングルトンで `LazyStore("settings.json")` を包む
- 文字起こしの一連 (変換 → 推論 → 履歴保存 → 後始末) は `createTranscriptionJob` (モジュールレベル・シングルトン) が担う。実行は画面遷移をまたいで続くため、手順をページコンポーネントに置かない。履歴保存に成功するまで完了トーストを出さず、録音 WAV も消さない
- i18n: `src/i18n/` の独自 context ベース。ロケールは `ja` (デフォルト) / `en` の 2 つ。UI 文字列のハードコード禁止 (`.claude/rules/frontend-conventions.md`)
- 型: IPC を越える型は生成された `src/bindings.ts` が実体で、`src/types/` はそれを既存の名前で再エクスポートする (手書きで残るのはフロント専用の型と、`AiContent.contentType` を 3 種類に絞り込む型のみ)。serde の入出力で形が違う型は `_Serialize` / `_Deserialize` に分かれて生成され、`src/types/` は厳しい側の `_Serialize` を指す。`#[serde(rename_all = "camelCase")]` で IPC 境界を camelCase に統一。バックエンドの呼び出しは `invoke()` / `listen()` を直接使わず `commands.*` / `events.*` を通す

## IPC イベント (Rust → TS)

一次ソースはコード (各 payload 型の `#[tauri_specta(event_name = ...)]` と `lib.rs::ipc_builder` の `collect_events!`)。以下は参照用スナップショット。

| イベント | 用途 |
|---|---|
| `whisper:progress` | 文字起こし進捗 |
| `model:download-progress` | Whisper モデル DL 進捗 |
| `ffmpeg:download-progress` | ffmpeg DL 進捗 |
| `recording:level` | 録音レベル (約 50ms 間隔) |
| `text-processing:download-progress` | LLM モデル / llama-server DL 進捗 |
| `text-processing:inference-progress` | 推論進捗 (ストリーミングトークン) |

## app data レイアウト

macOS: `~/Library/Application Support/com.whisper-tauri.desktop/`

```
models/            # Whisper モデル (ggml-*.bin) + VAD モデル (ggml-silero-v5.1.2.bin)
text-models/       # LLM GGUF モデル
bin/               # ffmpeg (+ .ffmpeg-version) / llama-server (+ llama-server.version)
recordings/        # 未処理の録音 WAV ({uuid}.wav)
audio/             # 履歴に紐付いた録音音声 ({history_id}.wav)
history.db         # 履歴 SQLite
settings.json      # tauri-plugin-store (設定)
mirrors.json       # ダウンロード元の差し替え (任意・手編集)
```

## ネットワークエンドポイント

通信は「初回/更新時のダウンロード」と「ユーザーの明示的操作」に限定する (プライバシー原則)。**この表を変更したら公開版 `docs/src/content/docs/privacy.md` の表も同時に更新すること。**

| 接続先 | 内容 | 契機 |
|---|---|---|
| `huggingface.co` | Whisper モデル / Silero VAD / LLM GGUF | ユーザーの DL 操作 (VAD は初回文字起こし時に自動確保) |
| `evermeet.cx` | ffmpeg バイナリ (macOS) | ユーザーの DL 操作 / オンボーディング |
| `github.com` | ffmpeg (BtbN、Win/Linux) / llama-server (ggml-org/llama.cpp) | ユーザーの DL 操作 / オンボーディング |
| `api.github.com` | 更新確認 (`releases/latest`) | 設定画面の「更新を確認」ボタンのみ。自動チェックなし |
| `api.notion.com` | Notion ページ作成 / 接続テスト | ユーザーが連携を設定・送信したときのみ |
| `127.0.0.1:{port}` | llama-server (ローカル loopback) | AI テキスト処理の実行中 |

モデル / バイナリの取得元 URL は `{app_data}/mirrors.json` で差し替え可能 (社内ミラー等。手編集専用で設定 UI は無い — [settings.md](settings.md))。テレメトリ・自動通信は存在しない。

## セキュリティ設定

- `capabilities/default.json`: 各プラグインの `*:default` に加え、`fs:allow-write-text-file` (スコープなし — 書き込み先は保存ダイアログが実行時に許可する) と `fs:allow-copy-file` (`$APPDATA/recordings/*` のみ) を明示許可 (詳細は `.claude/rules/tauri-permissions.md`)、`clipboard-manager:allow-write-text`、window の set-size / set-min-size / center / show / destroy (destroy は終了ガード用 — 下記)
- CSP (`tauri.conf.json`): `default-src 'self'` ベース。`connect-src 'self' ipc: http://ipc.localhost` — WebView からの外部通信を遮断し、ネットワークアクセスはすべて Rust 側 (reqwest) に集約
- アセットプロトコル (`tauri.conf.json` の `assetProtocol`、Cargo の `protocol-asset` feature): 録音音声の再生用に有効化。scope は `$APPDATA/audio/*` のみで、CSP の `media-src` も `asset:` / `http://asset.localhost` に限る。アセットプロトコルの静的 scope はこのディレクトリだけ (ダイアログで選んだファイルは dialog プラグインが実行時に scope へ追加する)
- Rust は `unsafe_code = "forbid"`、clippy `pedantic` + `unwrap_used` / `expect_used` 警告

## ショートカットと画面内リンク

- `src/components/layout/Shortcuts.tsx`: 修飾キーは macOS では Cmd、それ以外では Ctrl (macOS の Ctrl+F / Ctrl+O はテキスト編集キーなので奪わない)。O (音声ファイルを選んで文字起こし画面へ。録音中と結果表示中は無効)、F (履歴検索にフォーカス)、`,` (設定)
- 設定画面へのリンクは `navigate("/settings", { state: { section } })` で該当セクションに着地する (`Settings.tsx::SettingsSection`、要素 id でスクロール)。未セットアップのバナー、AI 未設定ダイアログ、Notion 設定導線が使う

## 実行中の表示と完了通知

- サイドバーの `TranscriptionIndicator` が、変換中・推論中の進捗を全ページで表示する (クリックで `/transcription`)
- 履歴への保存に成功した時点で、ウィンドウが非フォーカスなら OS 通知を出す (`src/lib/notify.ts`、設定 `notifyOnComplete`)。前面にあるときはアプリ内トーストだけ。許可は求めない — デスクトップの通知プラグインは許可済みを返すだけで、ユーザーが OS 側で通知を切っていれば OS が黙って捨てる。通知はローカルの OS 機能で、ネットワークは使わない。`tauri dev` では Terminal の通知として出るため、実アプリとしての表示はバンドル版 (`/smoke`) でしか確認できない

## 終了ガード

`src/components/layout/CloseGuard.tsx` が `onCloseRequested` を購読し、録音中 / 文字起こし中 / 未処理の録音があるときはウィンドウを閉じる前に確認する。JS 側の `onCloseRequested` ラッパーは、中止されなければ自分で `destroy()` を呼ぶため `core:window:allow-destroy` が必須 (欠けるとウィンドウが閉じられなくなる)。

macOS の標準 Quit メニュー (Cmd+Q) は close-requested を経由せずプロセスを終了させるため、`lib.rs::build_menu` がアプリメニューの Quit をカスタム項目に差し替え、ウィンドウの `close()` 経由でガードを通す。**Dock の「終了」とシステムのシャットダウンはガードを通らない** (tao が `applicationShouldTerminate` を扱わないため。既知の制約)。

## エラー変換システム

全コマンドは `Result<T, IpcError>` を返す。`IpcError` (`src-tauri/src/ipc_error.rs`) は `code` (`ErrorCode`) と `message` を持ち、各エラー enum の `From<XxxError> for IpcError` が variant ごとにコードを決める (網羅 match なので、variant を足すとコードを割り当てるまでコンパイルが通らない)。フロントの `src/lib/errors.ts::parseError` は `code` からカテゴリ / i18n メッセージキー / 回復可能性を決め、`message` を詳細として表示する。非回復扱いは `MODEL_LOAD_ERROR` と `CANCELLED` のみ。コマンドに届く前の失敗 (権限不足など Tauri 自身の reject) は文字列で届くため `UNKNOWN_ERROR` になる。`ErrorCode` は `src/bindings.ts` に生成されるので両側の同期は不要。コードの選び方・追加手順は `.claude/rules/error-handling.md` を一次ソースとする。
