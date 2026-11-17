# 録音 (recording)

Source: `src-tauri/src/recording/` (`capture.rs` / `sleep_guard.rs` / `commands.rs`)

cpal によるマイク録音。停止時に Whisper 入力形式の WAV を書き出す。

## キャプチャ (`capture.rs::RecordingManager`)

- cpal のストリームは `Send` でないため、**専用スレッド** (`std::thread::spawn`) 上でストリームを構築・保持する。`RecordingManager` 自体は `std::sync::Mutex` で Tauri の managed state に載る
- 入力コンフィグ選択 (`select_input_config`): まずデバイスのデフォルトコンフィグをそのまま使い、取得できない場合のみ f32 フォーマット優先 + 最高サンプルレートでフォールバック選択する (チャンネル数は選択基準にしない)。コールバックは f32 / i16 / u16 の 3 系統に対応し、ステレオ等はいずれも mono に変換して蓄積
- レベルメーター: 約 50ms 間隔 (`LEVEL_EMIT_INTERVAL_MS`) で `recording:level` イベント (RMS + peak) を emit
- 一時停止 (`set_paused`、コマンド `pause_recording` / `resume_recording`): 入力ストリームは動かしたまま、一時停止中の音声を捨てる。ストリーム自体の pause は全デバイスバックエンドで使えるわけではなく、再開時の再オープンは失敗や別コンフィグ選択があり得るため。録音にはその区間の音声が含まれず、録音時間にも数えない
- 停止時 (`stop`): 蓄積サンプルを 16kHz にリサンプルし、**32-bit float mono WAV** を `{app_data}/recordings/{uuid}.wav` に書き出して返す
- `recordings/` にあるのは**まだ文字起こしされていない録音**だけ。文字起こしが履歴に保存されると WAV は `audio/{history_id}.wav` へ移動し、その履歴の音声になる ([history.md](history.md) の「録音音声」)
- `cleanup_recording`: 録音の破棄用。クラッシュ等で残った WAV は設定画面の「データ管理」から削除できる

## スリープ抑止 (`sleep_guard.rs`)

- macOS のみ: 録音中 `caffeinate -d` を spawn してディスプレイスリープを抑止。spawn 失敗は警告ログのみで録音は続行 (ベストエフォート)。ガードの drop でプロセス終了
- macOS 以外は no-op

## コマンド一覧

`list_audio_devices` / `start_recording` (デバイス ID 指定可) / `pause_recording` / `resume_recording` / `stop_recording` / `cleanup_recording`
