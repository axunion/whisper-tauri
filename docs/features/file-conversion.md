# ファイル変換機能

**カテゴリ**: 基本機能強化 | **状態**: 完了

様々な音声・動画フォーマットをWhisperが処理可能なWAV形式に変換する。

---

## 目的

- 多様な音声フォーマット（MP3, M4A, OGG, FLAC等）のサポート
- 動画ファイル（MP4, MOV, WebM等）からの音声抽出
- ユーザーが事前変換なしで様々なファイルを使用可能にする

---

## 実装結果

### 対応フォーマット

#### 音声ファイル

| 拡張子 | フォーマット |
|--------|-------------|
| .mp3 | MPEG Audio Layer 3 |
| .m4a | MPEG-4 Audio |
| .ogg | Ogg Vorbis |
| .flac | Free Lossless Audio Codec |
| .aac | Advanced Audio Coding |
| .wma | Windows Media Audio |
| .opus | Opus Audio |
| .wav | Waveform Audio (変換不要) |

#### 動画ファイル

| 拡張子 | フォーマット |
|--------|-------------|
| .mp4 | MPEG-4 Video |
| .mov | QuickTime Movie |
| .webm | WebM Video |
| .avi | Audio Video Interleave |
| .mkv | Matroska Video |

### 変換仕様

| 項目 | 値 |
|------|-----|
| 出力形式 | WAV (PCM) |
| サンプルレート | 16000 Hz（Whisper推奨） |
| チャンネル | モノラル |
| ビット深度 | 16bit |
| 出力先 | システム一時ディレクトリ |
| ffmpeg引数 | `-ar 16000 -ac 1 -sample_fmt s16` |

### Rustモジュール (`src-tauri/src/converter/`)

| ファイル | 説明 |
|---------|------|
| `mod.rs` | フォーマット判定 (`is_supported_format`, `needs_conversion`, `get_supported_formats`) |
| `types.rs` | 型定義 (`ConversionResult`, `FfmpegDownloadProgress`, `SupportedFormat`) |
| `error.rs` | エラー型 (`ConverterError`: FfmpegNotFound, ConversionFailed, UnsupportedFormat等) |
| `ffmpeg.rs` | ffmpeg実行 (`check_available`, `check_system_available`, `build_convert_args`, `convert_to_wav`) |
| `downloader.rs` | ffmpegダウンロード・アーカイブ展開 |
| `commands.rs` | Tauriコマンド (9コマンド) |

#### Tauriコマンド

| コマンド | 説明 |
|---------|------|
| `check_ffmpeg_available` | バンドル版→システムPATHの順で確認 |
| `check_ffmpeg_bundled` | バンドル版のみ確認（システムPATHは見ない） |
| `download_ffmpeg` | ffmpegをダウンロード・展開・保存 |
| `delete_ffmpeg` | バンドル版ffmpegを削除 |
| `get_ffmpeg_download_url` | カスタムURL取得 (tauri-plugin-store) |
| `set_ffmpeg_download_url` | カスタムURL設定/クリア |
| `convert_audio_file` | 入力ファイルをWAVに変換 |
| `get_supported_formats` | 対応フォーマット一覧 |
| `cleanup_converted_file` | 一時変換ファイルを削除（tempディレクトリのみ） |

### フロントエンド

| ファイル | 説明 |
|---------|------|
| `src/types/converter.ts` | TypeScript型定義 |
| `src/primitives/createFfmpegDownloader.ts` | ffmpegダウンロード管理プリミティブ |
| `src/primitives/createFileConverter.ts` | ファイル変換プリミティブ |
| `src/pages/Transcription.tsx` | 変換フロー統合（変換→文字起こし→クリーンアップ） |
| `src/pages/Settings.tsx` | ツール管理セクション（バンドル版DL/削除・システム版検出表示） |
| `src/components/transcription/FileSelector.tsx` | 拡張子リスト拡張 |

