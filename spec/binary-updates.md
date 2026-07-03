# バイナリ更新

同梱バイナリ (ffmpeg / llama-server) と LLM モデル (GGUF) の手動更新フロー。
**メジャーリリース時に同梱を更新**する。アプリ内自動更新は行わない。

各リリース前にこのチェックリストを上から順に実施する。

---

## 1. 対象

| 対象 | 役割 | 取得元 | 定数の場所 |
|---|---|---|---|
| **ffmpeg** | 音声フォーマット変換 | evermeet.cx (macOS) / BtbN/FFmpeg-Builds (Win/Linux) | `src-tauri/src/converter/downloader.rs` |
| **llama-server** | LLM 推論サーバー | github.com/ggml-org/llama.cpp Releases | `src-tauri/src/text_processing/models.rs` |
| **GGUF テキストモデル** | LLM 重み (gemma-4-e2b / qwen3.5-4b) | HuggingFace | `src-tauri/src/text_processing/models.rs` |

**このフローの対象外:**
- Whisper モデル (`ggml-*.bin`): 設定画面からユーザーがダウンロードし、`whisper` モジュール内で管理する。`whisper` モジュールには (GGUF テキストモデルと違い) legacy クリーンアップ機構がないため、Whisper モデルを廃止する際は `scripts/dev-reset.sh` の `STALE_WHISPER_MODELS` にファイル名を追記し、開発用クリーンアップスクリプトで孤児ファイルを削除できるようにする。
- Silero VAD (`ggml-silero-v5.1.2.bin`): pin 固定、更新頻度は低い

---

## 2. 方針

- **手動更新のみ。** アプリ内自動更新はしない — ローカル LLM はサイレントな回帰の影響が大きすぎる
- **メジャーリリースに追従する。** 未成熟な破壊的変更を避けるため、採用まで 1〜2 サイクル待つ
- **CVE アラートはこのペースに優先する** (ffmpeg / llama.cpp とも前例あり)
- **ffmpeg は LGPL ビルドを使う。** GPL コーデック (x264 / x265 / aac-fdk) は音声 → wav 変換に不要
- **llama.cpp の細かい `b<N>` リリースはスキップする**。アップグレードコストが利得に見合わない

---

## 3. 更新対象ファイル

### ffmpeg

`src-tauri/src/converter/downloader.rs`:

| 定数 | 例 | 用途 |
|---|---|---|
| `FFMPEG_MACOS_VERSION` | `"8.1"` | evermeet.cx のリリースバージョン |
| `FFMPEG_BTBN_TAG` | `"autobuild-2026-03-26-13-16"` | BtbN/FFmpeg-Builds のリリースタグ |
| `FFMPEG_BTBN_BUILD_ID` | `"N-123625-gfd9f1e9c52"` | BtbN アセットファイル名内のビルド ID |

取得元:
- macOS: <https://evermeet.cx/ffmpeg/>
- Win/Linux: <https://github.com/BtbN/FFmpeg-Builds/releases>
  - `*-lgpl.{zip,tar.xz}` を含む最新の `autobuild-*` タグを選ぶ
  - `build_id` はアセット名 `ffmpeg-<BUILD_ID>-<suffix>` から読み取る

### llama-server

`src-tauri/src/text_processing/models.rs`:

| 定数 | 例 | 用途 |
|---|---|---|
| `LLAMA_SERVER_VERSION` | `"b8672"` | llama.cpp のリリースタグ (`b<N>`) |

取得元: <https://github.com/ggml-org/llama.cpp/releases>

補足:
- `b<N>` は単調増加。プラットフォーム別アセット名 (例: `llama-{version}-bin-macos-arm64.tar.gz`) は `get_default_server_url()` が組み立てる
- **CLI フラグを検証すること。** `src-tauri/src/text_processing/server.rs` のフラグ (`--port` / `--ctx-size` / `--threads` など) が新バージョンでも有効か確認する — §4 でカバー

### GGUF テキストモデル

`src-tauri/src/text_processing/models.rs`:

| 場所 | 用途 |
|---|---|
| `VALID_MODEL_IDS` | サポート対象 ID — 追加/削除はここ |
| `get_model_filename` | ID → GGUF ファイル名のマッピング |
| `get_default_model_base_url` | HuggingFace のベース URL (`/resolve/main` まで) |
| `LEGACY_MODEL_IDS` / `legacy_model_filename` | 廃止モデルのクリーンアップ (下記「モデルの廃止」参照) |

i18n の同期を忘れない:
- `src/i18n/dictionaries/ja.ts` / `src/i18n/dictionaries/en.ts` — `models.text.<id>` (`name` / `description`)

#### モデルの廃止

新モデルが既存モデルを置き換えるとき、`src-tauri/src/text_processing/models.rs` を更新すれば設定画面の「レガシーモデル」カードが自動で有効になる:

1. 廃止する ID を `VALID_MODEL_IDS` から削除 (`get_model_list()` のエントリも)
2. 同じ ID を `LEGACY_MODEL_IDS` に追加
3. ID → GGUF ファイル名のマッピングを `legacy_model_filename` に追加:

   ```rust
   match model_id {
       "gemma-4-e2b" => Some("google_gemma-4-E2B-it-Q4_K_M.gguf"),
       _ => None,
   }
   ```

あわせて廃止した `models.text.<id>` の i18n エントリを削除し、その ID を参照するテストフィクスチャを差し替える。

---

## 4. 更新手順

### 4.1 事前確認

- [ ] **リリースノートを読む**
  - [ ] ffmpeg: CVE を最優先で確認。まれにある後方非互換の変更もチェック
  - [ ] llama-server: 破壊的変更 (CLI フラグ / REST API / GGUF フォーマット) を確認。`b<N>` のジャンプは数百コミットに及ぶことがある
  - [ ] GGUF モデル: HuggingFace リポジトリで再量子化やメタデータ修正がないか確認
