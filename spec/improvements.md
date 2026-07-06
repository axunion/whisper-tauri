# 改善案メモ

プレリリースから**ファーストリリースまでの仕上げタスク**と、温めている改善アイデアを集約するドキュメント。

> **このファイルは開発中の作業ドキュメント。リリース時にこのファイルのみ削除する (`spec/` の他ファイルは恒久)。**
> `docs/` は公開ツリー (英語専用、将来 GitHub Pages のソース)。`spec/` は恒久的な開発・仕様ドキュメント (日本語)。恒久的に必要な知見は削除前に `docs/` / `spec/` / `.claude/rules/` に移す。

> 方針: `.claude/rules/tuning.md` に従い、独自チューニングで弱点を隠すより一般的な設定・標準的な UX に寄せる。

---

## 進捗サマリー

ステータスは `未着手 / 進行中 / 完了 / 保留` の4段階。
**1項目ずつ片付ける運用**なので、`進行中` は同時に1つだけにする。
完了したらこの表と各セクション末尾の `Status:` 行を両方更新する。

旧 #1〜#19 (カテゴリ A〜E) は 2026-06-11 に消し込み済み。経緯と結論は git log のこのファイルの履歴と各コミットを一次ソースとする。残すべき知見は本ファイル末尾の「引き継ぎ知見」と `spec/binary-updates.md` に移送済み。

**F カテゴリ = ファーストリリース準備**。表の並び = 推奨実施順。

| #   | Cat | 項目                                   | 優先 | Status   | メモ |
|-----|-----|----------------------------------------|------|----------|------|
| F1  | F   | ドキュメント体制の再構成               | 高   | 完了 (2026-06-11) | 2026-07-03 に spec/ へ再編 (F1 追記参照) |
| F2  | F   | 更新手順の整備 (install.md + 更新確認ボタン) | 中   | 完了 (2026-06-11) | 方針 (c) 確定済み: 手動 DL + Watch/RSS 案内 + 手動チェック |
| F3  | F   | 開発用クリーンアップスクリプト         | 中   | 完了 (2026-06-15) | scripts/dev-reset.sh + pnpm dev:reset |
| F4  | F   | テストの見直し                         | 高   | 完了 (2026-07-07) | リファクタ前の安全網 |
| F5  | F   | リファクタ最終パス                     | 中   | 完了 (2026-07-07) | 手動リファクタで実施済み |
| F6  | F   | セキュリティ最終チェック               | 高   | 完了 (2026-07-07) | 先行して実施済み |
| F7  | F   | 品質監査バンドル (i18n / a11y / 型同期) | 中   | 未着手   | F5/F6 と並行可 |
| F8  | F   | ライセンス・クレジット整備             | 高   | 未着手   | ffmpeg LGPL 表記など。docs/ の 1 ページに |
| F9  | F   | ユーザードキュメント執筆 + Pages 公開  | 高   | 未着手   | 機能フリーズ後に着手 |
| F10 | F   | 実機最終確認                           | 高   | 未着手   | 内容は着手前に別途詰める (placeholder) |

---

# F. ファーストリリース準備

## F1. ドキュメント体制の再構成

**結論 (2026-06-11)**: ディレクトリの役割を 3 層に固定した。

```
docs/        ← 公開ツリー (英語のみ、GitHub Pages のソースになる予定)
notes/       ← 開発中の作業ドキュメント (日本語可、リリース前に削除)
.claude/     ← AI 向けルール (公開しない)
```

- `improvements.md` を `notes/` へ移動し、完了済みの旧 #1〜#19 を消し込み
- `binary-updates.md` を `docs/dev/` へ移動し、旧 #8 の「LLM 廃止時の運用手順」を英訳して統合 (Retiring a model 節)
- `CLAUDE.md` の参照パスを更新
- 公開サイトの目次案とレンダリング方式 (VitePress 推奨 / Jekyll 省力) の確定は F9 で行う

**追記 (2026-07-03)**: 体制を再編し `spec/` を新設、`notes/` を廃止した。

```
docs/        ← 公開専用 (英語、GitHub Pages のソース)。開発者向けを置かない
spec/        ← 恒久的な開発・仕様ドキュメント (日本語)
.claude/     ← AI 向けルール (英語、公開しない)
```