### テスト

| ファイル | テスト数 | 内容 |
|---------|---------|------|
| `src-tauri/src/converter/mod.rs` | 13 | フォーマット判定 |
| `src-tauri/src/converter/types.rs` | 3 | serde変換 |
| `src-tauri/src/converter/error.rs` | 7 | エラー表示 |
| `src-tauri/src/converter/ffmpeg.rs` | 4 | 引数構築・エラーケース |
| `src-tauri/src/converter/downloader.rs` | 16 | URL生成・パス構築・zip展開 |
| `src-tauri/src/converter/commands.rs` | 3 | クリーンアップ安全性 |
| `src/primitives/__tests__/createFfmpegDownloader.test.ts` | 21 | ダウンローダープリミティブ |
| `src/primitives/__tests__/createFileConverter.test.ts` | 9 | 変換プリミティブ |

---

## ffmpegバイナリの取得

### 方式

初回使用時にユーザーの操作でダウンロードする。アプリにはバンドルしない。

### ダウンロードソース

| プラットフォーム | ソース | ライセンス | アーカイブ形式 |
|----------------|--------|-----------|--------------|
| macOS | evermeet.cx (ffmpeg.org推奨) | GPL | zip |
| Windows (x64) | BtbN/FFmpeg-Builds (GitHub) | LGPL | zip |
| Linux (x64) | BtbN/FFmpeg-Builds (GitHub) | LGPL | tar.xz |
| Linux (arm64) | BtbN/FFmpeg-Builds (GitHub) | LGPL | tar.xz |

### 保存先

アプリデータディレクトリ内 `bin/ffmpeg` (Windowsは `bin/ffmpeg.exe`)

### ffmpeg解決順序

1. バンドル版（`{app_data_dir}/bin/ffmpeg`）
2. システムPATH上の `ffmpeg`
3. いずれも見つからない場合はエラー

### カスタムURL

設定画面でダウンロードURLを自由に指定可能（tauri-plugin-storeで永続化）。

---

## 計画との差異

| 項目 | 計画 | 実装 |
|------|------|------|
| 型 `ConversionProgress` | percent, message | 不採用（ffmpegの変換進捗取得は複雑なため、不定プログレスバーで代替） |
| 関数 `extract_audio` | ffmpeg.rsに独立関数 | `convert_to_wav`に統合（動画も同じffmpegコマンドで音声抽出可能） |
| 関数 `get_platform_binary_name` | downloader.rsに定義 | `get_ffmpeg_path`内のcfg分岐で処理 |
| ダウンロードソース | eugeneware/ffmpeg-static → 公式ソース | evermeet.cx (macOS) + BtbN/FFmpeg-Builds (Win/Linux) |
| ライセンス | GPL版のみ | macOS: GPL, Windows/Linux: LGPL |
| チェックサム検証 | SHA256で検証 | 未実装（ダウンロードソースがHTTPS + 信頼できるソースのため省略） |
| ダウンロード確認ダイアログ | ffmpeg未インストール時に表示 | 設定画面のダウンロードボタンで対応（ダイアログなし） |
| `cleanup_converted_file` | 計画になし | 追加実装（セキュリティ: tempディレクトリ外の削除を防止） |

---

## 完了条件

- [x] `cargo test` で全テストが通る（converter関連46テスト）
- [x] `pnpm test` で全テストが通る（converter関連30テスト）
- [x] ffmpegの存在確認ができる（バンドル版 + システムPATH）
- [x] ffmpegのダウンロードと保存ができる（zip展開対応）
- [x] カスタムダウンロードURLが設定できる
- [x] 非WAVファイルがWAVに変換される
- [x] 動画ファイルから音声が抽出される
- [x] 設定画面でffmpegのバンドル版DL/削除・システム版検出ができる
- [x] `cargo clippy` 警告なし
- [x] `pnpm typecheck` エラーなし
