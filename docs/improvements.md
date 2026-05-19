# 改善案メモ

プレリリース段階で温めている改善アイデアを集約するドキュメント。
各項目は **背景 / 案 / 検討事項 / Status** で記述する。確定事項ではなく議論のたたき台。

> 方針: `.claude/rules/tuning.md` に従い、独自チューニングで弱点を隠すより一般的な設定・標準的なUXに寄せる。

---

## 進捗サマリー

ステータスは `未着手 / 進行中 / 完了 / 保留` の4段階。
**1項目ずつ片付ける運用**なので、`進行中` は同時に1つだけにする。
完了したらこの表と各セクション末尾の `Status:` 行を両方更新する。

項目はカテゴリ単位でグルーピングし、**実装推奨順に並べた**。
プレリリース段階のため、機能・UI を先に固めて、CI/CD と OS 別配布はリリース直前にまとめて整備する方針。

- **A. UI/UX 磨き込み**: 利用者体験を整える (基盤 → 個別機能の順)
- **B. モデル管理**: 公開モデルの取捨選択と利用者ディスクの整理
- **C. Notion 連携の強化**: 主要出力先の品質を上げる
- **D. 中長期**: 運用ポリシー策定・大型新機能
- **E. リリース直前整備**: CI/CD と OS 別配布をまとめて固める

