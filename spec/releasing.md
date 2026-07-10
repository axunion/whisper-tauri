# リリース手順と CI 運用

リリースフローの手順と、CI / リリースビルドの運用知見をまとめる。
知見の多くは `spec/improvements.md` (旧 #13 / #14) からの移送 (2026-07-10)。議論の経緯は git log を一次ソースとする。

## リリースフロー

`/release [version]` スキルが以下を一気通貫で自動化する。手動で行う場合も同じ順序。

1. **バージョン整合**: `package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json` の 3 ファイルのバージョンを一致させる (`Cargo.lock` の追従も忘れない)
2. **Preflight**: working tree が clean であること、`/verify all` が green であることを確認
3. **リリースノート案**: 前回タグ以降のコミットログから草稿を作る
4. **タグ作成 & push**: `v*` タグの push が `release.yml` をトリガーする (workflow_dispatch でも起動可)
5. **CI 監視**: 3 プラットフォーム (macOS / Windows / Linux) のマトリクスビルドを見届ける。成果物は draft release にアップロードされる (`releaseDraft: true`)
6. **公開**: draft の内容 (リリースノート・artifact 一式) を確認して手動で publish する

アプリ側の更新導線は手動運用 (詳細は `docs/install.md` の Updating 節): ユーザーは Settings の「Check for Updates」か GitHub Watch / `releases.atom` で新版を知り、上書きインストールする。

## CI 運用 (旧 #13)

- **Rust toolchain の齟齬**: ローカルと CI stable のバージョン差で「ローカル green / CI fail」が起きる。`rustup update stable` でローカルを追従させる運用 (`rust-toolchain.toml` 固定は tuning.md の「標準設定優先」に反するため不採用)
- **`#[cfg(target_os = ...)]` ガード下の lint**: macOS ローカル clippy では Linux/Windows 固有コードの lint がスキップされる。Linux 固有コードを書いた直後は CI run を見るまで完了扱いにしない
- **Linux deps 必須リスト**: `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf libasound2-dev` (cpal が ALSA を要求。ci.yml / release.yml で同期)
- **SOURCE_DATE_EPOCH**: CI で `GGML_NATIVE=OFF` を効かせるため必須 (`.claude/rules/workarounds.md`)
- **ビルド時間目安**: backend ジョブ初回 5〜6 分、rust-cache ヒットで 1〜3 分

## リリースビルド運用 (旧 #14)

- **`bundle.targets: "all"` + CI の `--bundles` 上書き**: macOS `app` / Windows `nsis` / Linux `deb,appimage`。ローカルで素の `pnpm tauri build` を叩くとホスト OS のフル形式が作られる
- **release.yml の `if` 分岐 2 回は仕様上正しい形**: tauri-action は `APPLE_CERTIFICATE` 等 env var の存在 (空文字含む) で codesign を自動起動するため統合不可 (f4fee36 で revert 済み)
- **install.md のファイル名プレースホルダー**: 初リリース時に実 artifact 名を見て微調整する余地あり。F10 の照合 (2026-07-11) で Linux 2 件の不一致を確認済み — 実ビルド出力は `Whisper Tauri_<version>_amd64.deb` / `.AppImage` (install.md は小文字ハイフン表記)。さらに GitHub は release asset 名のスペースをドットに置換する (`Whisper.Tauri_...` になる見込み) ため、draft release の実 asset 名を見て install.md を一括修正すること
- **Windows / Linux は実機検証未実施 (2026-07-11, F10)**: 実機・VM の確認手段がないため CI ビルド green の確認のみ。リリースノートに既知の制約として明記すること (実機検証が済んだらこの行を削除)
- **macOS は Install.command zip 経路のみ**: `.dmg` は署名なしダブル経路で UX が分散するため意図的に作らない
- **macOS Gatekeeper 事情 (2026-07 調査)**: macOS 15 Sequoia で「右クリック→開く」回避が廃止され、未署名物の初回起動は全ユーザーが「システム設定 → プライバシーとセキュリティ → このまま開く」経路を通る (macOS 26 Tahoe でさらに強化)。`ditto --noqtn` の quarantine 除去は引き続き有効で、Install.command 方式は未署名配布のほぼベストプラクティス。Homebrew は未署名 cask を 2026-09 に公式 Tap から排除予定のため配布経路として不採用
- **ad-hoc 署名 (`signingIdentity: "-"`)**: .app 直接起動時に「壊れています」(復旧不可) ではなく「検証できませんでした」(このまま開くで復旧可) になる保険として設定 (Tauri 公式推奨)。config ベースで tauri CLI 自身が `codesign -s -` するため、上記 tauri-action の APPLE_* env var 問題とは経路が別
- **hardened runtime とマイク entitlement**: tauri の codesign は hardened runtime をデフォルト有効にするため、署名導入と同時に `Entitlements.plist` (`com.apple.security.device.audio-input`) を追加した。これがないと録音 (cpal) がマイクにアクセスできない。署名変更後は /smoke で録音の実機確認を必ず行うこと
- **正式リリース時の完全解**: Apple Developer Program ($99/年) + Developer ID 署名 + notarization のみが警告を完全に消せる。加入すれば Homebrew cask 配布も解禁される。正式リリース時に加入を検討すること

## ドキュメントサイトのデプロイ (F9, 2026-07-10)

- `docs/` は VitePress でビルドし GitHub Pages に公開する。`.github/workflows/docs.yml` が main への `docs/**` 変更 push で自動デプロイ (公開 URL: `https://axunion.github.io/whisper-tauri/`)
- ローカル確認: `pnpm docs:dev` / `pnpm docs:build` (dead-link 検査込み) / `pnpm docs:preview`
- 初回のみ手動設定が必要: リポジトリ Settings → Pages → Source を **GitHub Actions** にする