- [ ] **ライセンスが変わっていないこと** (§5 参照)
- [ ] **CI ワーカーの依存が変わっていないこと** (例: `libwebkit2gtk-4.x` のメジャーバンプ)

### 4.2 定数のバンプ

- [ ] `src-tauri/src/converter/downloader.rs` を更新 (ffmpeg、定数 3 つ)
- [ ] `src-tauri/src/text_processing/models.rs` の `LLAMA_SERVER_VERSION` を更新 (llama-server)
- [ ] `src-tauri/src/text_processing/models.rs` のモデル定義を更新 (GGUF の追加/削除)
- [ ] i18n を同時に更新 (`models.text.<id>`)
- [ ] pin 値・モデル表を記載する他ドキュメントも更新: `README.md` / `spec/transcription.md` / `spec/text-processing.md`

### 4.3 ローカルで再ダウンロード

バージョンマーカー (`bin/.ffmpeg-version` / `bin/llama-server.version`) が古くなるとアプリが自動で再ダウンロードする。

- [ ] アプリを起動し DevMenu / 設定から再ダウンロードを実行する。**または** app data を消して起動時に再ダウンロードさせる:
  ```bash
  rm "$HOME/Library/Application Support/com.whisper-tauri.desktop/bin/ffmpeg"
  rm "$HOME/Library/Application Support/com.whisper-tauri.desktop/bin/.ffmpeg-version"
  rm "$HOME/Library/Application Support/com.whisper-tauri.desktop/bin/llama-server"
  rm "$HOME/Library/Application Support/com.whisper-tauri.desktop/bin/llama-server.version"
  ```

### 4.4 スモークテスト (ゴールデンパス)

- [ ] **ffmpeg**: 複数フォーマット (mp3 / m4a / mov / mp4) → wav 変換
- [ ] **llama-server**: `text_processing` の起動パス経由でクラッシュせず起動する
- [ ] **clean_text**: 短い入力が通る
- [ ] **summary**: 短 (<1500 字)・中 (1500〜5000)・長 (>5000、チャンク経路) がすべて通る
- [ ] **chat / generate_title**: 両方通る
- [ ] **VAD 経路**: 録音 → 文字起こしを VAD ON / OFF 両方で実施 (ffmpeg 経路のサニティチェックを兼ねる)

### 4.5 CI / リリースチェック

- [ ] `cargo fmt --all -- --check` / `cargo clippy --all-targets -- -D warnings` / `cargo test`
- [ ] `pnpm check` / `pnpm test:run`
- [ ] `release.yml` の `workflow_dispatch` (build-only) を実行し、3 OS すべてのビルドが通ることを確認
- [ ] CHANGELOG / リリースノートに更新を記載
- [ ] 新しい workaround があれば `.claude/rules/workarounds.md` に追記

---

## 5. ライセンス

| バイナリ / モデル | ライセンス | 補足 |
|---|---|---|
| ffmpeg (BtbN LGPL) | LGPL 2.1+ | x264 / x265 / aac-fdk なし。wav 変換には十分 |
| ffmpeg (evermeet.cx) | LGPL ベース (ビルド依存) | リリースごとに evermeet.cx のビルドフラグを再確認する |
| llama.cpp | MIT | 再配布に寛容 |
| Gemma | Gemma Terms of Use | 商用利用可。一部リポジトリは初回ダウンロード時に Google アカウントでの同意が必要 |
| Qwen | Apache 2.0 | 商用利用可 |

GPL コーデックが必要になった場合 (動画エンコード、高度な音声コーデック) は配布モデルを見直す。

---

## 6. API 安定性メモ

### llama.cpp

- **REST API は安定** (`/v1/chat/completions` などの OpenAI 互換エンドポイント)
- **CLI フラグは変わる。** `src-tauri/src/text_processing/server.rs` のフラグ (`--port` / `--ctx-size` / `--threads` / `--n-gpu-layers`) をリリースごとに再検証する
- **GGUF フォーマットはおおむね後方互換**だが、メジャーバンプ (例: v3 → v4) では再量子化が必要になることがある

### ffmpeg

- **CLI フラグ** (`-i` / `-ar` / `-ac` / `-f wav` / `-vn`) は安定しており非互換は想定しない
- **evermeet.cx の URL パスはメジャーバージョンで変わる** (7.x → 8.x でパス構成が変更された)
- **BtbN の autobuild タグ体系は安定** (`autobuild-YYYY-MM-DD-HH-MM`)。`build_id` (`N-<数値>-g<hash>`) は git short hash 由来

---

## 7. 対象外 (必要になるまで見送り)

- **SHA256 完全性チェック** (ffmpeg / llama-server / GGUF): バンプのたびに 4 つの取得元 (evermeet.cx / BtbN / ggml-org / HuggingFace) からハッシュを取る必要がある。当面は HTTPS で十分とし、CVE や改ざん事案が出たら再検討
- **起動時の UI バナー**: 比較 API (`ffmpeg_needs_update` / `is_server_version_current`) は実装済み。設定画面の「再ダウンロード推奨」バナーは別タスク
- **アプリ内自動更新**: 挙動の再現性を保つため意図的に不採用
- **`scripts/check-binary-updates.sh`** (pin と各取得元の最新の差分チェック): 現在のリリース頻度ではメンテコストに見合わない。このチェックリストが省略されがちになったら再検討
- **Dependabot 連携**: ffmpeg / llama-server は Dependabot の GitHub リリースモデルの外で pin されている。HuggingFace モデルも同様