| #  | Cat | 項目                                       | 優先 | Status   | メモ |
|----|-----|--------------------------------------------|------|----------|------|
| 1  | A   | アプリアイコン正方形化                     | 高   | 完了 (2026-05-12) | 工数小、見栄えに直結 |
| 2  | A   | ファイル選択ダイアログの言語整合           | 中   | 完了 (2026-05-13) | Info.plist にローカライズ宣言追加 + dialog.* に i18n 集約 |
| 3  | A   | 設定/開発ページのレイアウト統一            | 高   | 完了 (2026-05-14) | SectionRow 共通化 + 二重枠除去 + VAD 説明文拡充 |
| 4  | A   | アプリ全体の用語ヘルプ (`?` ポップオーバー) | 中   | 完了 (2026-05-14) | HelpHint 新設 + glossary 6 用語を Settings に配置 |
| 5  | A   | 共有メニュー化 (Notion 等)                 | 中   | 完了 (2026-05-14) | 共有メニュー (FiShare2) 新設 + 未接続時の設定リンク導線 |
| 6  | A   | 履歴メタ情報の拡充 (VAD ON/OFF)            | 中   | 完了 (2026-05-15) | 履歴に vad_enabled 列追加 + 詳細メタ行表示。#10 のメタ基盤として再利用可 |
| 15 | A   | 文字起こし時の VAD ON/OFF 選択             | 中   | 完了 (2026-05-15) | createWhisper に override signal 新設 + Bar に Checkbox 列。設定は起動時デフォルトとして機能継続 |
| 16 | A   | 要約・整文タブで保存ボタンを有効化         | 中   | 未着手   | 現状は隠されている。formatSummaryAsText 経由で .md / .txt 出力 |
| 17 | A   | 要約処理中の履歴ナビゲーション制御         | 中   | 未着手   | 処理中に閉じられて再オープン時にタブ非表示。閉じる前確認 or 処理中状態の永続化 |
| 7  | B   | Whisper モデルを small/turbo に絞る        | 高   | 完了 (2026-05-18) | medium / large-v3 を完全削除し、turbo に統合 |
| 8  | B   | 不要モデルのクリーンアップ                 | 中   | 完了 (2026-05-19) | 廃止モデル機構を LLM 側にだけ実装。合計サイズ表示は Whisper / LLM 両方に |
| 9  | C   | 要約の充実                                 | 中   | 進行中 (品質再検討) | 構造化要約は完成済み。tldr/keyPoints の役割分離と actionItems 厳格化を 2026-05-19 に追加 |
| 10 | C   | Notion ブロック送信 + メタデータ           | 中   | 未着手   | 主要連携の品質向上。履歴メタ (#6) と共通基盤 |
| 11 | D   | バイナリ更新フロー (ffmpeg/llama)          | 低   | 未着手   | ポリシー策定優先 |
| 12 | D   | リアルタイム / 話者識別                    | 低   | 未着手   | VAD は導入済み。スコープ大 |
| 13 | E   | CI/CD 調整                                 | 高   | 未着手   | リリース直前に整備 (#14 と一括) |
| 14 | E   | Windows / Linux ビルド・配布               | 高   | 未着手   | `install.md` の案内と実態が乖離している。#13 と並行整備 |

> ステータス更新のとき、優先度の見直しが必要になったら表ごと並べ替えて構わない。
> 関連項目の依存 (例: #7 → #8、#9 → #10、#6 ⇄ #10、#3 ⇄ #4、#13 ⇄ #14) はカテゴリ内の順序に反映済み。

---

# A. UI/UX 磨き込み

利用者体験を整える。アイコン (#1) とダイアログ言語 (#2) は工数小なので先に片付ける。設定ページ統一 (#3) と用語ヘルプ (#4) は UI 基盤として先行し、個別機能改善 (#5, #6) を載せる。履歴メタの拡充 (#6) は #10 (Notion メタブロック) の基盤にもなる。

## 1. アプリアイコンを正方形にしたい

### 背景
- 現状: `src-tauri/icons/icon.svg` は `<circle r="230">` を使った円形デザイン。
- macOS は OS 側で squircle (角丸正方形) マスクが適用されるため、円形だと「実際のアイコン領域より一回り小さく見える」「他アプリと並んだとき浮く」現象が起きる。
- Windows / Linux ではマスクが効かないため、円形のまま小さく表示される。

### 案
- 背景を 512×512 のフルブリードな塗り（または角丸長方形）に差し替え、ロゴをそのキャンバス内に再配置する。
- Apple HIG の余白規定 (アイコン領域の約 80% 内にコンテンツ) に従ってセーフエリアを確保。
- 派生 PNG / `.icns` / `.ico` / `Square*Logo.png` は `tauri icon` コマンドで再生成。

### 検討事項
- ロゴモチーフ自体は維持するか、リブランディングを兼ねて見直すか。
- macOS の squircle に合わせて角丸を入れた "ベタ正方形+padding" にするか、完全に四角(角丸なし)で OS マスクに任せるか。後者の方が将来 OS が変わっても自然。
- Tauri v2 のバンドル設定 (`bundle.icon`) は再生成後そのまま使える想定。

### 実施結果 (2026-05-12)

- **背景**: `icon.svg` の中央 `<circle r="230">` を `<rect width="512" height="512">` に置換し、フルブリードの紫グラデ背景 (`#7c3aed` → `#6d28d9`) へ変更。OS マスク (macOS squircle / Win/Linux 矩形) に任せる方針。
- **モチーフ刷新**: 旧 ripple arc + 中心点 を **音声の自然波形** (9本の不規則高さ縦バー、高さ `[120, 240, 80, 320, 160, 280, 120, 200, 160]` で複数ピーク・谷を分散、バー幅 28・ピッチ 48・角丸 14、色は全バー均一 `#e9d5ff` opacity 0.9) に置換。心電図/実音声に近い不規則な流れで、特定バーだけが強調されないよう色・不透明度はフラット化。Otter / Notta 系の "文字起こしアプリ" イメージに整合。
- **再生成**: `pnpm tauri icon src-tauri/icons/icon.svg` で派生 PNG / `.icns` / `.ico` / `Square*Logo.png` / `StoreLogo.png` を一括再生成。
- `tauri icon` が副産物として吐く `src-tauri/icons/android/`, `src-tauri/icons/ios/` (本プロジェクトは Desktop only) と、サンドボックス迂回時に作られた `.pnpm-store/` を `.gitignore` へ追加。
- `bundle.icon` のパスリストは変更不要 (ファイル名据え置き)。
- macOS の Dock / Finder 表示は OS の squircle マスクで自然に整形される想定。Windows / Linux 実機での確認は #14 で実施。

**Status:** 完了 (2026-05-12)

---

## 2. ファイル選択ダイアログの言語整合

### 背景
- 現状: アプリ内言語を日本語にしていても、ファイル選択 (`open()`) / 保存 (`save()`) ダイアログのボタン (`Open` / `Save` / `Cancel`) や "All Files" 等のラベルが英語のまま。
- 原因の見立て: `src-tauri/Info.plist` に `CFBundleDevelopmentRegion` / `CFBundleLocalizations` が宣言されていない (現状は `NSMicrophoneUsageDescription` のみ)。
  - macOS は宣言の無いアプリを「英語専用」とみなし、ユーザーのシステム言語が日本語でも `NSOpenPanel` / `NSSavePanel` を英語で描画する。
- フロント側の `filters[].name` は一部 i18n 化されている (`FileSelector.tsx` の `transcription.audioFilesFilter`) が、`RecordingPanel.tsx` / `ResultViewer.tsx` のフィルタ名は `"WAV"` / `fmt.toUpperCase()` のハードコード。
- ダイアログの `title:` は全箇所で未指定 (タイトル空)。

### 案
- **第1案 (推奨・標準)**: `Info.plist` にローカライズ宣言を追加して OS のシステム言語に追従させる。
  ```xml
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleLocalizations</key>
  <array>
    <string>en</string>
    <string>ja</string>
  </array>
  ```
  これでシステム言語が日本語のユーザーには日本語ダイアログ、英語のユーザーには英語ダイアログが出る。Apple HIG に沿った標準的な解決。
- **保存ダイアログのフィルタ名・title の i18n 化**:
  - `RecordingPanel.tsx:43` の `{ name: "WAV", ... }` を `t("recording.wavFilter")` 等に。
  - `ResultViewer.tsx:105` の `fmt.toUpperCase()` も同様に多言語キー or "テキストファイル" のような表記へ。
  - 各 `open()` / `save()` 呼び出しに `title: t("...")` を渡し、ダイアログ上部のタイトルも整合させる。
- **Windows / Linux**: 各 OS の標準ファイルダイアログは OS のロケールに従うため、Info.plist と同等の追加対応は基本不要。Linux で `LC_MESSAGES` が `C` のままだと英語になるが、これは利用者環境依存なので仕様許容。

### 検討事項
- **アプリ内言語と OS 言語が食い違う場合の扱い**:
  - 例: macOS のシステム言語が英語のユーザーがアプリ内言語だけ日本語にしたケース。第1案では英語ダイアログのまま。
  - 強制的に揃えるには `AppleLanguages` (NSUserDefaults) を起動時に上書きする方法があるが、`tuning.md` の方針 (一般的な設定優先) と OS HIG の双方からみて **非推奨**。仕様として許容する側に倒すのが素直。
- Info.plist 変更後にコード署名/公証ワークフロー (`release.yml`) で問題が出ないか軽く確認。基本的にキー追加だけなら影響なし。
- `CFBundleDevelopmentRegion` を `ja` にするか `en` にするか:
  - 開発リージョンは「対応言語に該当するものが無いときのフォールバック」。プレリリースの主ユーザーが日本語想定でも、グローバル配布を考えるなら `en` の方が安全。
- 既存のフィルタ i18n キーは `transcription.audioFilesFilter` のみ。新規追加する場合は `dialog.*` という名前空間に集約する方が見通しが良い (例: `dialog.wavFilter`, `dialog.textFilter`, `dialog.openAudioTitle`)。
- ファイル保存時の **デフォルトファイル名** (`save({ defaultPath: ... })`) も現状渡しているか要確認。日本語ファイル名にした際に文字化けが無いかをこの作業のついでに見ておく。

### 実装ステップ案
1. `Info.plist` にローカライズ宣言を追加 → ローカルで `pnpm tauri build` → macOS のシステム言語を日本語/英語と切り替えて NSOpenPanel が変わるか確認。
2. 保存ダイアログのフィルタ名・title をすべて i18n 化 (`dialog.*` キー新設、`ja` / `en` 両ロケールに追加)。
3. `/i18n` で品質チェック → `/verify` → コミット。
4. リリースビルドで Gatekeeper / 公証フローに副作用がないか release.yml の手動 dispatch で1回確認。

### 実施結果 (2026-05-13)

- **Info.plist**: `CFBundleDevelopmentRegion=en` と `CFBundleLocalizations=[en, ja]` を追加。`NSMicrophoneUsageDescription` は維持。macOS のシステム言語に NSOpenPanel/NSSavePanel が追従する標準対応に揃えた。
- **i18n 集約**: `Dictionary` に `dialog` 名前空間を新設し、`transcription.audioFilesFilter` を `dialog.audioFilter` へ移行。新規キー: `wavFilter` / `txtFilter` / `srtFilter` / `vttFilter` / `openAudioTitle` / `saveWavTitle` / `saveTranscriptionTitle`。ja/en 両ロケールに反映。
- **呼び出し側 4 箇所**: `FileSelector.tsx` / `QuickActions.tsx` / `RecordingPanel.tsx` / `ResultViewer.tsx` のフィルタ名ハードコードを除去し、すべて `title:` を追加。`ResultViewer.tsx` は `t(\`dialog.${fmt}Filter\`)` のテンプレートリテラルで `ExportFormat` 別に切替。
- **defaultPath**: `"recording.wav"` / `\`transcription${ext}\`` の英文字は維持 (文字化けリスク回避)。
- **検証**: `/verify` の lint / typecheck / FE 265 tests / BE 325 tests / build 全通過。`/i18n` 監査で英語版タイトルを Title Case に揃えた (`Select an Audio File` 等、既存 `Send to Notion` / `Start Transcription` と整合)。
- **Windows / Linux ダイアログ**: OS ロケール追従のため Info.plist 相当の対応不要。フロントの i18n 化でフィルタ名/タイトルは対応済み。実機確認は #14 に委譲。
- **アプリ内言語と OS 言語のズレ**: 強制揃えはしない。OS=英語 + アプリ内=日本語のケースはダイアログ英語のまま (Apple HIG 準拠の仕様許容)。

**Status:** 完了 (2026-05-13)

---

## 3. 設定 / 開発ページのレイアウト統一

### 背景
- 現状の設定セクション: `FfmpegManager`, `NotionIntegration`, `SettingsSelect`, `TextModelManager` (text-processing), `CacheClear`, `LlmTester` (dev)。
- ffmpeg の管理欄など、行頭にアイコンがあるセクションと無いセクションが混在しており、横位置・余白が揃わない。
- 開発メニューも同様。

### 案
- 共通のセクションラッパー (`<SettingsSection icon={...} title="..." description="...">`) を導入し、
  - すべてのセクションが「アイコン + タイトル + 説明 + 中身」の同じグリッドに乗る形に統一。
  - アイコンが無いセクションでも、左カラムに同じ幅のスペーサーを置いて視線を揃える。
- ボタン配置 (右寄せ / 一行) と密度 (`gap-2` / `py-3`) を Tailwind プリセットに固定化。
- 開発ページ (`DevMenu.tsx`) も同じラッパーを再利用。

### 検討事項
- solid-ui に類似コンポーネントがあれば優先 (ただし solid-ui は薄いので大半は自作)。
- 設定項目の並び順 / グルーピング (例: "音声処理" "LLM" "出力連携" "詳細") の再設計を同時にやるか分割するか。
- i18n キーの命名整理を併発するなら別タスクとして切る。
- **設定項目の説明文の品質**:
  - 現状の説明文は機能のメリットしか書いていないものが多く、利用者が「無効/別設定を選ぶべき場面」を判断できない。
  - 例: VAD (`vadDescription: "無音区間をスキップして文字起こしを高速化"`) は有効化メリットしか書いていない。実際には次のケースで **無効化が妥当**:
    - 発話が極端に小さい/遠い録音 (threshold=0.3 でも取りこぼす場合)
    - 歌・朗読・演技など発話形態が普通でない音声 (Silero VAD が誤って無音判定するリスク)
    - 無音区間そのものを情報として残したい用途 (会議の沈黙時間など)
    - デバッグ用途で「VAD で削られたのか whisper 出力か」を切り分けたい時
  - レイアウト統一作業のついでに、説明文を「機能 + 無効推奨ケース」または「機能 + 用途別の推奨」を含む形に拡充する。i18n キー (`settings.vadDescription` 等) を更新するだけで済む。
  - VAD 以外の設定項目 (モデル選択、ffmpeg、LLM モデル等) も同じ観点で見直す。長くなりすぎる場合は **#4 (用語ヘルプ)** へ分離する。
- **#4 との分業**:
  - 設定項目の説明文 = 「どう設定するか」の操作指針 (短く)
  - #4 の用語ヘルプ = 「そもそも何か」の概念解説 (`?` アイコンで展開)
  - この2層構成を運用ルールとして決めておくと、今後の追加機能でブレない。

### 実施結果 (2026-05-14)

- **真の不整合の特定**: Phase 1 探索で `LlmTester` / `CacheClear` の "Card 漏れ" もアイコン有無の不整合も既に解消済みと判明 (全 Card が `CardTitleWithIcon` 統一、行レベルは全てアイコンなしで統一)。実際の問題は (a) `CacheClear` / `Reset Onboarding` 行の内部枠 (`rounded-lg border p-4`) による Card 二重枠、(b) `SettingsSelect` と VAD 行で重複する `flex/space-y` 構造、(c) VAD 説明文が無効化推奨ケース不掲載、の3点に絞り込めた。
- **共通ヘルパー新設**: `src/components/ui/SectionRow.tsx` を新設 (汎用プリミティブ。`title: JSX.Element` / `description?` / `right`)。`SettingsSelect`, VAD 行, `CacheClear`, DevMenu の Reset Onboarding 行, `FfmpegControl` (Badge を title 内に), `TextModelManager` の dev モード Server Management, `NotionIntegration` 未接続/接続済みのすべてを `SectionRow` 経由に集約。
- **二重枠除去**: Card 内に再度枠を引いていた5箇所を整理 — (a) `CacheClear` の `rounded-lg border p-4`、(b) `DevMenu` の Reset Onboarding 行、(c) `FfmpegControl` (Settings/Dev 両方の Tool Management で使用)、(d) `TextModelManager` の dev モード Server Management 行、(e) `NotionIntegration` の未接続バナー・接続済みステータス枠・編集フォーム枠。接続済みステータスは緑色アクセントを `<FiCheck class="text-emerald-500">` に集約し情報量は維持。
- **VAD 説明文**: メリットのみの記述を「機能 + 無効化推奨2ケース (歌唱・朗読 / 無音記録)」に変更。残り (発話が極小、デバッグ用途) は #4 の用語ヘルプに委譲する設計。
- **スコープ外として残した項目**: 「設定項目の並び順 / グルーピング」「i18n キーの命名整理」「#4 との分業ルール明文化」は本作業に含めず #4 着手時にまとめる。
- **検証**: `/verify` の lint / typecheck / FE 265 tests / BE 325 tests / build 全通過。

**Status:** 完了 (2026-05-14)

---

## 4. アプリ全体の用語ヘルプ (`?` アイコン + ポップオーバー)

### 背景
- アプリ全体に専門用語・略語が散在している: VAD, LLM, Whisper, GGML, llama.cpp, Notion Database ID / Token, ffmpeg, FTS5 (履歴検索), large-v3-turbo (モデル名) など。
- 開発者・技術者には自明だが、想定ユーザー層 (会議・インタビュー記録を取りたい一般職種) には不明な用語が多い。
- 現状はハードコードな短い説明文しかなく、「そもそも VAD とは何か」が分からないと有効/無効の判断もできない (#3 の検討事項参照)。

### 案
- 共通の **用語ヘルプコンポーネント** を新設し、専門略語の隣に `?` アイコンを置く。クリック/ホバーで概念解説をポップオーバー表示。
  ```tsx
  <HelpHint term="vad" />
  ```
- **コンポーネント実装**:
  - solid-ui の `Popover` (Kobalte ベース) を使う。アクセシビリティ的にクリックで開けるのが望ましい (タッチデバイス対応 + キーボード操作)。
  - HoverCard も併用候補だが、モバイル/iPadOS でホバーが効かないため Popover を主とする。
- **辞書の置き場所**:
  - i18n に `glossary.*` 名前空間を新設。例: `glossary.vad.title` / `glossary.vad.body`、`glossary.llm.title` / `glossary.llm.body` 等。
  - title (用語名 + 略語展開) + body (2-4行の解説) の2フィールド構成。
- **付与対象**: 視覚的にうるさくならないよう、**初見で意味が取れない専門略語のみ**に絞る。
  - 必須: VAD / LLM / Whisper / GGML / llama.cpp / ffmpeg / Notion Database ID / Notion Token
  - 任意 (後追い検討): モデル名 (large-v3-turbo / small)、FTS5、wav 形式
- **使用箇所** (例):
  - 設定ページ: 各セクションのタイトル横
  - 文字起こしオプションバー: モデル選択ラベル横
  - Notion 設定: Database ID / Token ラベル横
  - 開発メニュー: LLM / GGML 等のラベル横

### 検討事項
- **解説の長さ**:
  - 2-4行で「何のためのものか」を伝える。長文の概念解説や外部リンクは置かない (オフライン前提のローカルアプリなので、本文に閉じる)。
- **i18n の翻訳負荷**: 用語あたり title + body × ja/en の4文字列。8用語で合計32エントリ。許容範囲。
- **コンポーネントの API**:
  - 第1案 (推奨): `<HelpHint term="vad" />` で i18n キーを term から自動構築 (`glossary.vad.title` 等)。term を typed union (`type GlossaryTerm = "vad" | "llm" | ...`) で縛れば型安全性も担保できる。
  - 第2案: `<HelpHint title={...} body={...} />` で明示渡し。冗長だが汎用性は高い。
- **`?` アイコンのサイズ・位置**:
  - 小さく控えめに (例: `size-3.5`、薄いグレー、ホバーでアクセントカラー)。視覚ノイズを最小化。
- **i18n キー命名**:
  - title はあえて略語のままにするか、フル名 ("VAD (Voice Activity Detection)") にするかは要検討。フル名にすると初見で意味が分かりやすい。
- **#3 との分業 (再掲)**:
  - 設定項目の説明文 (基本説明) は短く操作の指針を示す
  - `?` アイコンの中身 (用語解説) は概念そのもの
  - この2層構成を運用ルールとして決めておくと、今後の追加機能でブレない。
- #3 完了時点で「VAD 説明文 = 操作の指針 (歌唱・朗読/無音記録の2ケース)」までは反映済み。発話が極小・デバッグ用途などの追加ケースは `?` ヘルプ側に委ねる前提で、本タスク着手時に拾う。
- 全画面に展開するため、リリース前に1度通しで「どの用語に `?` を付けるか」を確認するのが望ましい。

### 実装ステップ案
1. `<HelpHint term="..." />` コンポーネントを `src/components/ui/` に新設 (Popover ベース)。
2. i18n に `glossary.*` 名前空間を追加し、必須8用語の title/body を ja/en で書く。
3. 既存の主要画面 (設定 / 文字起こしオプションバー / Notion 設定 / 開発メニュー) の専門略語に `?` を付与。
4. `/i18n` 品質チェック → `/verify` → コミット。
5. 任意用語 (モデル名、FTS5 等) は後追いで段階的に追加。

### 実施結果 (2026-05-14)

- **HelpHint コンポーネント**: `src/components/ui/HelpHint.tsx` を新設。`@kobalte/core/popover` を直接使用 (リポジトリに Popover ラッパー無し)。`<HelpHint term="..." />` の term キー方式 (typed union `GlossaryTerm`)、`?` アイコンは `FiHelpCircle` (size-3.5、薄いグレー → ホバーでアクセント)、Popover content は `w-72` で title (太字) + body (text-xs muted)。クリック/キーボード (Enter/Space/Esc) は Kobalte 標準対応。`aria-label` は `common.helpHintLabel` から取得。
- **i18n**: `Dictionary` に `glossary` 名前空間を追加し、必須 6 用語 (vad / llm / whisper / ffmpeg / notionDatabaseId / notionToken) × title/body × ja/en で 24 文字列を実装。`common.helpHintLabel` も ja/en に追加。タイトルは「VAD（音声区間検出）」のように略語先頭で統一し、ja の `settings.vadEnabled` ラベルも同じ表記に合わせた。body は 2-4 行の概念解説。日本語 body は既存 `notionTokenStorageNote` 等のですます体に文体を揃え、英語 body は sentence case。
- **配置 6 用語** (一般ユーザー向けの Settings ページに限定):
  - Settings.tsx: VAD 行 (`vad`)、Whisper Model Management Card (`whisper`)
  - NotionIntegration.tsx: 編集モードの Token / Database ID ラベル (`notionToken` / `notionDatabaseId`)
  - FfmpegManager.tsx: Tool Management Card (`ffmpeg`)
  - TextModelManager.tsx: Language Model Management Card (`llm`) — `<Show when={!props.devMode}>` でガードし、Settings でのみ表示
- **開発メニュー (`/dev`) には HelpHint を置かない**: 開発者は GGML / llama.cpp / whisper.cpp 等の用語を熟知している前提。当初計画にあった `ggml` / `llamaCpp` 用語と DevMenu / dev モード TextModelManager への配置は撤回し、i18n キーも削除。`TextModelManager` は Settings/DevMenu 共用コンポーネントなので、`llm` HelpHint を `!devMode` でガードして dev 側にも漏れないようにした。
- **whisper.body から実装名を除去**: 「ローカル実行版（whisper.cpp）」のような実装側用語は一般ユーザーには不要なので、機能と「端末内で実行されるため外部送信なし」の安心感だけに整理。
- **body の文体方針**: 「本アプリ」「The app」のような自明な主語表現を全用語から削除し、機能・用途・プライバシー的な含意の 3 点に絞って簡潔化。
- **CardTitleWithIcon との組み合わせ**: children に `<span class="flex items-center gap-2">text<HelpHint /></span>` を入れることで、icon と「タイトル + `?`」が gap-3 で離れ、タイトルと `?` は近接 (gap-2) する自然な配置に。
- **#3 ⇄ #4 の役割分担 (運用ルール)**: 設定行の `description` = 操作の指針 (短く) / `?` ヘルプ = 概念解説。今後の機能追加でブレないよう本実施結果に明記。
- **スコープ外として残した項目**: 後追い用語 (`large-v3-turbo` / `small` / FTS5 / `wav`)、履歴/オンボーディング画面への展開、TranscriptionOptionsBar の Model ラベル横 (Settings 側の `whisper` ヘルプと重複)、外部リンク (オフライン前提のため本文に閉じる)、開発メニューへのヘルプ追加 (上記理由のため)。
- **検証**: `/verify` の lint / typecheck / FE 265 tests / build 全通過。視覚確認 (Popover 開閉、Tab/Enter/Esc、ja/en 切替、モバイル幅) はリリース前の通し確認時に併せて実施。

**Status:** 完了 (2026-05-14)

---

## 5. 共有アイコンの下に Notion を入れる（共有メニュー化）

### 背景
- 現状: `ResultToolbar.tsx` で `SiNotion` を直接ボタン化している (`onShareToNotion`)。
- 今後の出力先候補: Slack DM / Email / Markdown ファイル書き出し / クリップボード(リッチテキスト) / Google Docs など。
- このまま増えるとツールバーがアイコンで埋まる。

### 案
- "共有" アイコン (例: `TbShare2` / `IoShareOutline`) のドロップダウンに集約。
  - 1段目: 「Notion に送信」「Markdown でエクスポート」「クリップボードにコピー」…
  - 各項目はフラットな `DropdownMenu` 構成。連携未設定の項目はグレーアウト + "設定する" リンク。
- 既存の "Notionへ送信" ショートカット用途には、最近使った1件をトップレベルに固定表示するパターンも検討可能（ただし優先度は低い）。

### 検討事項
- 連携未設定時の導線: メニューを開いた状態から `Settings` の該当セクションへ遷移できるよう `router.navigate("/settings#notion")` 等のアンカー対応が要るか。
- アクセシビリティ: ドロップダウン内ボタンは `aria-label` ではなくテキストラベル化する。
- 履歴ページ (`History`) 側にも同じ共有メニューを移植するか。今は履歴に共有導線がなければスコープ外。

### 実施結果 (2026-05-14)

- **スコープの絞り込み**: 「外部連携メニュー」として位置付け、Notion + 将来の Slack/Email 等の足場のみを対象。Copy / Save (txt/srt/vtt) は「ローカル保存・取り出し」と性質が違うため統合せず現状維持。
- **`ResultToolbar.tsx` 変更**: 旧 `SiNotion` 単独ボタン (Notion 接続時のみ表示) を、`FiShare2` を起点とする共有 DropdownMenu に置換。実装は既存 AI/Save flyout と同じ手書きパターン (`createSignal` + `pointerdown` で outside-close、`shareOpen` を outside-close ハンドラへ統合)。Kobalte DropdownMenu への全面置換は別タスク。
- **ボタン並び順の調整**: 右側アクションを `AI / Save / Share / Copy` から `AI / Share / Save / Copy` に変更。「外部送信 (Share) → ローカル保存 (Save) → クリップボード (Copy)」の順で右に行くほど距離が近く・即時性が高くなるグラデーションに整理。Save と Share が直接隣接して原則が混ざる違和感を解消した。
- **未接続時の導線**: メニュー自体は常時表示。Notion 項目をグレーアウト (`opacity-50` + `aria-disabled`) + `<Separator>` + `FiSettings` アイコン付きの「Notion 連携を設定する」ボタンで `/settings` へ `navigate`。未接続ユーザーへの導線を改善 (旧実装ではボタン自体が消えて共有手段が無いように見えていた)。
- **`useNavigate` の持ち込み**: `ResultToolbar` 内で `@solidjs/router` の `useNavigate` を直接使用。テストは既に `renderWithRouter` でラップ済みのため変更不要。
- **i18n 追加**: `result.shareMenu` (共有 / Share)、`result.shareNotionSetupHint` (Notion 連携を設定する / Set up Notion Integration) を ja/en に追加。既存 `result.shareToNotion` はメニュー項目ラベルとして再利用。
- **履歴詳細への自動反映**: `ResultViewer` は `TranscriptionResult` と `HistoryDetail` の両方で使用されているため、Toolbar 変更により履歴詳細にも自動で共有メニューが反映される (追加作業なし)。履歴一覧 (`History.tsx`) には独立した共有導線が無いためスコープ外。
- **スコープ外として残した項目**: Kobalte DropdownMenu への全面置換 (既存 AI/Save 含めた整合作業として別タスク)、最近使った1件のトップレベル固定表示、Copy/Save の共有メニュー統合 (出力先が増えてから再検討)、履歴一覧への共有導線追加。
- **検証**: `/verify` の lint / typecheck / FE 265 tests / BE 325 tests / build 全通過。

**Status:** 完了 (2026-05-14)

---

## 6. 履歴メタ情報の拡充 (VAD ON/OFF を含む)

### 背景
- 現状の履歴スキーマ (`history/types.rs` の `HistoryEntry` / `HistoryMeta`) には `model_id` / `language` / `duration` などはあるが、**VAD の ON/OFF を保存するフィールドが無い**。
- 設定画面で VAD は ON/OFF 切替可能 (`settings.vadEnabled`)。文字起こし時にフロントが `vad_model_path` を渡すか否かで挙動が変わるが、履歴を後から見たときに「この結果は VAD 有効/無効どちらの結果か」が分からない。
- 利用者は「精度が低かった時に VAD の影響だったのか確認する」「VAD ON/OFF で結果を比較する」ような調査ができない。

### 案
- **DB スキーマに列追加**:
  - `history` テーブルに `vad_enabled INTEGER` (NULL 許容) を追加。SQLite では bool は INTEGER 0/1 で表現する慣例に従う。
  - 既存レコードへの migration: `init_db` 内で `ALTER TABLE history ADD COLUMN vad_enabled INTEGER` を冪等に実行 (列が既にあれば無視)。既存行は NULL のまま。
- **型定義の同期**:
  - Rust: `HistoryEntry` / `HistoryMeta` / `HistorySaveParams` に `vad_enabled: Option<bool>` を追加。
  - TypeScript: `src/types/history.ts` 側に `vadEnabled: boolean | null` を追加。
- **保存パスの修正**:
  - `transcribe` 完了後に履歴保存する箇所 (`createWhisper.ts` の save 呼び出し付近) で、`createSettings().vadEnabled()` の値を `HistorySaveParams` に渡す。
- **表示**:
  - 履歴詳細画面のメタ情報セクションに「VAD: 有効 / 無効 / —」を追加。
  - 履歴一覧 (`History.tsx`) は密度を見ながら、バッジは控えめに or 詳細だけに留める判断を実装時に行う。
  - i18n キーは `history.vadEnabled` / `history.vadDisabled` / `history.vadUnknown` を新設。

### 検討事項
- **既存履歴の VAD 値の扱い**:
  - 第1案: `0` (無効) で埋める → 過去に ON で実行していたユーザーの履歴を「無効」と誤表示するリスク。
  - **第2案 (推奨)**: NULL 許容にし、UI では "—" / "不明" で表示。新規保存からは必ず値が入る。データの嘘を作らないことを優先。
- 将来追加したくなりそうな他メタ (VAD threshold, speech_pad_ms, whisper の language ヒント等) は **今回は対象外**。`tuning.md` の方針 (一般的な設定優先) に従い、VAD パラメータは現状バックエンドハードコードのままなので、ユーザーが明示的に変えていない値を履歴に残す意義は薄い。
- **#10 (Notion ブロック送信メタ) との関係**:
  - Notion メタブロックには「使用モデル」「処理時間」「VAD 有効/無効」などを並べたい。これらは履歴側にも揃えたいデータ。
  - ただし両方を一気にやろうとするとスコープが膨らむ。**今回は VAD ON/OFF だけ**に絞り、#10 着手時に必要な他メタを同じ migration パターンで追加する。
- カラム追加の DB migration が FTS5 インデックスに影響しないか確認 (FTS5 は `text` 列のみ参照しているはずなので影響なし)。
- 履歴一覧の UI 密度: 既に十分な情報量があるなら一覧にはバッジを出さず、詳細パネルのみに表示する選択も妥当。

### 実装ステップ案
1. Rust: `db/mod.rs` の `init_db` に `ALTER TABLE` migration を追加 (列が無ければ追加)。
2. Rust: `types.rs` / `commands.rs` / `db/` の保存・読込パスを `vad_enabled: Option<bool>` 対応に。
3. TS: `src/types/history.ts` の型同期、`createWhisper.ts` の save 呼び出しに `vadEnabled` を渡すよう変更。
4. UI: 履歴詳細にメタ情報セクションを追加し VAD 状態を表示。一覧表示の有無はユーザー確認 (実装時に画面を見せて判断)。
5. i18n キー追加 → `/i18n` 品質チェック → `/verify` → コミット。

### 実施結果 (2026-05-15)

- **DB スキーマ**: `history` テーブルに `vad_enabled INTEGER` (NULL 許容) を追加。既存履歴は NULL のまま (= 不明) を維持し、データの嘘を作らない方針。新規保存は必ず `0/1` のいずれか。
- **冪等 migration**: `db/mod.rs::init_db` に `add_column_if_missing` ヘルパーを新設し `PRAGMA table_info` で列存在を確認してから `ALTER TABLE` を実行。新規 DB は `CREATE TABLE` 側で初めから列を持ち、旧 DB は再起動時に列が追加される。`init_db_adds_vad_enabled_column_to_old_schema` テストで旧スキーマ → 新スキーマ移行を検証。
- **Rust types**: `HistoryEntry` / `HistoryMeta` / `HistorySaveParams` の3構造体に `vad_enabled: Option<bool>` を追加。`HistorySaveParams` のみ `#[serde(default, skip_serializing_if = "Option::is_none")]` を付与し、フロントから省略可 (= NULL になる) を維持。シリアライゼーション round-trip を types テストで確認。
- **保存・取得パス**: `entries.rs::save_entry` (INSERT)、`list_entries` (SELECT)、`get_entry` (SELECT)、`search.rs::search_entries` (SELECT、`meta_row_mapper` を再利用するため必須)、`rows.rs::MetaRow` / `meta_row_mapper` / `meta_from_row` の全経路を更新。`save_entry_persists_vad_enabled_false` と `get_entry_returns_none_for_legacy_rows_without_vad_enabled` で round-trip と既存行 NULL 動作を検証。
- **TS 型同期**: `src/types/history.ts` の3 interface に `vadEnabled` を追加。`HistoryMeta` / `HistoryEntry` は `boolean | null` (必須)、`HistorySaveParams` は `boolean` (optional) で fail-safe に。
- **保存呼び出し**: `pages/Transcription.tsx::saveToHistory` で `createSettings().vadEnabled()` を `HistorySaveParams` に渡すよう変更 (唯一の保存箇所)。`createWhisper.ts` は変更不要 (履歴保存は持っていない)。
- **HistoryMeta に含めるか**: SELECT に列を1つ加えるだけのコスト差で将来 (例: 一覧バッジ・絞り込み) の DB 再変更を避けられるため、**含める方針**を採用。一覧 UI は密度を維持するため変更しない (詳細でのみ表示)。
- **表示**: `HistoryDetail.tsx::metadataJSX` および `HistoryList.tsx` の Row 3 メタ行に `FiActivity` アイコン付き要素を追加。`vadEnabled !== null` のときのみ表示 (NULL は非表示)、`true` で「VAD: ON」、`false` で「VAD: OFF」。`vadUnknown` ラベルは作らないシンプル設計。一覧では日付 / モデル / VAD を左に集約し、長さは引き続き `ml-auto` で右端固定。
- **i18n**: `Dictionary.history` に `vadEnabledLabel` / `vadDisabledLabel` を追加。ja/en 共通で「VAD: ON / VAD: OFF」(ユーザー判断で状態識別子として大文字統一)。`settings.vadEnabled = "VAD"` (チェックボックスラベル) や `glossary.vad.title = "VAD（音声区間検出）"` (用語解説タイトル) とは役割が異なるため衝突なし。`/i18n` 監査クリア。
- **フィクスチャ更新**: `createHistory.test.ts` の `mockMeta` / `mockEntry` に `vadEnabled: true` を追加。
- **アイコン色での状態表現を試して却下**: アクセント色 (`text-primary` violet) で有効/無効を区別する案を試したが、テキスト「有効/無効」のままだと違和感があるとの判断で取り下げ。最終的にラベルを「VAD: ON / VAD: OFF」に変更し、アイコン色は親継承 (`text-muted-foreground`) のままで他メタと統一感を維持。
- **スコープ外として残した項目**: VAD threshold / speech_pad_ms / language ヒント等の他メタ (本タスクは VAD ON/OFF に限定、`tuning.md` の方針通り)、Notion メタブロック (#10) との連携 (本タスクは履歴側の足場のみ)。
- **検証**: `/verify` の lint / typecheck / FE 265 tests / BE 330 tests / build 全通過。`/i18n` 構造・プレースホルダ・表記・使用箇所すべてクリア。

**Status:** 完了 (2026-05-15)

---

## 15. 文字起こし時の VAD ON/OFF 選択

### 背景
- 現状: VAD の ON/OFF は **設定画面でグローバル切替**のみ (`settings.vadEnabled`)。文字起こしを開始する瞬間にこの設定値が読まれて挙動が決まる (`createWhisper.ts::startTranscription` で `settings.vadEnabled()` を見て `vad_model_path` を渡すか判定)。
- 結果として「普段は VAD ON で使っているが、この録音だけは無音区間を残したい / VAD で削られたか確かめたい」というケースで、設定 → トグル OFF → 文字起こし → 設定に戻して再 ON、という往復が必要。
- #6 (履歴メタ拡充) で実行時の VAD 状態を履歴に残せるようになったが、その元データは設定値のスナップショットでしかない。実行時に都度選べるなら、履歴と UX の両方で意味が増す。

### 案
- **`TranscriptionOptionsBar.tsx` に VAD トグルを追加**:
  - 既存のモデル選択 / 言語選択と同じ行に配置。
  - solid-ui の `Switch` (Kobalte ベース、設定画面で使用中のもの) を流用。
  - 初期値は `createSettings().vadEnabled()` から取得 (= 設定はデフォルト値として残す)。
- **状態保持**:
  - `createWhisper` にローカル signal `vadEnabledOverride: boolean | null` を持たせ、ユーザーが触ったら override、null のままなら設定値を採用、という形が素直。
  - もしくは `createSettings().vadEnabled()` を毎回読み直すだけで十分なら override 不要。実行ごとに「設定値で初期化、トグルで上書き」というスナップショット方式が分かりやすい。
- **既存設定との関係**:
  - 設定画面の `settings.vadEnabled` は **デフォルト値**として残す (削除しない)。
  - 「常に VAD ON で使う人」は設定 1 回で済む、「都度切り替えたい人」はオプションバーで操作、の使い分け。

### 検討事項
- **UI 配置と密度**:
  - オプションバーは現状すでにモデル / 言語 / (開始ボタン) があり、ここに VAD トグルを足すと密度上昇。
  - 上級者向けと判断して「詳細オプション」アコーディオン配下に置くのも選択肢。ただし VAD は今回 #4 で用語ヘルプも整備済みなので、一般ユーザーにも見える位置で OK と判断する素直さの方が `tuning.md` の方針に近い。
- **i18n キー命名**:
  - トグルラベルは `settings.vadEnabled = "VAD"` をそのまま流用する案と、`transcription.vadEnabled` を新設する案がある。表示文字列が同じなら流用が DRY、ただし用途文脈が違うので将来ラベル変更しやすさを取って新設する手もある。
  - 用語ヘルプ (`HelpHint term="vad"`) もオプションバー側に置くか検討 (Settings の Whisper Card に既にあるので重複を避ける選択も妥当)。
- **VAD トグル切替時のフィードバック**:
  - トグル変更で即座に処理が始まるわけではないので、切り替え自体は静かに反映するだけで OK。「次回の文字起こしから適用」というヒントは過剰。
- **設定値とオプションバー値のシンク**:
  - **シンクしない方針が素直**。設定 = デフォルト (起動時 / 新規セッション開始時の初期値)、オプションバー = 今回の選択。設定をいじってもオプションバーは触らない。
  - 双方向シンクすると「設定で OFF → オプションバーで ON → 別ファイルを開いて文字起こし」のような流れで設定が暗黙に書き換わって混乱する。
- **#6 (履歴メタ) との関係**:
  - 履歴保存パス (`Transcription.tsx::saveToHistory`) で渡す `vadEnabled` を、設定値ではなく**実際に文字起こし時に使った値** (= オプションバーの値) に切り替える。
  - これで履歴の vad_enabled が真に「この実行で使われた値」を反映する。#6 完了時点では実質一致しているが、本タスク以降は意味が変わる。

### 実装ステップ案
1. `createWhisper.ts` に「実行時の VAD 状態」を持たせる (signal or 引数)。設定値で初期化。
2. `TranscriptionOptionsBar.tsx` に Switch を追加し、状態と双方向バインド。
3. `startTranscription` 内で `settings.vadEnabled()` ではなく実行時値を使うように変更。
4. `Transcription.tsx::saveToHistory` で履歴に渡す `vadEnabled` も実行時値に差し替え。
5. i18n キー (新設 or 流用) を決めて反映 → `/i18n` → `/verify` → コミット。

### 実施結果 (2026-05-15)

- **状態管理: override + fallback**: `createWhisper.ts` の module-level `createRoot` 内に `vadEnabledOverride: boolean | null` signal を新設。getter `vadEnabled()` は `override() ?? createSettings().vadEnabled()` で解決。初期値 `null` 時は設定値、Bar 操作後は override 固定で以降 Settings 変更が伝播しなくなる挙動。doc の「設定をいじってもオプションバーは触らない」を満たす最小実装。
- **シンク方針**: Bar → Settings の自動同期は意図的に実装しない。`onVadChange` は `whisper.setVadEnabled` のみを呼び `settings.update` には触らない。「Settings = 起動時デフォルト / Bar = 今回の選択」の役割分担を維持。
- **`saveToHistory` 置換**: `settings.vadEnabled()` → `whisper.vadEnabled()`。履歴の `vadEnabled` 列が「実行時に実際に使われた値」を反映するようになり、#6 の意味が拡張。
- **Checkbox ラッパー拡張**: optional `children` を `CheckboxPrimitive.Label` で wrap (ラベルクリックで toggle される a11y 標準動作)。副次修正として `items-top` (Tailwind に存在しない無効クラス) → `items-center`。Kobalte の render-prop children 型はラッパーレベルで `JSX.Element` に絞り、Settings.tsx の既存利用 (children なし) は影響なし。
- **UI**: grid `[2fr_2fr_3fr]` → `[2fr_2fr_auto_3fr]`、Language と Start の間に Checkbox + 'VAD' inline を `h-11 self-end` で配置 (Select trigger と垂直中央が揃う)。詳細オプションアコーディオン化は素直さ優先で却下。
- **i18n**: 新規追加なし。`t("settings.vadEnabled")` を流用 (表示文字列 "VAD" が一致するため doc が認めた DRY 案)。
- **テスト**: `createWhisper.test.ts` に override 動作の 3 ケース追加 (デフォルト値、override 反映、override false で `ensure_vad_model` をスキップ)。
- **検証**: `/verify` 全通過 (FE 268 / BE 330 / build)。`/i18n` 構造整合性 OK。

**Status:** 完了 (2026-05-15)

---

## 16. 要約・整文タブで保存ボタンを有効化

### 背景

- 現状: `ResultToolbar.tsx:244-245` で Save ボタンは `<Show when={!isTextProcessingTab()}>` でラップされ、`activeTab === "summary"` または `"cleanText"` のとき非表示になる。
- 設計理由: `ResultViewer.tsx::handleSave` が `exportResult(props.result, fmt)` で **元の `TranscriptionResult`** (= 元文字起こし) を txt/srt/vtt に書き出す実装。要約や整文後テキストには対応していないため、誤って元文字起こしが保存されるのを避けて隠す方針だった。
- 利用者目線では「要約をダウンロードしたいのに Save ボタンが消える」のは違和感がある。#9 で `formatSummaryAsText` ヘルパが入り、要約 → Markdown 整形が可能になったので、要約タブ固有の保存パスを揃えるタイミングとして適切。

### 案

- **タブごとに保存内容と拡張子を切り替える**:
  - text / timeline タブ: 現状通り `exportResult(props.result, fmt)` で **txt / srt / vtt** (flyout で format 選択)
  - summary タブ: `formatSummaryAsText(summary)` を **`.md`** で保存 (Markdown 固定、flyout なし or "Markdown" のみ)
  - cleanText タブ: `cleanTextResult` を **`.txt`** で保存 (format 固定)
- ファイル名のデフォルト:
  - summary: `{fileNameText}-summary.md`
  - cleanText: `{fileNameText}-cleaned.txt`
  - text / timeline: 既存の `transcription{ext}` を維持
- `ResultViewer.tsx::handleSave` を tab 分岐に拡張、`ResultToolbar.tsx` の `<Show when={!isTextProcessingTab()}>` を外す。
- i18n 追加: `dialog.mdFilter` (`Markdown` / `Markdown ファイル`)、保存ダイアログ title は既存 `dialog.saveTranscriptionTitle` を流用するか、summary 用に新設するか要検討。

### 検討事項

- **Save flyout のあり方**:
  - 現状の Save flyout (txt/srt/vtt) は format 選択を含む。summary タブで format が 1 つ (md) だけなら flyout を出す意味はなく、単発ボタンにする方が素直。
  - cleanText タブも format 1 つ (txt) → 単発ボタン。
  - 結局 tab に応じて「flyout (text/timeline) / 単発ボタン (summary/cleanText)」を切り替える形になる。
- **Notion へのシェアとの整合**:
  - Share メニュー (Notion 送信) は `getCopyText()` 経由で active tab の整形済みテキストを送る。Save も同様に「active tab の中身を整形して書き出す」という統一原則にすると一貫性が出る。
- **export.ts への追加**:
  - `formatSummaryAsText` は `src/lib/format.ts` にある。`exportResult` 系と性質が違う (構造体 → string vs `TranscriptionResult` → 整形済み export) ため、無理に統合せず Save 側で `if (tab === "summary") ...` 分岐するのが素直。
- **#9 (品質再検討中) との関係**: 要約構造体が変わるたびに保存形式も影響を受けるが、`formatSummaryAsText` を介すれば隠蔽できる。今回の改善はそのヘルパに依存するだけ。

**Status:** 未着手

---

## 17. 要約処理中の履歴ナビゲーション制御

### 背景

- 現状: 履歴詳細を開いて「要約」ボタンを押すと処理が始まるが、処理中に履歴を閉じて一覧に戻ることが**できてしまう**。
- 同じ履歴を再オープンしたとき、要約タブは表示されない (タブ自体が消えている)。「要約」ボタンを押し直すと要約タブが再表示され、**処理が継続していたことが分かる**。
- 利用者から見ると:
  - 処理中の視覚的フィードバックが履歴を閉じた時点で消える
  - 再オープン時に「処理中」が分からないので、もう一度「要約」ボタンを押す動機が生まれる
  - 結果として、内部で何が起きているか分からず混乱する

### 原因の見立て

- `ResultViewer.tsx::summaryTabVisible()`:
  ```ts
  summaryTabRequested() ||
  session.summaryResult() !== null ||
  (session.isProcessing() && session.currentOperation() === "summary")
  ```
- `summaryTabRequested` は signal で、コンポーネント再マウント (= 履歴再オープン) でリセットされる。
- `session.summaryResult()` は履歴 (`ai_content` テーブル) から復元されるが、**処理がまだ完了していない時点では履歴に保存されていない**ため null。
- `session.isProcessing()` は **新しい `createAiSession` インスタンスのローカル状態**で、前回セッション (履歴を閉じる前) とは別。再オープン時には false。
- 結果として 3 条件すべて false で要約タブが非表示になる。
- `onCleanup` で `cancelSession()` が呼ばれているはずだが、ユーザー報告では「続いている処理が見える」 → キャンセルが効いていないか、cancelSession 呼び出しの reach 自体に問題がある可能性。要確認。

### 案 (方針別)

- **方針 A (推奨・最小)**: 要約処理中は履歴を閉じる前に **確認ダイアログ**を出す。「処理中です。中断して閉じますか?」 → OK で cancel + close、Cancel で何もしない。
  - 実装: `History.tsx` の「閉じる」アクションを `session.isProcessing()` で条件分岐。
  - メリット: 状態管理を増やさず、混乱の原因 (静かに閉じられること) を断つ。
  - デメリット: 「閉じて他の作業をしながら待つ」フローは不可能になる。
- **方針 B (大きい)**: 処理中の状態をアプリ全体で永続化し、履歴を閉じても処理は継続。再オープン時に要約タブを「処理中」状態で復元。
  - 実装: 処理中の `taskId` / `historyId` / `currentOperation` をグローバル primitive (例: `createActiveJobs`) で保持。`ResultViewer` 再マウント時にそこを見て継続表示。
  - メリット: バックグラウンド処理を待ちながら他の履歴を見られる。
  - デメリット: 状態管理が複雑化。複数履歴を同時処理可能にするか、1 件限定か、設計判断が要る。Tauri 側の taskId とフロント状態の同期も再設計。
- **方針 C (穏当)**: 履歴を閉じる時点で **必ずキャンセル**し、トーストで「要約処理を中断しました」と通知。
  - 実装: `onCleanup` で `cancelSession()` + `toast.info()`。
  - メリット: 状態の嘘がなくなる (続いている "ように見える" 問題を解消)。
  - デメリット: 利用者の意図せぬキャンセルが起きる。

### 検討事項

- **cancelSession が本当に効いていないのか確認**: もし effective なら方針 C は不要、A の確認ダイアログだけで「明示的にキャンセルする」フローが完結する。`text_processing_cancel` の挙動と `INFERENCE_TASK_MANAGER.cancel_task` がリクエスト本体に伝わっているかをまず確認する。
- **方針 A での確認ダイアログ UX**:
  - 既存の `ConfirmDialog` (削除確認などで使用) を流用。文言は「文字起こし整形 / 要約 / タイトル生成のいずれかが処理中です。中断して閉じますか?」。
  - `currentOperation` で文言を出し分け (要約のみか cleanText 中かタイトル生成中か)。
- **方針 B を取る場合のスコープ膨張**:
  - グローバルな処理中ジョブの concept を入れると、Dashboard などからも見えるべきか、サイドバーに処理中インジケータを出すか、設計が広がる。プレリリース段階では過剰。
- **#9 との関係**: 要約処理が `stream:false` の `run_inference_blocking` 経由になり、進捗トークン表示はスピナーのみ。途中状態を保存する必要はないので、キャンセルで失う情報は最小限。
- **再現性**: 短い音声では処理が一瞬で終わるので確認しづらい。長文で再現 (チャンク要約 → 最終 structured 化のあいだの数十秒) を狙う。

### 推奨進め方

1. まず `text_processing_cancel` の挙動を実環境で確認 (cancelSession で効いているか)
2. 方針 A (確認ダイアログ) を実装 — 最も影響範囲が小さい
3. それでも UX が不十分なら方針 B (バックグラウンド処理永続化) を後追い検討

**Status:** 未着手

---

# B. モデル管理

公開モデルの取捨選択と利用者ディスクの整理。#7 → #8 の順で着手しないと、廃止モデルがディスクに残り続ける。

## 7. Whisper モデルを small / large-v3-turbo の2つに絞る

### 背景
- 現状: `src-tauri/src/whisper/models.rs` の `VALID_MODEL_IDS` は `["large-v3", "large-v3-turbo", "medium", "small"]` の4つ。
- 検証フェーズで4モデル並べたが、運用上は **軽量(small) と 高精度(turbo) の二択** で十分という仮説。
- `medium` は turbo に対して速度・精度ともに中途半端、`large-v3` は turbo に対して精度差が日本語の一般用途では明確に出にくい (要再検証)。

### 案
- 公開モデルを `small` / `large-v3-turbo` のみに変更。
- `medium`, `large-v3` は完全削除ではなく、**カスタム base URL 経由で手動指定すれば動く**状態を維持できると望ましい (拡張性)。
- リリースノートに「medium / large-v3 を廃止し、turbo に統合」を明記。

### 検討事項
- 既存ユーザーが `medium` / `large-v3` をダウンロード済みの場合の扱い:
  - 自動削除はしない。「不要モデルのクリーンアップ」(#8) と統合し、ユーザー操作で消せるようにする。
  - 設定画面では「廃止済み」ラベルで表示し、選択不可。再選択時は turbo へ誘導。
- 検証ログ (どの音声で turbo が large-v3 と同等以上だったか) を `docs/` 配下に残しておくと意思決定の根拠になる。
- 現状のユニットテスト / `model_path` の "small" 想定は変更不要。

### 実施結果 (2026-05-18)

- **採用方針: 完全削除**。`VALID_MODEL_IDS` を `["small", "large-v3-turbo"]` に縮め、`get_model_list` も同じ 2 件のみ返す形に変更。`is_valid_model_id` が廃止 ID を弾くため `model_path` / `model_exists` / `download_model` / `delete_model` は同時に拒否され、API レベルで一貫した状態に。検討事項にあった「カスタム base URL 経由で medium / large-v3 を取得可能」案は、`is_valid_model_id` の縮小と両立できないため意図的に見送り。
- **プレリリース前提でシンプル化**: 当初は `Settings.whisperModelId` が廃止 ID だった場合の自動切替 + トースト通知 (`MigrationNoticeWatcher` / `migrationNotice` signal / 専用 i18n キー) を実装したが、リリース前で実ユーザーがいないため不要と判断して全削除。`autoSelectModel` は元の「saved があれば復元、なければ downloaded[0]」のロジックに戻した。
- **i18n**: `models.whisper.medium.description` / `models.whisper.largeV3.description` を `Dictionary` 型と ja/en 辞書から削除。`/i18n` クリア。
- **テスト**: `models.rs` ユニットテストを 2 モデル前提に改修。`is_valid_model_id_rejects_unknown_models` と `get_speed_factors_unknown_model` に `"medium"` / `"large-v3"` を追加して、廃止 ID も「未知 ID」と同列に扱う形に集約。`get_model_list_excludes_legacy_models` でも turbo 以外が含まれないことを確認。`history/*` のテスト fixture は `"large-v3"` をすべて `"large-v3-turbo"` へ機械置換。Frontend では fixture を turbo 表記に揃えるのみで新規テストはなし。
- **Docs**: `README.md` のモデル表を 2 行に縮め、機能サマリーも turbo へ変更。`docs/install.md` はモデル ID への言及なしで変更不要。
- **スコープ外として残した項目**: カスタム base URL 経由での廃止モデル再取得、`ModelInfo` への `deprecated` フラグ追加、Storage 集約 UI / 自動クリーンアップ機能 (#8 へ委譲)。
- **検証**: `/verify` の lint / typecheck / FE 268 tests / BE 328 tests / build 全通過。

**Status:** 完了 (2026-05-18)

---

## 8. 不要 LLM / Whisper モデルのクリーンアップ機能

### 背景
- ローカルにダウンロードした GGUF / ggml モデルは数 GB 単位。長く使うと不要モデルが溜まる。
- #7 (Whisper モデル絞り込み) で廃止したモデルも、ユーザー側のディスクには残る。

### 案
- 設定 → 「ストレージ」セクション (新設) に以下を追加:
  - インストール済みモデル一覧 (whisper / LLM 両方) と各サイズ。
  - 「使われていないモデル」を強調表示 (現在の選択 / 過去N日以内に使ったログ等を基準)。
  - 個別削除 / 全選択削除ボタン。確認ダイアログ必須。
- 廃止されたモデル ID (例: `medium`, `large-v3`) はラベルに「廃止済み」を付けて削除を促す。
- 起動時 / 設定画面オープン時に「合計サイズが Xで GB を超えています」のお知らせバナーを薄く出すのは過剰なので不要。

### 検討事項
- "最後に使った日時" を記録するには履歴 SQLite に `model_id` 列が要る。既にあれば再利用、無ければ追加。
- LLM モデルファイルは `text_processing/models.rs` の管理対象。Whisper との UI を統一して同じセクションに並べるのが自然。
- 削除直後に再ダウンロードが必要になるケースの導線 (1クリックで再取得) も用意。

### 実施結果 (2026-05-19)

#### 経緯
- 当初は Whisper / LLM 両方に「廃止モデル検出 + 削除導線 + 合計サイズ表示」(中スコープ) を実装したが、レビューで「Whisper モデルは `small` / `large-v3-turbo` で完結し今後廃止候補が出ない。一方 LLM は良いモデルが出るたびにアップデート/追加していく」との方針が出たため、**廃止モデル機構を Whisper 側から取り下げ、LLM 側にのみ移植**する形に修正。
- `.claude/rules/tuning.md` の「過剰機能を避け仕様として許容する側に倒す」方針に整合。

#### 最終構成

- **Whisper 側**: 廃止モデル機構は持たない。`delete_model` は元の `is_valid_model_id` 厳格チェック。既存の medium / large-v3 ファイル (本機ディスク上で約 4.6 GB) はユーザーが手動削除する。
- **LLM 側**: 廃止概念のインフラを導入。現状 `LEGACY_MODEL_IDS` は **空配列**で、次回 LLM をアップデート/廃止する際に ID を追加するだけで Settings の「廃止済みモデル」Card が自動で機能する。
- **合計サイズ表示**: Whisper / LLM 両方の Card 末尾に「合計: X.X GB」を表示 (`formatBytes` ユーティリティを汎用化)。

#### Rust 側

- `text_processing/models.rs`:
  - `LEGACY_MODEL_IDS: &[&str] = &[]` (空配列、将来用)
  - `legacy_model_filename(id) -> Option<&'static str>` (match arm を追加することで廃止 ID とファイル名を対応付け。clippy `match_single_binding` は `#[allow]` で抑制し将来の arm 追加に備えた形を維持)
  - `is_legacy_model_id` / `is_known_model_id` / `legacy_model_ids()` 公開関数
  - `known_model_filename` / `known_model_path` の統合ヘルパー (valid または legacy を許容)
- `text_processing/types.rs`: `LegacyTextModelInfo { id, sizeBytes, path }`
- `text_processing/commands.rs`:
  - `text_processing_delete_model` を `known_model_path` ベースに緩和、未知 ID は `TextProcessingError::ModelNotFound` で早期エラー
  - 新規 `text_processing_get_legacy_models` コマンド (`scan_legacy_text_models` 純粋関数を内部で呼ぶ)
  - `scan_legacy_text_models` は `fs::metadata` の `ErrorKind::NotFound` で「ファイル無し」を吸収し、`exists()` + `metadata()` の 2 syscall + TOCTOU を回避
- `lib.rs` の `invoke_handler!` に登録
- BE 単体テスト: `legacy_model_ids_is_currently_empty` で「現在は空」を明示、`scan_legacy_text_models_is_empty_when_none_retired` で valid モデルファイルが混入しないことを確認、`LegacyTextModelInfo` シリアライゼーション、`known_model_filename` / `known_model_path` の 4 ケース。BE 全 335 件通過。
- 新規エラーバリアントは追加せず既存 `TextProcessingError::ModelNotFound` / `Io` のみで完結。

#### フロント側

- `src/types/text-processing.ts` に `LegacyTextModelInfo` 追加、`src/types/index.ts` に re-export
- `src/lib/format.ts`:
  - `formatBytes(bytes)` — 1024-base + 小数 1 桁 (100 以上は整数)。Rust 側既存表記 (`"466MB"` = MiB、`"1.6GB"` = GiB) と数字が一致
  - `sumDownloadedBytes(items)` / `sumBytes(items)` — `filter(downloaded).reduce(sizeBytes)` の重複を共通化 (Whisper / LLM の `totalSizeBytes` で共有)
  - `format.test.ts` で `formatBytes` の境界値 8 ケース
- `createTextProcessing.ts`:
  - `legacyModels` signal、`loadLegacyModels()` / `deleteLegacyModel()` action
  - `totalSizeBytes()` = `sumDownloadedBytes(models()) + sumBytes(legacyModels())`
  - `_resetTextProcessingForTesting()` に `setLegacyModels([])` 追加
- `createWhisper.ts`:
  - `totalSizeBytes()` = `sumDownloadedBytes(models())` (legacy は持たない)
- 新規 `src/components/text-processing/LegacyTextModelList.tsx` (~100 行)
  - `<Show when={legacyModels().length > 0}>` で条件レンダの独立 Card
  - `onMount` で `tp.loadLegacyModels()` を自己完結で呼ぶ → 親が legacy 読み込みを意識する必要なし
  - `Badge variant="outline"` で「廃止済み」、`FiArchive` アイコン、`SectionRow` + `ConfirmDialog` で削除導線
- 新規 `src/components/ui/TotalSizeFooter.tsx`
  - `<Show when={bytes > 0}><p>合計: <formatted></p></Show>` の共通化
  - `formatBytes` と `settings.totalSize` i18n キーを内部に隠蔽
- `Settings.tsx`:
  - Whisper Card の `CardContent` 末尾に `<TotalSizeFooter bytes={whisper.totalSizeBytes()} />`
  - TextModelManager の後ろに `<LegacyTextModelList />` を挿入
- `TextModelManager.tsx`: `CardContent` 末尾に `<TotalSizeFooter bytes={tp.totalSizeBytes()} />` (legacy 含む)。`role="radiogroup"` は内側 `<div>` に移し合計サイズ行を a11y 上分離

#### i18n (`textProcessing.*` 名前空間)

| キー | ja | en |
|---|---|---|
| `legacyModelsTitle` | 廃止済みモデル | Deprecated Models |
| `legacyModelsDescription` | 現在は提供していない言語モデルです。ディスク容量を解放するには削除してください。 | These language models are no longer offered. Delete them to free up disk space. |
| `legacyModelBadge` | 廃止済み | Deprecated |
| `deleteLegacyModelConfirmation` | {id} を削除します。このモデルは再ダウンロードできません。 | {id} will be deleted. This model cannot be re-downloaded. |
| `legacyModelDeletedToast` | {id} を削除しました | Deleted {id} |

`settings.totalSize` (汎用、Whisper / LLM 両方で使用) も同時に追加。

#### スコープ外として残した項目

- 最終使用日時の集計 (`history` の `model_id` を使った aggregate)
- 不要モデル強調表示
- 削除直後の 1 クリック再取得導線
- 複数選択一括削除
- 起動時バナー
- Whisper 側の廃止モデル UI (今後廃止候補が出ない方針のため不採用)

#### 動作確認のタイミング

- **Whisper 側 (合計サイズ表示)**: 即時確認可能。`pnpm tauri dev` で Settings → Whisper Model Management Card 末尾に「合計: X.X GB」が表示される。
- **LLM 側 (廃止モデル UI)**: 現状 `LEGACY_MODEL_IDS` が空のため Card 非表示が正常状態。実環境動作確認は **次回 LLM 廃止モデル発生時** に持ち越し。下記「次回 LLM 廃止時の運用手順」を参照。
- **LLM 側 (合計サイズ表示)**: 即時確認可能。Settings → Language Model Management Card 末尾に表示。

#### Whisper 既存ファイルの手動削除 (本機作業)

本機 (`com.whisper-tauri.desktop`) には #7 以前にダウンロードされた廃止 Whisper モデルファイルが残っている。アプリ側の UI は持たないため手動削除:

```bash
ls -la "~/Library/Application Support/com.whisper-tauri.desktop/models/"
# ggml-medium.bin   約 1.5 GB
# ggml-large-v3.bin 約 3.1 GB
rm "~/Library/Application Support/com.whisper-tauri.desktop/models/ggml-medium.bin"
rm "~/Library/Application Support/com.whisper-tauri.desktop/models/ggml-large-v3.bin"
```

`ggml-small.bin` / `ggml-large-v3-turbo.bin` / `ggml-silero-v5.1.2.bin` は現役なので残す。

#### 次回 LLM 廃止時の運用手順

良いモデルが出て旧モデルを廃止する際は、以下の 3 ステップで Settings の「廃止済みモデル」Card が自動で機能する:

1. **`src-tauri/src/text_processing/models.rs::VALID_MODEL_IDS`** から廃止する ID を削除
2. **`LEGACY_MODEL_IDS`** に同じ ID を追加 (例: `const LEGACY_MODEL_IDS: &[&str] = &["gemma-4-e2b"];`)
3. **`legacy_model_filename`** の match arm に該当 ID とファイル名を追加:
   ```rust
   match model_id {
       "gemma-4-e2b" => Some("google_gemma-4-E2B-it-Q4_K_M.gguf"),
       _ => None,
   }
   ```

その他必要に応じて:
- `models.rs` の `get_model_list()` から該当エントリを削除
- `i18n/dictionaries/{ja,en}.ts` の `models.text.<id>` 説明文を削除
- `models.rs::tests::legacy_model_ids_is_currently_empty` の `assert!(is_empty())` を「廃止 ID が含まれる」前提のテストに更新
- BE/FE 既存テストの fixture (もし `gemma-4-e2b` 等を使っていれば) を新モデルに置換

廃止後、`pnpm tauri dev` で Settings を開けば、旧モデルファイルが残っているマシンでは「廃止済みモデル」Card が自動表示され削除ボタンが機能する (UI/コマンド/型はすでに揃っているため追加実装は不要)。

#### 検証

- Biome lint / `tsc --noEmit` 全通過
- FE 278 tests (新規 +8: `formatBytes` 8 ケース)、BE 335 tests (新規 +8)
- Tauri build (debug) 通過
- `/i18n` 監査 — 構造・プレースホルダ・表記・使用箇所すべてクリア
- `cargo clippy --all-targets` clean (`legacy_model_filename` の単一 arm match は `#[allow(clippy::match_single_binding)]` で意図的に suppress)
- `/simplify` レビュー (3 agent 並列) — `TotalSizeFooter` / `sumDownloadedBytes` の共通化、`fs::metadata` の `NotFound` 吸収、コメントの WHY 化を反映済み
- 手動動作確認: 上記「動作確認のタイミング」を参照

**Status:** 完了 (2026-05-19) — LLM 側の実環境動作確認は次回廃止モデル発生時に行う

---

# C. Notion 連携の強化

主要出力先の品質を上げる。要約構造 (#9) を先に固めると、Notion ブロック構造 (#10) のマッピングが綺麗に決まる。履歴メタ (#6) の基盤と同じ "実行時メタの保管・表示" パターンを共有する。

## 9. 要約の充実 (Notion 向けにキーワード / アクションアイテム / 3行要約)

### 背景
- 現状: 単一の要約タブ (`ResultSummaryTab.tsx`) と要約処理 (`text_processing/`)。
- Notion 送信時の価値を上げるには、要約 = "粒度の違う複数の出力" として扱った方が良い。

### 案
- 出力構造を以下に変更 (LLM 1回呼び出しで一括生成 → JSON で受け取る):
  ```json
  {
    "headline": "1行タイトル",
    "tldr": ["3行要約 1", "...", "..."],
    "keywords": ["k1", "k2", ...],
    "action_items": [{"who": "...", "what": "...", "due": "..."}],
    "key_points": ["重要トピック1", "..."]
  }
  ```
- フロント側ではタブを「要約 / キーワード / アクション」の3つに分ける、もしくは1タブ内でセクション分け。
- Notion 送信ではこれをブロック構造にマップ (#10 と連携)。

### 検討事項
- LLM への プロンプトを1本にまとめるか分割するか:
  - **1本推奨**。コンテキストが共有でき、トークンも節約。出力 JSON は `extract.rs` でバリデーション。
  - 分割すると要約とキーワードで前提がズレるリスク。
- 要約処理を「現行要約の改修」にするか「summary v2 として並行実装」にするか:
  - 並行実装はメンテ負荷増。**改修一本でよい** (プレリリース段階のため後方互換不要)。
- LLM モデルの能力差で出力 JSON が壊れることがある。`tuning.md` に従い、モデル側の弱点を隠す独自整形は最小限に留め、JSON モード or 構造化出力をサポートする llama.cpp の機能 (`grammar`) を素直に使う。
- アクションアイテムは抽出が難しい (会議じゃない録音だと空配列になる)。空でも UI が破綻しないよう「該当なし」表示を用意。

### 実施結果 (2026-05-19)

- **構造化方式**: HTTP リクエスト本体に `response_format: {type:"json_schema", json_schema:{name, schema, strict:true}}` を渡す方式に決定。llama-server 起動引数の `--grammar-file` は `clean_text` / `chat` / `title` にも影響するため採用せず、リクエスト単位で切り替えられる OpenAI 互換の `response_format` を使う。`.claude/rules/tuning.md` の「標準機能を素直に使う」方針通り。
- **出力構造**: `StructuredSummary { headline, tldr[], keywords[], actionItems[], keyPoints[] }`。`ActionItem { who?, what, due? }` は `who` / `due` のみ optional (会議以外で欠落しやすい)。全配列は空許容で、空セクションは UI 側で非表示。
- **ストリーミング扱い**: 要約だけ `stream:false` に切り替え、`run_inference_blocking` 新規追加。`clean_text` / `chat` / `generate_title` は SSE ストリーム維持。途中の壊れた JSON を progress text として描画する経路を回避し、UI は「処理中…」のスピナーだけにした。
- **チャンキング**: 長文 (>4000 文字) は中間チャンク要約だけ平文に分け (`build_chunk_condense_messages` 新設、SSE で逐次)、最終 1 回だけ structured 出力。各チャンクで structured 出力する設計は過剰と判断。
- **System prompt**: 旧マークダウン指示 (`### 見出し` + `<example>`) を削除し、各フィールドの意味だけ書く最小構成に。フォーマット指定はスキーマに任せて、モデルの弱点を独自整形で隠さない方針に統一。
- **JSON schema**: `inference.rs::summary_json_schema` に定数化。`additionalProperties: false` + `strict: true` で型ずれを拒否。`required` は `[headline, tldr, keywords, actionItems, keyPoints]` の 5 フィールド、`actionItems.items.required` は `[what]` のみ。
- **TS 型**: `StructuredSummary` / `ActionItem` を `src/types/text-processing.ts` に追加、`types/index.ts` で re-export。Rust 側と完全に対称。
- **タブ構成**: 単一 Summary タブ内をセクション分割 (3 タブに分けない)。`headline → tldr → keyPoints → actionItems → keywords` の順で縦に並べ、空配列セクションは `<Show>` で非表示。`keywords` は chip 風 (`rounded-full bg-muted/60 px-2.5 py-0.5`)、`actionItems` は who/what/due の縦並びカード、`tldr` / `keyPoints` は既存の bullet スタイル流用。
- **履歴データ形式**: 既存 `ai_content.text` に `JSON.stringify(structured)` をそのまま保存 (DB スキーマ変更なし)。復元時 (`loadFromAiContent` の `case "summary"`) は `parseSummaryContent` で `JSON.parse` を試み、失敗時は plain text として `tldr[0]` に流すフォールバック。プレリリースのため過去データ互換は不要だが、壊れた JSON / 旧形式 plain text の両方を吸収する形にした。
- **コピー機能**: `src/lib/format.ts::formatSummaryAsText` を新設。Markdown 風 (`# Headline` / `## TL;DR` / `## Key Points` / `## Action Items` / `## Keywords`) に整形。空セクションはスキップ。`ResultViewer.getCopyText` の `tab === "summary"` 分岐で使用。#10 (Notion ブロック送信) でもこのヘルパを再利用する想定。
- **createAiSession 型変更**: `summaryResult: Accessor<StructuredSummary | null>`、`summarize(text): Promise<StructuredSummary | null>`。`runExtraction` をジェネリクス化して `serialize: (v: T) => string` を受け取り、Summarize 側は `JSON.stringify`、CleanText 側は identity を渡す形に統一。
- **clippy `too_many_arguments`**: `run_inference_blocking` が引数 8 つになり既存 `run_inference` (7) を超えたため `#[allow(clippy::too_many_arguments)]` を付与。リクエスト構造体への抽出は別タスクとして温存。
- **i18n キー**: `textProcessing.*` に 6 件追加 (`summaryTldr` / `summaryKeyPoints` / `summaryKeywords` / `summaryActionItems` / `summaryActionWho` / `summaryActionDue`)。ja は「要点 / 重要トピック / キーワード / アクションアイテム / 担当 / 期日」、en は Title Case ("TL;DR" / "Key Points" / "Keywords" / "Action Items" / "Who" / "Due")。
- **`formatSummaryAsText` の見出しは英語固定**: Markdown 規約として汎用性が高いことと、#10 Notion ブロック化で同じ文字列を再利用する想定のため、ロケール非依存にした。ロケール別翻訳は将来検討余地あり。
- **テスト追加**: Rust 側に `structured_summary_roundtrips_full` / `structured_summary_roundtrips_empty_arrays` / `action_item_omits_none_fields` / `action_item_accepts_missing_optional_fields` / `summarize_system_describes_structured_fields` / `summary_json_schema_has_all_required_fields` / `summary_response_format_wraps_schema`。TS 側に `parseSummaryContent` の 5 ケース (`createAiSession.test.ts` 新規) と `formatSummaryAsText` の 3 ケース (`format.test.ts` に追加)。
- **検証**: `/verify` の lint / typecheck / FE 286 tests / BE 341 tests / build 全通過。`/i18n` 構造・プレースホルダ・表記・使用箇所すべてクリア。
- **動作確認のタイミング**: バックエンド単体テスト + フロント tsc/lint/test レベルでは検証済み。実 llama-server を起動した end-to-end (短い独白で `actionItems` 空・会議録で複数項目・英語入力・履歴復元・コピー貼り付け) は手動確認待ち。
- **スコープ外として残した項目**:
  - モデル別プロンプトチューニング (gemma-4-e2b vs qwen3.5-4b の差分は許容)
  - ユーザーカスタムプロンプト
  - 要約再生成の細粒度制御 (フィールド単位の再生成)
  - Notion ブロック送信側マッピング (#10 で対応、`formatSummaryAsText` を再利用予定)
  - 旧形式データの自動マイグレーション (プレリリース前提のため不要、`parseSummaryContent` のフォールバックで吸収)
  - `chat` / `clean_text` / `generate_title` の structured 化
  - 要約バージョニング (`optionsJson` に schemaVersion を持たせる拡張)
  - llama-server 起動引数 (`--grammar-file`) の利用 — リクエスト単位の `response_format` で十分
  - `run_inference_blocking` のリクエスト構造体抽出 (clippy `too_many_arguments` 抑制で対応)
  - `formatSummaryAsText` のロケール対応 (Markdown 規約として英語固定)

### 品質再検討 (2026-05-19, 同日)

実環境で短文音声に対して試したところ、以下の品質問題が浮かんだ:

1. **tldr と keyPoints の差が薄い**: 「2〜3 行の tldr」と「2〜5 個の keyPoints」が抽象度違いだけで内容が重複し、階層構造として意義が薄かった
2. **actionItems の誤検出**: 独白・朗読・雑談など本来 actionItems が無い音声でも、LLM が 1 件無理に抽出してしまう傾向

`.claude/rules/tuning.md` 方針 (workaround より仕様変更で対応) に従い、以下の構造変更で対応:

- **tldr を `Vec<String>` → `String` に変更**: 1〜2 文 (80〜150文字程度) の「リード段落」に再定義。配列ではなく単一文字列で、箇条書きの体裁を捨てた
- **keyPoints の位置づけを「サブトピック箱条書き」に明確化**: tldr の言い換えではなく、tldr で触れなかった**具体的な論点・話題・事実**を 1 件ずつ取り出す役割。プロンプトで「tldr と内容を重複させない」と明示
- **actionItems プロンプトを厳格化**:
  - 「多くの音声では空配列が正解。独白・朗読・講演・雑談・インタビュー・説明動画では必ず空配列」
  - 「話題提示や感想は action item ではない。明確な指示・依頼・約束のみ」
  - 「1 件だけ抽出するくらいなら空配列にする方が良い」
  - 「who / due は発話で明示されているときのみ。文脈推測は不可」
- **UI**: tldr を bullet list から段落 (`<p>`) 表示に変更
- **`parseSummaryContent` の後方互換**: 旧形式の `tldr: string[]` データを `Array.join(" ")` で吸収

スキーマ・JSON schema の変更:
- `StructuredSummary.tldr`: `Vec<String>` → `String` (Rust) / `string[]` → `string` (TS)
- `summary_json_schema`: `tldr` の type を `array` → `string`

テスト更新:
- `structured_summary_roundtrips_empty_arrays` → `structured_summary_roundtrips_empty` に名前変更 (tldr は配列ではなくなったため)
- `summarize_system_describes_structured_fields` に「総括」「サブトピック」「空配列」の assertion 追加
- `parseSummaryContent` の legacy array fallback ケースを `createAiSession.test.ts` に追加
- `formatSummaryAsText` のテストを新 schema (`tldr: string`) に合わせて更新

検証:
- `/verify` の lint / typecheck / FE 287 tests / BE 341 tests / build 全通過
- 実環境での品質検証 (短い独白で actionItems が本当に空になるか / 会議録で tldr と keyPoints が分離されるか) は次のセッションで確認

### 品質再検討 第2弾 (2026-05-19, 同日)

実環境での再試行で「アクションアイテムの担当者推定が信頼できない」「長い音声 (講演 / 1 時間超会議) で keyPoints が少なすぎる」というフィードバックが出たため、追加で以下を実装:

- **`ActionItem.who` を完全削除**: スキーマ・Rust struct・TS interface・UI・i18n キー (`summaryActionWho`) を全削除。発話だけから担当者を特定するのは LLM の能力外と判断し、仕様として割り切る。`due` (期日) は明示発話があるときのみ抽出する形で温存
- **ActionItems を箇条書き UI に変更**: 旧カード形式 (`<li class="rounded-md border ...">`) を keyPoints と同じ bullet スタイル (`• {what} (期日: {due})`) に統一。視覚的な「タスクの重さ」を減らし、tldr / keyPoints と並んで読める密度に
- **入力長に応じた keyPoints 動的レンジ**:
  - `inference::summary_params_for_length(text_chars: usize) -> SummaryParams` を新設。返り値は `(key_points_min, key_points_max, max_tokens)` の純粋関数
  - バケット: `<1500: 2〜4 / 1500〜5000: 3〜6 / 5000〜15000: 5〜10 / >=15000: 7〜15`、max_tokens は `2048 / 2048 / 3072 / 4096` でスケール
  - `build_summarize_messages` を `(text, min, max)` シグネチャに拡張し、`format!` でプロンプトに目安数を埋め込み
  - `text_processing_summarize` で `text.chars().count()` を測って渡す。チャンク要約で短くなる前の **元の文字数ベース** で決める (ユーザーが触る指標と整合)
- **重複時の減少を許容するプロンプト**: 「内容が重複する場合は項目数を下回ってよい — 同じ趣旨の項目を 2 つ以上書かない」を明示。LLM が範囲下限を埋めようとして水増しするのを防ぐ
- **担当者推定オフのプロンプト記載**: 「担当者の推定は行わない (スキーマにも含まない)」を actionItems ルール 4 に明記。スキーマと文章の両方で off を表明

検証:
- `/verify` の lint / typecheck / FE 287 tests / BE 344 tests / build 全通過
- 新規 Rust テスト 3 件追加 (`summary_params_scale_with_length` / `summary_params_bucket_boundaries` / `summarize_system_embeds_key_points_range`) + 既存テスト更新 (`action_item_omits_none_due` / `action_item_accepts_missing_due` に rename、`summary_json_schema_has_all_required_fields` に who absence の assertion)
- TS 側 fixture も新型に統一 (`createAiSession.test.ts` / `format.test.ts`)

スコープ外として残した項目 (品質再検討で新たに保留):
- duration / segment 数を入力長として使う案 (今回は `text.chars().count()` のみ。`tldr` / `keyPoints` の質には文字数で十分)
- バケット境界の微調整 (実環境フィードバック次第で調整)
- 同じ意味の keyPoint を機械的に重複検出する後処理 (`tuning.md` の workaround 警告に抵触するため見送り。プロンプトでカバー)

**Status:** 進行中 (品質再検討) — Rust/TS の構造化変更とプロンプト調整を 2026-05-19 同日に追加実装。次のセッションで実環境動作確認の上、結果に応じて完了 or さらなる調整を判断

---

## 10. Notion へ "ブロック送信" + メタデータ付与

### 背景
- 現状: テキストを1ページに流し込む単純送信 (推測。要確認)。
- ユーザーの想定 UX: 「日時・元ファイル名・モデル名・処理時間・要約」などのメタデータがブロックで構造化されているページが作られる。

### 案
- Notion API のページ作成リクエストで、以下を **明示的にブロック分割** して送る:
  1. ヘッダ: タイトル (= ファイル名 or 日時)
  2. プロパティブロック (callout または 2列テーブル):
     - 録音日時 / 文字起こし日時
     - 使用モデル (`large-v3-turbo` 等)
     - 処理時間 / 音声長
     - 元ファイル名
  3. 要約ブロック (#9 と連動)
  4. divider
  5. 本文 (適宜 paragraph 分割。発話区切り or 一定文字数で切る)
- Notion 側のテンプレートにユーザーが寄せられるよう、見出しレベル (H2/H3) は固定にしておく。

### 検討事項
- 一度に大量ブロックを送ると Notion API が `rate limit` / `request too large` を返すことがある。100ブロック超は append で分割。
- 既存の `notion/types.rs` / `client.rs` の構造を、汎用 `NotionBlock` enum に整理する小リファクタが先に要りそう。
- ブロックの内容 (項目順、メタの有無) はユーザー設定で ON/OFF できる方が後々助かる、ただしまずは固定でリリースして要望を見るのが良い。

**Status:** 未着手

---

# D. 中長期

リリース後でも段階的に着手できる。優先度低だが価値は大きいので、フェーズを区切って取り組む。

## 11. ffmpeg / llama.cpp バイナリの更新フロー

### 背景
- 現状: バージョンを固定して URL 直書きでダウンロード (`converter/`, `text_processing/extract.rs`)。
- セキュリティ脆弱性 (ffmpeg は CVE が定期的に出る) や llama.cpp の機能更新に追随する手段が手動更新のみ。

### 案
- **更新ポリシーを明文化**:
  - メジャーリリースに合わせて手動更新する (自動更新はしない)。
  - 各バイナリのバージョン情報を `src-tauri/src/{converter,text_processing}/version.rs` 等に集約し、URL / SHA256 / バージョン文字列を1箇所で管理。
- **整合性チェック**: ダウンロード後に SHA256 を検証 (現状チェックしているか確認要)。していなければ追加。
- **アプリ起動時のバージョン突合**: バンドル想定バージョンとローカルにあるバイナリのバージョンを比較し、不一致なら "更新可能" 表示。
- **更新手順を docs 化**: `docs/binary-updates.md` (仮) を作り、新バージョンへの差し替え手順 (URL更新 → SHA256更新 → ローカル検証 → リリース) を残す。

### 検討事項
- 「自動アップデート」は誤算定が起きやすく、ローカル LLM のように動作実績が大事な領域では非推奨。手動 + ユーザー通知 が安全。
- ffmpeg は GPL ビルドと LGPL ビルドで配布元が違う。ライセンス整合は事前確認。
- llama.cpp は API が破壊的に変わる時期があるため、`extract.rs` / 起動引数の互換性検証を更新フローに含める。

**Status:** 未着手

---

## 12. リアルタイム文字起こし / 話者識別

### 背景
- 現状: `recording/` モジュールで cpal を使い録音 → 録音停止後に whisper を一括実行。
- リアルタイム書き起こしと話者識別は、ミーティング・インタビュー用途で大きな価値がある。
- ただし両方とも whisper-rs 単体では完結しない領域。

### 案
- **リアルタイム書き起こし**:
  - 案A: 既に導入済みの Silero VAD (スタンドアロン、`process.rs:preprocess_with_vad`) を録音ストリームに対して逐次適用し、発話区切りごとに whisper を実行 (低レイテンシ・低負荷だが文脈が短い)。
  - 案B: 30秒 sliding window で逐次推論 (文脈は保てるがCPU負荷高)。
  - 推奨は A から始める。バッチ処理パスで使っている VAD ロジックを、ストリーム入力にも流用できるかが最初の検証点。
- **話者識別 (diarization)**:
  - whisper 単体では不可。pyannote / `sherpa-onnx` の話者埋め込み + クラスタリングが現実解。
  - Rust から扱うなら `sherpa-onnx` (ONNX Runtime, Rust binding 有) が候補。
  - 1段目は「話者数を手入力」「2人固定」など制約付きで導入し、フル diarization は段階的に。

### 検討事項
- Apple Silicon の Metal バックエンドでリアルタイム処理が現実的か事前ベンチが必要。
- リアルタイム表示 UI: 確定済みテキスト + tentative テキスト (薄字) の2層表現を採用するか。
- 話者識別の精度は会議録音で評価しないと机上の空論になる。テスト用音源を `tests/fixtures/` に整備する前提で計画。
- 既存の `RecordingPanel.tsx` / `TranscriptionResult.tsx` の状態モデルに、ストリーム/セグメント/話者 を追加する大きめのリファクタが入る。スコープを区切って PR を分割。

**Status:** 未着手

---

# E. リリース直前整備

プレリリース段階の機能・UI 開発が落ち着いた後、リリース直前にまとめて整備する領域。CI/CD (#13) で土台を固めてから、Win/Linux ビルド (#14) で配布物を完成させる。

## 13. CI / CD の調整

### 背景
- 現状の `.github/workflows/` は `release.yml` のみ。タグ push もしくは手動 dispatch でビルド + リリースを回す構成。
- **PR 単位の lint / typecheck / test ワークフローが存在しない** ため、メイン以外でのリグレッション検出が手元の `/verify` 頼み。
- リリースワークフローもいくつか改善余地: tauri-action の `args` 切替が if 分岐2回で冗長、Windows / Linux のリリース成果物添付が tauri-action 内部任せでブラックボックス。
- `SOURCE_DATE_EPOCH` のワークアラウンド (`workarounds.md` 参照) は維持必須。

### 案
- **PR チェックワークフロー (`.github/workflows/ci.yml` 新設)** を追加:
  - トリガ: `pull_request` (main 宛) と `push` (main)。
  - ジョブ:
    1. **frontend**: `pnpm check` / `pnpm test:run` (Node + pnpm のみ。Rust 不要なので速い)
    2. **backend**: `cargo fmt --check` / `cargo clippy -- -D warnings` / `cargo test`
    3. **build smoke** (任意): `pnpm tauri build --debug` を ubuntu のみで回し、ビルドが通ることを確認。フルビルドは時間がかかるので OS 縛り + デバッグビルドで節約。
  - キャッシュ: `swatinem/rust-cache` と pnpm store cache を使う。
- **release.yml の整理**:
  - `if` 分岐2回で同じ `tauri-action` を呼んでいる部分を統合。`releaseDraft` / `tagName` を入力で切り替えるだけにする。
  - Windows / Linux の成果物アップロードを明示化 (現在は tauri-action のデフォルト挙動任せ)。
  - `RELEASE_TAG` の test 用フォールバックは残すが、build-only モードのときは明示的にリリース作成をスキップしていることをコメントで明文化。
- **依存自動更新** (将来):
  - Dependabot もしくは Renovate で `pnpm` / `cargo` / `actions/*` のバージョン更新 PR を自動化。CI が整ってからの導入が前提。

### 検討事項
- CI のフルビルド (release ビルド3 OS) をどこまで頻度高く回すか。**PR 毎は重すぎるので、main マージ後に nightly で回す**くらいが現実解。
- `cargo clippy` の `-D warnings` を CI で強制すると、whisper-rs の FFI 周りで `unsafe` 警告が出やすい。`workarounds.md` のワークアラウンドが clippy に引っかからないか事前確認。
- Apple 署名・公証は秘密情報ゆえテストが難しい。当面は手動リリースで動作確認、自動化は最後。
- リリース時の changelog 自動生成 (git-cliff / release-please) は今は不要。手書きで対応できる規模。

### 実装ステップ案
1. `ci.yml` を frontend / backend ジョブだけで先に作る (build smoke は後回し)。
2. 既存 PR を1つ流して動作確認、必要なら biome / clippy ルールを微調整。
3. release.yml をリファクタ (機能変更なし、可読性のみ)。
4. #14 (Windows/Linux ビルド) 完了後に Windows / Linux 成果物アップロード部分を release.yml 側で明示化。
5. Dependabot の有効化はそのあと。

**Status:** 未着手

---

## 14. Windows / Linux ビルドおよび配布

### 背景
- 現状: `tauri.conf.json` の `bundle.targets` は `["app"]` で **macOS の `.app` のみ** が出力される。
- `release.yml` のマトリクスは `macos-latest` / `ubuntu-22.04` / `windows-latest` の3つを回しているが、Windows/Linux ジョブはターゲットが無いため成果物が空になっている可能性が高い。
- `docs/install.md` には「Windows / Linux: `.msi` / `.exe` / `.AppImage` / `.deb` をリリースから取得」と書かれているが、**実態と乖離している** (案内している成果物が無い)。

### 案
- `bundle.targets` を OS 別に切り替える形に変更。Tauri 2 では `bundle.targets: "all"` でホスト OS に応じた標準形式を全部出すか、配列で個別指定できる。
  - macOS: `["app", "dmg"]` (現状の Install.command zip と併存)
  - Windows: `["nsis"]` (`.exe` インストーラ。MSI は要件に応じて追加)
  - Linux: `["deb", "appimage"]` (rpm はディストリビューション需要次第)
- ワークフローのマトリクス毎に `args: --bundles <target1>,<target2>` を渡すか、設定ファイル分割で OS 別ターゲットを指定する。
- 各 OS の追加要件:
  - **Windows**: コードサイニング (EV 証明書 or 自己署名 + SmartScreen の警告許容) を方針決定。プレリリース段階なら未署名 + ドキュメントで Windows Defender SmartScreen の警告対応を案内する形でも可。
  - **Linux**: `libwebkit2gtk-4.1-dev` 等の依存関係は CI で既にインストール済み。AppImage は `linuxdeploy` ベースで動くはず。
  - 動作確認用の OS は最低でも Windows 11 / Ubuntu 22.04 (LTS)。

### 検討事項
- ffmpeg / llama-server の OS 別バイナリ取得ロジック (`converter/downloader.rs`, `text_processing/extract.rs`) が Windows/Linux で実際に動くかは未検証。**この項目に着手する前にローカル動作確認が必要**。
- Linux の AppImage / deb で `libwebkit2gtk` バージョン差異の問題が出やすい。22.04 でビルドして 24.04 で動作確認、など多 OS テストの体制をどう整えるか。
- Windows の EV 証明書は年単位コストが高い。**一旦未署名で出してフィードバックを見る**方針で良いか確認。
- macOS の Install.command zip は残し、`.dmg` を追加で配布するかは要相談 (現行の Gatekeeper 警告対策の経緯と整合させる)。
- インストーラのサイズ感: ffmpeg / llama-server をバンドル同梱 vs 初回起動時ダウンロード のトレードオフを再確認。

### 実装ステップ案
1. ローカルで `pnpm tauri build --bundles nsis` 等を試し、各 OS でビルド可否を確認。
2. `bundle.targets` を OS 別に変更 (もしくはワークフロー側で `--bundles` 指定)。
3. `release.yml` の各マトリクスジョブに OS 固有のチェックを追加 (バイナリの存在、SmartScreen/Gatekeeper 挙動)。
4. `docs/install.md` を実態に合わせて書き直し。
5. 自分以外の手元 (Windows / Linux マシン) で1回は動作確認してからリリース。

**Status:** 未着手

---

## 運用ルール

- **同時進行は1項目だけ**。「進行中」が表に複数ある状態を作らない。
- 着手時: 進捗サマリー表のステータスを `進行中` に更新 → 該当セクションの `**Status:**` も更新。
- 完了時: コミット (もしくは PR マージ) と同じタイミングで `完了` に更新する。完了日を `**Status:** 完了 (2026-05-08)` の形で残しておくと履歴が追える。
- 案や検討事項に変化があったら、その項目のステータスを上げる前に該当セクションを書き直してから着手する。
- 項目を追加するときは、**進捗サマリー表と新規セクションを同じコミットで追加**する。表だけ・セクションだけの片側更新にしない。
- カテゴリ間の依存 (例: A → B → C、C は #9 → #10 の順、#6 ⇄ #10 はメタ基盤を共有、#3 ⇄ #4 は説明文/用語ヘルプの分業、#13 ⇄ #14 はリリース直前にセットで整備) は進捗サマリー表のメモ欄で示す。順序を入れ替えるときはメモも合わせて更新する。
