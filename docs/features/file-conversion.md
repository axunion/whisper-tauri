# ファイル変換機能

**カテゴリ**: 機能拡張 | **優先度**: 推奨

様々な音声・動画フォーマットをWhisperが処理可能なWAV形式に変換する。

---

## 目的

- 多様な音声フォーマット（MP3, M4A, OGG, FLAC等）のサポート
- 動画ファイル（MP4, MOV, WebM等）からの音声抽出
- ユーザーが事前変換なしで様々なファイルを使用可能にする

---

## テスト要件

### Rust (cargo test)

`src-tauri/src/converter/mod.rs`:

| テスト | 内容 |
|-------|------|
| is_supported_format | 対応フォーマットを正しく判定する |
| is_supported_format | 非対応フォーマットを正しく判定する |
| needs_conversion | WAVは変換不要と判定される |
| needs_conversion | MP3は変換必要と判定される |

`src-tauri/src/converter/ffmpeg.rs`:

| テスト | 内容 |
|-------|------|
| check_ffmpeg | ffmpegの存在確認ができる |
| build_convert_args | 正しい引数が生成される |

### TypeScript (Vitest)

`src/primitives/__tests__/createFileConverter.test.ts`:

| テスト | 内容 |
|-------|------|
| 初期状態 | isConverting が false |
| 初期状態 | progress が 0 |
| convert | `convert_audio_file` を invoke する |
| convert | 変換中は isConverting が true |
| convert | 完了後に outputPath が設定される |
| checkSupport | `check_ffmpeg_available` を invoke する |

---

## 実装内容

### 1. 対応フォーマット

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

### 2. Rust変換モジュール

`src-tauri/src/converter/` に以下を実装：

#### 型定義 (`types.rs`)

| 型 | 説明 |
|----|------|
| ConversionProgress | 変換進捗（percent, message） |
| ConversionResult | 変換結果（output_path, duration） |
| SupportedFormat | 対応フォーマット列挙型 |

#### ffmpeg連携 (`ffmpeg.rs`)

| 関数 | 説明 |
|------|------|
| check_available() | ffmpegがインストールされているか確認 |
| convert_to_wav(input, output) | 入力ファイルをWAVに変換 |
| extract_audio(video, output) | 動画から音声を抽出 |

#### Tauriコマンド (`commands.rs`)

| コマンド | 説明 |
|---------|------|
| check_ffmpeg_available | ffmpegの存在確認 |
| convert_audio_file | ファイルを変換 |
| get_supported_formats | 対応フォーマット一覧取得 |

### 3. フロントエンドプリミティブ

`src/primitives/createFileConverter.ts` に以下を実装：

#### 状態

| プロパティ | 説明 |
|-----------|------|
| isConverting() | 変換中フラグ |
| progress() | 変換進捗（0-100） |
| ffmpegAvailable() | ffmpegが利用可能か |

#### アクション

| メソッド | 説明 |
|---------|------|
| checkSupport() | ffmpegの存在確認 |
| convert(filePath) | ファイルを変換してパスを返す |
| getSupportedFormats() | 対応フォーマット一覧取得 |

### 4. 変換仕様

| 項目 | 値 |
|------|-----|
| 出力形式 | WAV (PCM) |
| サンプルレート | 16000 Hz（Whisper推奨） |
| チャンネル | モノラル |
| ビット深度 | 16bit |
| 出力先 | 一時ディレクトリ |

### 5. UIへの統合

- ファイル選択時に自動で変換が必要か判定
- 変換が必要な場合はプログレスバーを表示
- ffmpegが未インストールの場合はエラーメッセージを表示

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src-tauri/src/converter/types.rs` | Rust型定義（**テスト含む、先に作成**） |
| `src-tauri/src/converter/ffmpeg.rs` | ffmpeg連携（**テスト含む、先に作成**） |
| `src-tauri/src/converter/commands.rs` | Tauriコマンド |
| `src-tauri/src/converter/mod.rs` | モジュール定義（**テスト含む、先に作成**） |
| `src/primitives/__tests__/createFileConverter.test.ts` | **テスト（先に作成）** |
| `src/primitives/createFileConverter.ts` | 変換プリミティブ |
| `src/types/converter.ts` | TypeScript型定義 |

---

## 技術的注意点

- ffmpegは外部依存として扱い、未インストール時は適切にエラーハンドリング
- 変換は一時ファイルに出力し、文字起こし完了後にクリーンアップ
- 大きなファイルの変換には時間がかかるため、進捗表示が重要
- macOSではHomebrewでffmpegをインストール可能（`brew install ffmpeg`）
- Windowsではchocolateyまたは公式バイナリ

---

## 完了条件

- [ ] `cargo test` で全テストが通る
- [ ] `pnpm test` で全テストが通る
- [ ] ffmpegの存在確認ができる
- [ ] MP3ファイルがWAVに変換できる
- [ ] MP4ファイルから音声が抽出できる
- [ ] 変換進捗が表示される
- [ ] ffmpeg未インストール時にエラーメッセージが表示される