- `docs/dev/binary-updates.md` → `spec/binary-updates.md` に移設 + 日本語化 (`docs/dev/` は廃止)
- `notes/improvements.md` → `spec/improvements.md` に移設 (`notes/` は廃止)。リリース時削除の対象はこのファイル単体になった
- 確定済み実装仕様を `spec/` に 7 ファイルで文書化 (architecture / transcription / text-processing / history / recording / notion / settings)
- `docs/privacy.md` を作成 (UI 非依存で仕様確定済みのため F9 から前倒し)

**Status:** 完了 (2026-06-11) / 再編 (2026-07-03)

---

## F2. 更新手順の整備 (install.md + アプリ内「更新を確認」)

**背景**: アプリ自体の更新戦略は **方針 (c) = 手動ダウンロード運用** で確定 (2026-06-11)。`tauri-plugin-updater` は未署名ビルドでは体験が悪く導入しない。起動時の**自動**新版チェックは「ネットワーク通信はモデル DL と明示的な Notion 送信のみ」というプライバシー原則と衝突するため不採用 (バックログに温存)。**ユーザー起点の通信なら Notion 送信と同じ整理ができる**ため、手動の「更新を確認」ボタンまでを本項目の範囲とする。

**案 1: `docs/install.md` に「Updating」節を追加**

- 各 OS とも「新バージョンを上書きインストールするだけ」であることを明記 (macOS: Install.command 再実行 / Windows: 新 setup.exe 実行 / Linux: dpkg -i or AppImage 差し替え)
- アプリデータ (設定・履歴・モデル) はアプリ本体と別ディレクトリにあり、更新で消えないことを明記
- Releases ページへのリンクで新版確認
- **新版に気づく経路の案内**: GitHub の Watch → Custom → Releases で通知を受け取れること、RSS 派向けに `releases.atom` フィードがあることを 1〜2 行で記載

**案 2: Settings に「更新を確認」ボタン**

- BE: `check_latest_version` コマンドを 1 本追加。GitHub `releases/latest` API (`https://api.github.com/repos/<owner>/<repo>/releases/latest`) を reqwest (notion モジュールで使用済み) で叩き、`tag_name` を返す。FE fetch だと http plugin + capability 追加が必要になるため BE 経由
- FE: Settings に SectionRow + 「更新を確認」ボタン。`@tauri-apps/api/app` の `getVersion()` と比較し、「最新です」/「新バージョン vX.Y.Z があります → Releases を開く」を表示
- 未認証 API は 60 回/時の制限だが手動ボタンなら実質問題なし。オフライン時はエラーを握りつぶさず「確認できませんでした」を表示
- モジュールは新設せず既存構成に乗せる方向で着手時に判断 (/add-command)

**実装メモ (2026-06-11)**: BE は新規トップレベル単一ファイル `src-tauri/src/update.rs` (download.rs / paths.rs の先例に従う)。GitHub API は User-Agent 必須のため client builder で設定。バージョン比較は `src/lib/version.ts` の `isNewerVersion` (semver-lite、ローカル > リモートは最新扱い)。UI は General カード末尾の SectionRow + インライン結果表示。

**Status:** 完了 (2026-06-11)

---

## F3. 開発用クリーンアップスクリプト

