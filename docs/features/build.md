# プロダクトビルド

**カテゴリ**: 配布準備 | **優先度**: 推奨

各プラットフォーム向けの配布可能なアプリケーションをビルドする。

---

## 目的

- macOS / Windows / Linux 向けにビルド
- コード署名・公証による信頼性確保
- CI/CD による自動ビルド

---

## 対象プラットフォーム

| OS | 形式 | 署名 |
|----|------|------|
| macOS | .dmg, .app | Apple Developer ID + Notarization |
| Windows | .msi, .exe | コード署名証明書（任意） |
| Linux | .deb, .AppImage | 不要 |

---

## 実装内容

### 1. Tauri ビルド設定

`src-tauri/tauri.conf.json` を更新：

- アプリ名・バージョン・アイコン設定
- バンドル識別子（bundle identifier）
- 各プラットフォーム固有設定

### 2. コード署名（macOS）

- Apple Developer Program 登録
- Developer ID Application 証明書
- `tauri.conf.json` に署名設定を追加
- Notarization（公証）の設定

### 3. CI/CD（GitHub Actions）

- タグプッシュ時に自動ビルド
- 各プラットフォーム用のランナー（macOS, Windows, Ubuntu）
- ビルド成果物をリリースにアップロード

---

## 作成・更新ファイル

| ファイル | 説明 |
|---------|------|
| `src-tauri/tauri.conf.json` | ビルド設定 |
| `src-tauri/icons/` | アプリアイコン |
| `.github/workflows/release.yml` | リリースワークフロー |

---

## 完了条件

- [ ] `pnpm tauri build` でローカルビルドが成功
- [ ] macOS向け .dmg が生成される
- [ ] Windows向け .msi が生成される
- [ ] Linux向け .deb / .AppImage が生成される
- [ ] GitHub Actions でリリースビルドが自動実行される
