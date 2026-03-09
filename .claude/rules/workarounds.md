---
paths:
  - "src-tauri/src/whisper/**"
  - ".github/workflows/**"
  - "src-tauri/Cargo.toml"
---

# 既知の問題・ワークアラウンド

## whisper-rs 0.15.1: `set_abort_callback_safe` の UB バグ

`set_abort_callback_safe` に直接クロージャを渡すと、FFI トランポリン関数の型不一致により未定義動作が発生する。

**ワークアラウンド** (`src-tauri/src/whisper/process.rs`):

```rust
// NG: UB
params.set_abort_callback_safe(move || token.is_cancelled());

// OK: Box<dyn> にすることでトランポリンの型が一致
let abort_fn: Box<dyn FnMut() -> bool> = Box::new(move || token.is_cancelled());
params.set_abort_callback_safe(abort_fn);
```

**解消条件**: whisper-rs の修正版リリース後に除去可能。

## CI ビルド: GGML_NATIVE と SOURCE_DATE_EPOCH

CI ランナーで `GGML_NATIVE=ON`（デフォルト）が新しい命令セットを有効化しコンパイルエラーになる。

**ワークアラウンド** (`.github/workflows/release.yml`): `SOURCE_DATE_EPOCH` 環境変数を設定 → ggml が `GGML_NATIVE` をOFFにする。

**注意**: `GGML_NATIVE=OFF` 環境変数や `CFLAGS` では解決しない（cmake-rs の制約）。ローカルビルドはデフォルトのままで良い。