**背景**: 開発時にアプリ状態 (settings / history / models / bin) や WebView キャッシュが残り、「変更前のクリーンな状態」に戻すのが手作業。廃止 Whisper モデル (`ggml-medium.bin` / `ggml-large-v3.bin`) も開発機ローカルに残存しており、アプリ UI は削除手段を持たない (旧 #8 の判断)。

**前提調査 (2026-06-11)**: Tauri 公式 CLI にアプリデータ削除コマンドは存在しない。公式 API は runtime の `clearAllBrowsingData()` (webview) のみで、開発時リセットは「app data ディレクトリ削除 + `cargo clean`」をスクリプト化するのがコミュニティの一般的手法。

**案**: `scripts/dev-reset.sh` + `package.json` に `dev:reset` スクリプトを追加。対象 (macOS):

```
~/Library/Application Support/com.whisper-tauri.desktop/   # settings / history / models / bin
~/Library/Caches/com.whisper-tauri.desktop/                # キャッシュ
~/Library/WebKit/com.whisper-tauri.desktop/                # WKWebView データ (localStorage 等)
```

- まずは macOS のみ対応 (開発機が macOS のため)。Win/Linux パスは必要になったら追加

**方針転換 (2026-06-15)**: フルリセット案は撤回。「UI で削除できるものはスクリプト対象外」に絞り込んだ。アプリ UI には現行モデル・LLM モデル・バイナリ・履歴・設定すべてに削除手段があるため、スクリプトの責務は **UI から手の届かない蓄積物 + ビルド/キャッシュ起因の不具合解消** のみとする。

**実装メモ (2026-06-15)**: `scripts/dev-reset.sh` + `package.json` の `dev:reset` で実装。

- 既定 (フラグなし) = 以下3つをまとめて削除:
  - `--stale-models`: `models/` 内の廃止 Whisper モデル (`ggml-medium.bin` / `ggml-large-v3.bin`) のみ。現行モデルには触れない。whisper には text_processing のような legacy 機構がないためファイル名はスクリプト内にハードコード (廃止時に追記が必要)
  - `--recordings`: `recordings/` (UI 操作なしで残る孤児 WAV)
  - `--cache`: `~/Library/Caches/<id>` + `~/Library/WebKit/<id>`
- `--build` (`cargo clean`) は再ビルドコストが大きいため既定に含めず opt-in
- 撤回: フルリセット / `--models` / `--bin` / `--settings` / `--history` (すべて UI で削除可能)
- 削除前に対象一覧を表示して確認プロンプト (`--yes` でスキップ)、存在しないパスは一覧から除外、対象ゼロなら "Nothing to do"
- 堅牢化 (コードレビュー反映): bundle identifier は `tauri.conf.json` から `node -p` で読む (ドリフト防止) / アプリ起動中は pgrep ガードで実行拒否 / `HOME` 空ガード / 確認プロンプト EOF 時も "Aborted." を表示

**Status:** 完了 (2026-06-15)

---

## F4. テストの見直し

**背景**: リファクタ (F5) の前に安全網を張る。

**案**: カバレッジの穴の棚卸し — 特に IPC 境界、error 変換 (`errors.ts::PREFIX_MAP` と Rust error prefix の同期)、`lib/notion.ts` 等の純関数。壊れやすい / 実装詳細に依存したテストの修正もここで。

**実装メモ (2026-07-07)**: 4 本柱で実施。

1. **PREFIX_MAP 同期テスト新設** (`src/lib/__tests__/errorPrefixSync.test.ts`): Rust ソースの `#[error("...")]` を `import.meta.glob` で全抽出し PREFIX_MAP と双方向照合。棚卸しで発覚した既存ドリフト 11 prefix (recording 系全滅・notion 設定系・`Path error:` 等) を既存 ErrorCode の範囲で補完。意味の合う既存コードが無い録音系などは意図的 UNKNOWN 割当として明示 (details は表示される)。録音系専用 ErrorCode + i18n 文言の新設はバックログ (下記) へ
2. **未テスト大物**: `createTextProcessing.test.ts` (36 tests) / `notion/types.rs` serde テスト (13 tests、全 types.rs のうち唯一の未テストだった)
3. **壊れやすいテスト修正**: Button.test.tsx の Tailwind クラス依存 → 挙動ベース化、コンポーネントテストの日本語文言リテラル → ja 辞書参照化 (辞書変更に自動追従)、BE の固定 temp パス書き込み → `tempfile::TempDir` 化
4. **小粒**: createNotionShare / createNotionSettings / createAiActions テスト (34 tests)、i18n プレースホルダのロケール間パリティ検証

結果: FE 327→401 tests / BE 364→377 tests、`/verify all` green。テスト規約上の残課題: `createTextProcessing` / `createNotionSettings` はモジュールレベル singleton に `_resetForTesting` フックが無く、テストは `vi.resetModules()` で回避している (兄弟 primitive との規約差。F5 リファクタで揃える余地あり)。

**Status:** 完了 (2026-07-07)

---

## F5. リファクタ最終パス

**案**: `/refactor-fe` + `/refactor-be` を主要モジュールに一巡。機能追加はせず、抽出・統合・dead code 削除・unwrap/expect 根絶に限定。

**追記 (2026-07-07)**: スキル一巡ではなく手動リファクタで実施済みのため完了扱い (直近の ModelDownloadAction 抽出・dead code 削除・モジュール可視性の絞り込みなどのコミット群)。

**Status:** 完了 (2026-07-07)

---

## F6. セキュリティ最終チェック

**案**: `security-reviewer` agent + `/security-review` を実施。重点: Notion トークン平文保存の扱い明文化 (F9 の privacy ページにも反映)、capabilities scope、SQL 構築、パス検証、ログへの秘匿情報漏れ。

**追記 (2026-07-07)**: F4/F5 に先行して実施済みのため完了扱い。Notion トークン平文保存は keyring 依存追加を避けて仕様として受容する判断済み — F9 の privacy ページへの明文化のみ残タスクとして引き継ぐ。

**Status:** 完了 (2026-07-07)

---

## F7. 品質監査バンドル (i18n / a11y / 型同期)

**案**: `/i18n` 監査 + `a11y-reviewer` agent + `type-sync-checker` agent をまとめて一巡。専用チェック手段が揃っているので低コスト。F5/F6 と並行可。

**Status:** 未着手

---

## F8. ライセンス・クレジット整備

**背景**: ffmpeg (LGPL) を自動ダウンロードして利用する形態のため、クレジット表記はファーストリリース時点で持っておくべき。

**案**: `docs/licenses.md` (英語) を公開ツリーに新設。対象: ffmpeg (LGPL 2.1+) / llama.cpp (MIT) / whisper.cpp (MIT) / Gemma (Gemma Terms) / Qwen (Apache 2.0) / Silero VAD。`spec/binary-updates.md` §5 の表をベースに利用者向けに書く。配布物としての表記義務 (LGPL の動的利用 + 別バイナリDL形態) の確認もここで。

**Status:** 未着手

---

## F9. ユーザードキュメント執筆 + GitHub Pages 公開

**背景**: UI が固まる前に書くと二度手間のため、**機能フリーズ後** (F2〜F8 完了後) に着手。

**公開サイト目次案** (2026-07-03 の体制再編を反映: 開発者向けは `spec/` に分離済み):

```
docs/
├── index.md            # アプリ紹介 (README から抽出: 特徴・スクリーンショット)
├── install.md          # 既存 (F2 で Updating 節追加済みの状態)
├── getting-started.md  # 新規: 初回起動〜モデル DL〜文字起こし〜AI 機能〜Notion 設定
├── faq.md              # 新規: Gatekeeper / SmartScreen / モデルサイズ / オフライン動作
├── privacy.md          # 作成済み (2026-07-03、体制再編時に前倒し)。F9 では内容の再点検のみ
└── licenses.md         # F8 で作成済み
```

- リリース手順ドキュメントは `spec/releasing.md` として作成する (「引き継ぎ知見」の CI/リリース節を吸収。日本語のままでよい)
- アーキテクチャ説明は `spec/architecture.md` として作成済み (2026-07-03)。公開向けに一般化した版が必要なら F9 で判断

**レンダリング方式**: 着手時に確定。第一候補 VitePress (pnpm に馴染む・デフォルトテーマの見栄え)、省力案 Jekyll (Deploy from branch)。

**Status:** 未着手

---

## F10. 実機最終確認

リリース直前の最終ゲート。Win/Linux 実機起動確認 (旧 #14 の残課題) とスモーク一巡を含む想定だが、**具体的な内容・チェックリストは着手前に別途詰める** (このセクションは placeholder)。

**Status:** 未着手

---

# 引き継ぎ知見 (完了済み旧項目から移送)

リリース時、CI/リリース運用の節は `spec/releasing.md` (F9) に移す。バックログは要望が出たら個別に起票する。

## CI 運用 (旧 #13)

- **Rust toolchain の齟齬**: ローカルと CI stable のバージョン差で「ローカル green / CI fail」が起きる。`rustup update stable` でローカルを追従させる運用 (`rust-toolchain.toml` 固定は tuning.md の「標準設定優先」に反するため不採用)
- **`#[cfg(target_os = ...)]` ガード下の lint**: macOS ローカル clippy では Linux/Windows 固有コードの lint がスキップされる。Linux 固有コードを書いた直後は CI run を見るまで完了扱いにしない
- **Linux deps 必須リスト**: `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf libasound2-dev` (cpal が ALSA を要求。ci.yml / release.yml で同期)
- **SOURCE_DATE_EPOCH**: CI で `GGML_NATIVE=OFF` を効かせるため必須 (`.claude/rules/workarounds.md`)
- **ビルド時間目安**: backend ジョブ初回 5〜6 分、rust-cache ヒットで 1〜3 分

## リリースビルド運用 (旧 #14)

- **`bundle.targets: "all"` + CI の `--bundles` 上書き**: macOS `app` / Windows `nsis` / Linux `deb,appimage`。ローカルで素の `pnpm tauri build` を叩くとホスト OS のフル形式が作られる
- **release.yml の `if` 分岐 2 回は仕様上正しい形**: tauri-action は `APPLE_CERTIFICATE` 等 env var の存在 (空文字含む) で codesign を自動起動するため統合不可 (f4fee36 で revert 済み)
- **install.md のファイル名プレースホルダー**: 初リリース時に実 artifact 名を見て微調整する余地あり
- **macOS は Install.command zip 経路のみ**: `.dmg` は署名なしダブル経路で UX が分散するため意図的に作らない
- **macOS Gatekeeper 事情 (2026-07 調査)**: macOS 15 Sequoia で「右クリック→開く」回避が廃止され、未署名物の初回起動は全ユーザーが「システム設定 → プライバシーとセキュリティ → このまま開く」経路を通る (macOS 26 Tahoe でさらに強化)。`ditto --noqtn` の quarantine 除去は引き続き有効で、Install.command 方式は未署名配布のほぼベストプラクティス。Homebrew は未署名 cask を 2026-09 に公式 Tap から排除予定のため配布経路として不採用
- **ad-hoc 署名 (`signingIdentity: "-"`)**: .app 直接起動時に「壊れています」(復旧不可) ではなく「検証できませんでした」(このまま開くで復旧可) になる保険として設定 (Tauri 公式推奨)。config ベースで tauri CLI 自身が `codesign -s -` するため、上記 tauri-action の APPLE_* env var 問題とは経路が別
- **hardened runtime とマイク entitlement**: tauri の codesign は hardened runtime をデフォルト有効にするため、署名導入と同時に `Entitlements.plist` (`com.apple.security.device.audio-input`) を追加した。これがないと録音 (cpal) がマイクにアクセスできない。署名変更後は /smoke で録音の実機確認を必ず行うこと
- **正式リリース時の完全解**: Apple Developer Program ($99/年) + Developer ID 署名 + notarization のみが警告を完全に消せる。加入すれば Homebrew cask 配布も解禁される。正式リリース時に加入を検討すること

## 将来候補バックログ (要望が出たら起票)

- `run_inference_blocking` の AbortHandle 化 — blocking 推論のチャンク内キャンセル不可の解消 (旧 #17)
- Notion: 送信中キャンセル / 送信履歴 (`history` に `notion_page_url` 列) / 429 Retry-After 対応 (旧 #10/#18/#19)
- release.yml リファクタ / Dependabot 有効化 / nightly フルビルド smoke (旧 #13)
- Windows MSI / Linux RPM / AppImage の Ubuntu バージョン差異検証 (旧 #14)
- Settings の「再ダウンロード推奨」バナー (`spec/binary-updates.md` §7 にも記載)
- 録音系エラーの専用 ErrorCode + i18n 文言 (現状 `Device error:` 等は意図的 UNKNOWN 割当で details 表示のみ。F4 の PREFIX_MAP 補完時の判断)
- アプリ起動時の**自動**新版チェック + 通知 (更新戦略の案 (b))。手動チェックは F2 で対応済みの想定。自動化はオプトイン設計が必須 (プライバシー原則との衝突回避)
- リアルタイム文字起こし / 話者識別 (旧 #12、2026-05-26 保留 → 2026-06-11 リリース対象外として削除) — whisper はバッチ前提で逐次推論は精度劣化、話者識別は sherpa-onnx / ONNX Runtime 同梱でバイナリ数百 MB 増。詳細な保留根拠と再開時の論点は git log (旧 #12 セクション) を参照

---

## 運用ルール

- **同時進行は1項目だけ**。「進行中」が表に複数ある状態を作らない。
- 着手時: 進捗サマリー表のステータスを `進行中` に更新 → 該当セクションの `**Status:**` も更新。
- 完了時: コミット (もしくは PR マージ) と同じタイミングで `完了` に更新する。完了日を `**Status:** 完了 (2026-06-11)` の形で残す。
- 完了項目は次の節目で表から消し込んでよい。**消し込む前に、将来必要な知見を「引き継ぎ知見」か恒久ドキュメント (`docs/` / `spec/` / `.claude/rules/`) に移す**。議論経緯は git log を一次ソースとする。
- 項目を追加するときは、**進捗サマリー表と新規セクションを同じコミットで追加**する。片側更新にしない。
- このファイルはリリース時に削除する (`spec/` の他ファイルは恒久)。削除前チェック: 「引き継ぎ知見」の移送完了・全項目が完了または明示的な保留/バックログ化。
