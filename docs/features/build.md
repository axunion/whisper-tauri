# プロダクトビルド

**カテゴリ**: 配布準備 | **優先度**: 完了

各プラットフォーム向けの配布可能なアプリケーションをビルドする。

---

## 目的

- macOS / Windows / Linux 向けにビルド
- コード署名・公証による信頼性確保（シークレット設定時）
- CI/CD による自動ビルド

---

## 対象プラットフォーム

| OS | 形式 | 署名 |
|----|------|------|
| macOS (ARM64) | .dmg, .app | Apple Developer ID + Notarization（任意） |
| Windows | .msi, .exe | コード署名証明書（任意） |
| Linux | .deb, .AppImage | 不要 |

---

## 実装内容

### 1. Cargo.toml — whisper-rs のプラットフォーム条件付き依存

macOS では Metal アクセラレーションを有効にし、他プラットフォームではフィーチャーなしでビルドする:

- `[dependencies]` から `whisper-rs` を削除
- `[target.'cfg(target_os = "macos")'.dependencies]` に `features = ["metal"]` 付きで追加
- `[target.'cfg(not(target_os = "macos"))'.dependencies]` にフィーチャーなしで追加

### 2. tauri.conf.json — バンドル設定

- `bundle.macOS.minimumSystemVersion: "10.15"` を追加
- bundle identifier を `com.whisper-tauri.desktop` に変更（後述の「計画との乖離」参照）

### 3. CI/CD（GitHub Actions）

`.github/workflows/release.yml` を新規作成。

**トリガー**:
- `v*` タグの push → 自動でドラフトリリース作成
- `workflow_dispatch`（手動実行）→ `build-only` または `release` を選択可能

**ビルドマトリクス**:

| Runner | ターゲット | 成果物 |
|--------|----------|--------|
| `macos-latest` | aarch64-apple-darwin | .dmg, .app |
| `ubuntu-22.04` | x86_64-unknown-linux-gnu | .deb, .AppImage |
| `windows-latest` | x86_64-pc-windows-msvc | .msi, .exe |

**whisper.cpp ビルド設定**: `GGML_NATIVE=OFF` を全プラットフォームで設定し、ランナー固有の CPU 命令セットへの最適化を無効化。配布バイナリの幅広い CPU 互換性を確保する。

**コード署名**: GitHub Secrets 経由で設定可能。シークレット未設定時は署名なしビルド。

---

## 計画との乖離

### bundle identifier の変更

当初 `com.whisper-tauri.app` だった identifier を `com.whisper-tauri.desktop` に変更した。Tauri が `.app` で終わる identifier は macOS のアプリケーションバンドル拡張子と競合すると警告を出し、DMG バンドル時に不整合が生じたため。

### workflow_dispatch の追加

当初はタグ push のみをトリガーとしていたが、CI の動作確認を安全に行うため `workflow_dispatch` による手動実行を追加した。`build-only` モードではリリースを作成せずビルドのみを検証できる。

---

## 作成・更新ファイル

| ファイル | 操作 | 説明 |
|---------|------|------|
| `src-tauri/Cargo.toml` | 編集 | whisper-rs をプラットフォーム条件付きに |
| `src-tauri/tauri.conf.json` | 編集 | macOS バンドル設定追加、identifier 変更 |
| `.github/workflows/release.yml` | 新規 | リリースワークフロー |

---

## 完了条件

- [x] `pnpm tauri build` でローカルビルドが成功
- [x] macOS向け .dmg が生成される
- [ ] Windows向け .msi が生成される（CI で検証）
- [ ] Linux向け .deb / .AppImage が生成される（CI で検証）
- [x] GitHub Actions でリリースビルドが自動実行される
