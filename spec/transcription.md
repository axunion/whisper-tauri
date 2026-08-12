# 文字起こし (whisper / converter)

Source: `src-tauri/src/whisper/` / `src-tauri/src/converter/`

## パイプライン

```
入力ファイル ──(WAV 以外)──▶ converter (ffmpeg) ──▶ 16kHz mono s16 WAV (一時ディレクトリ)
                                                        │
録音 WAV (recording/) ─────────────────────────────────┤
                                                        ▼
                                          whisper: WAV ロード → (VAD 前処理) → 推論
```

## 変換 (converter)

- `convert_audio_file`: ffmpeg で `-ar 16000 -ac 1 -sample_fmt s16 -y` の WAV に変換。出力はシステム一時ディレクトリで、`cleanup_converted_file` は一時ディレクトリ内のパスしか削除しない (安全ガード)
- `get_audio_duration`: まず Symphonia (pure Rust) で取得し、失敗時は ffmpeg の stderr 出力パースにフォールバック
- ffmpeg バイナリは `{app_data}/bin/` に配置し、`.ffmpeg-version` マーカーで pin バージョン (`FFMPEG_MACOS_VERSION` = 8.1 等) と比較。取得元と更新手順は [binary-updates.md](binary-updates.md)

## Whisper モデル

Source: `src-tauri/src/whisper/models.rs`

| ID | ファイル | サイズ |
|---|---|---|
| `small` | `ggml-small.bin` | 466MB (488,636,416 bytes) |
| `large-v3-turbo` | `ggml-large-v3-turbo.bin` | 1.6GB (1,739,587,584 bytes) |

- 既定の取得元: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main` (設定キー `modelDownloadBaseUrl` で差し替え可)
- 保存先: `{app_data}/models/`
- ダウンロードは `.bin.part` に書いてから atomic rename (`download_model`、進捗は `model:download-progress`)
- 速度目安 (処理秒/音声1分) はアーキテクチャ別に定数化: aarch64 で turbo 3〜7 / small 1.5〜3.5、x86_64 で turbo 30〜90 / small 10〜30

## WAV ロード (`process.rs::load_wav_file`)

hound で読み込み、Int (ビット深度対応) / Float 両対応 → ステレオは平均で mono 化 (3ch 以上は `UnsupportedFormat`) → 16kHz でなければ線形補間でリサンプル。

## VAD 前処理 (`preprocess_with_vad`)

- **スタンドアロン API (`WhisperVadContext`) を使う。** whisper.cpp 内蔵の VAD 統合は `FullParams` の `vad_params` を無視するため使えない (詳細と除去条件は `.claude/rules/workarounds.md`)
- パラメータ値とその根拠は `.claude/rules/tuning.md` の Current Tuning Examples を一次ソースとする (デフォルト値からの意図的な調整)
- モデル: `ggml-silero-v5.1.2.bin` (`https://huggingface.co/ggml-org/whisper-vad` から `ensure_vad_model` が初回文字起こし時に自動 DL)
- 流れ: VAD セグメント (センチ秒単位) → サンプル範囲に変換 → 音声区間のみ連結して whisper へ。`TimestampMap` が「連結バッファ上の位置 → 元音声のタイムライン」を復元する
- 音声区間ゼロなら空の結果を返す (whisper を起動しない)
- VAD は設定 (`vadEnabled`、デフォルト ON) で切替可能。履歴には `vad_enabled` として記録される

## 推論 (`process.rs::transcribe`)

- `SamplingStrategy::Greedy { best_of: 5 }`、スレッド数 = `min(論理コア, 8)`
- 言語はオプション指定 (未指定なら whisper の自動判定に委ねる)
- 進捗: `set_progress_callback_safe` から `whisper:progress` を emit
- キャンセル: グローバル `TASK_MANAGER` (`Lazy<TaskManager>`、task_id → `CancellationToken` の map)。`cancel_transcription` がトークンを立て、abort コールバックが検知する
- **abort コールバックは `Box<dyn FnMut() -> bool>` に事前ボックス化して渡す** — whisper-rs の FFI 型不一致 UB の回避 (`.claude/rules/workarounds.md`)
- whisper のタイムスタンプはセンチ秒 → ms 変換時に負値を 0 にクランプ (発話冒頭でまれに負になるため)
- 実行は `spawn_blocking` 上 (`transcribe_audio` コマンド)

## コマンド一覧

`get_available_models` / `check_model_exists` / `download_model` / `delete_model` / `get_model_download_url` / `set_model_download_url` / `transcribe_audio` / `cancel_transcription` / `ensure_vad_model`
`check_ffmpeg_bundled` / `check_ffmpeg_needs_update` / `download_ffmpeg` / `delete_ffmpeg` / `get_audio_duration` / `convert_audio_file` / `cleanup_converted_file`
