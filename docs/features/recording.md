# リアルタイム録音機能

**カテゴリ**: 高度な機能 | **優先度**: 任意

マイク入力からの文字起こし機能を実装する。

---

## 目的

- マイク音声のキャプチャ
- リアルタイム音量可視化
- 録音データの文字起こし

---

## 録音データの扱い

| 項目 | 仕様 |
|------|------|
| 保存場所 | メモリ上のみ（ファイル保存しない） |
| 文字起こし後 | 破棄 |
| WAVエクスポート | 録音停止後に任意で保存可能 |
| 未保存時の終了 | 確認ダイアログを表示 |

### フロー

```
録音開始 → 録音停止 → [WAV保存?] → 文字起こし → 破棄
                          ↓
                    保存せず終了時は確認ダイアログ
```

---

## テスト要件

### Rust (cargo test)

`src-tauri/src/recording/capture.rs`:

| テスト | 内容 |
|-------|------|
| AudioCapture::new | 正常に作成できる |
| AudioCapture::list_devices | デバイス一覧を取得できる（空でも可） |
| RecordingLevel | level, peak_level が 0.0-1.0 の範囲 |

`src-tauri/src/recording/types.rs`:

| テスト | 内容 |
|-------|------|
| AudioDevice のシリアライズ | JSON出力がcamelCaseになる |
| RecordingLevel のシリアライズ | JSON出力がcamelCaseになる |

### TypeScript (Vitest)

`src/primitives/__tests__/createRecording.test.ts`:

| テスト | 内容 |
|-------|------|
| 初期状態 | devices が空配列 |
| 初期状態 | isRecording が false |
| loadDevices | `list_audio_devices` を invoke する |
| selectDevice | デバイスを選択できる |
| startRecording | `start_recording` を invoke する |
| startRecording | isRecording が true になる |
| stopRecording | `stop_recording` を invoke する |
| stopRecording | isRecording が false になる |
| stopRecording | samples が設定される |

---

## 実装内容

### 1. 型定義

#### TypeScript (`src/types/recording.ts`)

| 型 | プロパティ | 説明 |
|----|-----------|------|
| AudioDevice | id, name, isDefault | オーディオデバイス情報 |
| RecordingLevel | level, peakLevel | 録音レベル（0.0-1.0） |

#### Rust (`src-tauri/src/recording/types.rs`)

TypeScriptと対応する型を `#[serde(rename_all = "camelCase")]` で定義。

### 2. Rust依存パッケージ

`src-tauri/Cargo.toml` に追加：

| パッケージ | バージョン | 用途 |
|-----------|----------|------|
| cpal | 0.15 | クロスプラットフォームオーディオライブラリ |

### 3. Rust録音モジュール

`src-tauri/src/recording/` に以下を実装：

#### AudioCapture構造体

| メソッド | 説明 |
|---------|------|
| new() | 新規作成 |
| list_devices() | 入力デバイス一覧を取得 |
| start(device_id) | 録音開始 |
| stop() | 録音停止、サンプルを返す |
| get_level() | 現在の録音レベルを取得 |

#### Tauriコマンド

| コマンド | 説明 |
|---------|------|
| list_audio_devices | デバイス一覧取得 |
| start_recording | 録音開始 |
| stop_recording | 録音停止（サンプル返却） |
| get_recording_level | 現在の録音レベル取得 |

### 4. フロントエンドプリミティブ

`src/primitives/createRecording.ts` に以下を実装：

#### 状態

| プロパティ | 説明 |
|-----------|------|
| devices() | デバイス一覧 |
| selectedDevice() | 選択中のデバイス |
| isRecording() | 録音中フラグ |
| level() | 現在の録音レベル |
| samples() | 録音サンプルデータ |

#### アクション

| メソッド | 説明 |
|---------|------|
| loadDevices() | デバイス一覧を読み込み |
| selectDevice(device) | デバイスを選択 |
| startRecording() | 録音開始（50ms間隔でレベル取得） |
| stopRecording() | 録音停止 |

### 5. macOS権限設定

`src-tauri/tauri.conf.json` の `bundle.macOS.infoPlist` に以下を追加：

- `NSMicrophoneUsageDescription`: マイクアクセス権限の説明文

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src-tauri/src/recording/types.rs` | Rust型定義（**テスト含む、先に作成**） |
| `src-tauri/src/recording/capture.rs` | キャプチャ処理（**テスト含む、先に作成**） |
| `src/primitives/__tests__/createRecording.test.ts` | **テスト（先に作成）** |
| `src/types/recording.ts` | 録音型定義 |
| `src-tauri/src/recording/commands.rs` | Tauriコマンド |
| `src-tauri/src/recording/mod.rs` | モジュール定義 |
| `src/primitives/createRecording.ts` | 録音プリミティブ |

---

## 技術的注意点

- cpalはプラットフォームごとに異なるバックエンドを使用
- macOSではCoreAudioが使用される
- マイク権限はユーザーの許可が必要
- 録音サンプルは `f32` 形式で -1.0 から 1.0 の範囲

---

## 完了条件

- [ ] `cargo test` で全テストが通る
- [ ] `pnpm test` で全テストが通る
- [ ] マイクデバイス一覧が取得できる
- [ ] 録音が開始・停止できる
- [ ] 録音データを文字起こしできる
