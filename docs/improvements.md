# 改善案メモ

プレリリース段階で温めている改善アイデアを集約するドキュメント。
未着手・進行中の項目は **背景 / 案 / 検討事項 / Status** で記述、完了項目は **結論サマリ + 将来必要な知見** だけを残す。

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
| 16 | A   | 要約・整文タブで保存ボタンを有効化         | 中   | 完了 (2026-05-21) | summary/cleanText タブで保存ボタン有効化。fs:default に write 系 permission を追加 |
| 17 | A   | 要約処理中の履歴ナビゲーション制御         | 中   | 完了 (2026-05-21) | 方針 A 実装。確認ダイアログ + cancelSession。実機確認済み |
| 7  | B   | Whisper モデルを small/turbo に絞る        | 高   | 完了 (2026-05-18) | medium / large-v3 を完全削除し、turbo に統合 |
| 8  | B   | 不要モデルのクリーンアップ                 | 中   | 完了 (2026-05-19) | 廃止モデル機構を LLM 側にだけ実装。合計サイズ表示は Whisper / LLM 両方に |
| 9  | C   | 要約の充実                                 | 中   | 完了 (2026-05-20) | 構造化要約 + 品質再検討 (tldr/keyPoints 役割分離・actionItems 厳格化・keyPoints 動的レンジ)。2026-05-20 実環境確認済み |
| 10 | C   | Notion ブロック送信 + メタデータ           | 中   | 完了 (2026-05-22) | 構造化ペイロード + callout/heading_1/divider/append。実機確認済み |
| 18 | A   | Notion 送信ダイアログのレイアウトシフト解消 | 中   | 完了 (2026-05-22) | sending を中央配置の独自レイアウトに振り、Title/Description を Switch 外に hoist して a11y 安定化 |
| 19 | A   | Notion 送信完了後の遷移確認 UI 再考        | 低   | 完了 (2026-05-22) | success ダイアログを廃止しトースト + 「開く / コピー」CTA に。error 時のみダイアログ維持。partial は warning トースト |
| 11 | D   | バイナリ更新フロー (ffmpeg/llama)          | 低   | 未着手   | ポリシー策定優先 |
| 12 | D   | リアルタイム / 話者識別                    | 低   | 未着手   | VAD は導入済み。スコープ大 |
| 13 | E   | CI/CD 調整                                 | 高   | 完了 (2026-05-25) | Phase 1: PR チェックワークフロー (ci.yml) 新設。release.yml refactor / Dependabot は本項目スコープ外 |
| 14 | E   | Windows / Linux ビルド・配布               | 高   | 完了 (2026-05-26) | bundle.targets を `"all"` に変更し各 OS で `--bundles` 指定。install.md を実態 (NSIS / deb / AppImage) に合わせて書き直し |
| 20 | E   | release.yml の if 分岐統合                 | 中   | 進行中   | `tauri-action` を 2 回呼んでいる部分を 1 つに統合。`IS_RELEASE` フラグで release 作成を切り替え |

> ステータス更新のとき、優先度の見直しが必要になったら表ごと並べ替えて構わない。
> 関連項目の依存 (例: #7 → #8、#9 → #10、#6 ⇄ #10、#3 ⇄ #4、#13 ⇄ #14) はカテゴリ内の順序に反映済み。

---

# A. UI/UX 磨き込み

利用者体験を整える。アイコン (#1) とダイアログ言語 (#2) は工数小なので先に片付ける。設定ページ統一 (#3) と用語ヘルプ (#4) は UI 基盤として先行し、個別機能改善 (#5, #6) を載せる。履歴メタの拡充 (#6) は #10 (Notion メタブロック) の基盤にもなる。

## 1. アプリアイコンを正方形にしたい

**結論 (2026-05-12)**: `icon.svg` の `<circle>` を `<rect>` フルブリードに置換し、ロゴモチーフを音声波形 (9 本の不規則高さ縦バー) に刷新。OS マスク (macOS squircle / Win/Linux 矩形) に任せる方針。`pnpm tauri icon` で派生アセット (PNG / .icns / .ico / Square*Logo) を一括再生成。Windows / Linux 実機での確認は #14。

**Status:** 完了 (2026-05-12)

---

## 2. ファイル選択ダイアログの言語整合

**結論 (2026-05-13)**: `Info.plist` に `CFBundleDevelopmentRegion=en` と `CFBundleLocalizations=[en, ja]` を追加し、NSOpenPanel/NSSavePanel を OS のシステム言語に追従させる標準対応に揃えた。`Dictionary` に `dialog` 名前空間を新設しフィルタ名 (wav/txt/srt/vtt) と各ダイアログ title を全 i18n 化、ハードコード 4 箇所 (FileSelector / QuickActions / RecordingPanel / ResultViewer) を一掃。Windows / Linux のダイアログは OS ロケール追従のため Info.plist 相当の対応不要。

**残課題 (#16 で発覚)**: 本タスクではダイアログ UI の i18n のみを扱い、`@tauri-apps/plugin-fs` の `writeTextFile` / `copyFile` に必要な capabilities permission の不足を見落としていた (`fs:default` には write 系が含まれない)。`fs:allow-write-text-file` / `fs:allow-copy-file` を `$HOME/**` scope で追加するのは #16 で対応。一般化知見は `.claude/rules/tauri-permissions.md` に集約。

**Status:** 完了 (2026-05-13)

---

## 3. 設定 / 開発ページのレイアウト統一

**結論 (2026-05-14)**: 共通プリミティブ `src/components/ui/SectionRow.tsx` (`title / description? / right`) を新設し、`SettingsSelect` / VAD 行 / `CacheClear` / DevMenu / `FfmpegControl` / `TextModelManager` / `NotionIntegration` を集約。Card 内に再度枠を引いていた二重枠 5 箇所を整理し、緑色アクセントは `<FiCheck class="text-emerald-500">` に縮約。VAD 説明文は「機能 + 無効化推奨 2 ケース (歌唱・朗読 / 無音記録)」に拡充し、残り (発話極小・デバッグ用途) は #4 の用語ヘルプに委譲。設定項目の並び順 / グルーピング再設計 / i18n キー命名整理は本作業に含めず保留。

**Status:** 完了 (2026-05-14)

---

## 4. アプリ全体の用語ヘルプ (`?` アイコン + ポップオーバー)

**結論 (2026-05-14)**: `src/components/ui/HelpHint.tsx` を新設 (Kobalte Popover ベース、`<HelpHint term="..." />` の typed union 方式)。i18n に `glossary` 名前空間 + 必須 6 用語 (vad / llm / whisper / ffmpeg / notionDatabaseId / notionToken) × title/body × ja/en を実装。Settings ページの一般ユーザー向け箇所のみに配置 (DevMenu と dev モード TextModelManager は対象外、`!devMode` でガード)。後追い用語 (large-v3-turbo / FTS5 / wav)、履歴/オンボーディング画面への展開、外部リンクはスコープ外。

**運用ルール (#3 ⇄ #4 の役割分担)**: 設定行の `description` は「どう設定するか」の操作指針 (短く)、`?` ヘルプは「そもそも何か」の概念解説。今後の機能追加でブレないようこの 2 層構成を維持する。

**Status:** 完了 (2026-05-14)

---

## 5. 共有アイコンの下に Notion を入れる（共有メニュー化）

**結論 (2026-05-14)**: `ResultToolbar.tsx` の旧 `SiNotion` 単独ボタンを、`FiShare2` を起点とする共有 DropdownMenu に置換 (既存 AI/Save flyout と同じ手書きパターンで実装、Kobalte DropdownMenu への全面置換は別タスク)。ボタン並びを `AI / Share / Save / Copy` に整理し、「外部送信 → ローカル保存 → クリップボード」の右に行くほど即時性が高くなるグラデーションに揃えた。Notion 未接続時もメニュー自体は常時表示し、項目はグレーアウト + 「Notion 連携を設定する」ボタンで `/settings` へナビゲートするよう未接続導線を改善。`ResultViewer` は履歴詳細でも使用されるため、Toolbar 変更が履歴詳細にも自動反映される。Copy / Save の共有メニュー統合、最近使った 1 件の固定表示、履歴一覧への独立共有導線はスコープ外。

**Status:** 完了 (2026-05-14)

---

## 6. 履歴メタ情報の拡充 (VAD ON/OFF を含む)

**結論 (2026-05-15)**: `history` テーブルに `vad_enabled INTEGER` (NULL 許容) を追加。`db/mod.rs::init_db` に `PRAGMA table_info` で列存在を確認してから `ALTER TABLE` する冪等 migration を実装。`HistoryEntry` / `HistoryMeta` / `HistorySaveParams` の 3 構造体に `vad_enabled: Option<bool>` を追加し、保存 (`Transcription.tsx::saveToHistory`) / SELECT / FTS5 search 全経路を更新。**既存履歴は NULL のまま (= 不明) を維持してデータの嘘を作らない方針**、新規保存は必ず `0/1`。表示は `HistoryDetail` / `HistoryList` のメタ行に `FiActivity` アイコン + `VAD: ON / VAD: OFF` (`vadEnabled !== null` のときのみ)。i18n は `history.vadEnabledLabel` / `vadDisabledLabel`。VAD threshold / speech_pad_ms 等の他メタは本タスク対象外。

**Status:** 完了 (2026-05-15)

---

## 15. 文字起こし時の VAD ON/OFF 選択

**結論 (2026-05-15)**: `createWhisper.ts` に `vadEnabledOverride: boolean | null` signal を新設し、getter `vadEnabled()` は `override() ?? createSettings().vadEnabled()` で解決。初期値 `null` のときは設定値、Bar 操作後は override 固定 (= 以降 Settings 変更が伝播しなくなる)。**シンクは双方向に取らない方針** (`onVadChange` は `whisper.setVadEnabled` のみを呼び、`settings.update` には触らない)。「Settings = 起動時デフォルト / Bar = 今回の選択」の役割分担を維持。`saveToHistory` も `settings.vadEnabled()` → `whisper.vadEnabled()` に置換し、履歴の `vadEnabled` 列が「実行時に実際に使われた値」を反映するように #6 の意味を拡張。UI は `TranscriptionOptionsBar` の grid に Checkbox + `VAD` ラベルを追加 (`t("settings.vadEnabled")` を流用して新規 i18n キーなし)。

**Status:** 完了 (2026-05-15)

---

## 16. 要約・整文タブで保存ボタンを有効化

**結論 (2026-05-20)**: タブごとに保存内容と拡張子を切り替える形に変更。
- text / timeline: 既存通り `exportResult` → `{txt, srt, vtt}` (flyout)
- summary: `formatSummaryAsText(summaryResult)` → `.md` (単発ボタン)
- cleanText: `cleanTextResult` → `.txt` (単発ボタン)

`ResultToolbar` の prop は `onSave: (format: ExportFormat) => void` (flyout 用) + `onDirectSave: () => void` (単発用) の 2 つに分割し、「タブ → format」のマッピングを ResultViewer 側に集中させ leaky abstraction を回避。`canSave: boolean` prop で空ファイル保存を防止 (text.length === 0 / summaryResult === null / 処理中)。i18n は `dialog.mdFilter` / `dialog.saveSummaryTitle` / `dialog.saveCleanTextTitle` を新規追加。

**内包バグ修正: fs permission 不足**: 実装中、`@tauri-apps/plugin-fs` の `writeTextFile` / `copyFile` 呼び出しが Tauri runtime に silent fail する症状が発覚。`fs:default` に write 系が含まれていなかったため。要約タブ以外 (text/timeline) でも保存できず、`RecordingPanel.tsx` の WAV 保存 (`copyFile`) も同原因で機能していなかった。`capabilities/default.json` に以下を追加:

```json
{ "identifier": "fs:allow-write-text-file", "allow": [{ "path": "$HOME/**" }] },
{ "identifier": "fs:allow-copy-file",       "allow": [{ "path": "$HOME/**" }] }
```

scope は当初 `**` で実装したがレビューで `/etc` 等のシステム領域を含むと指摘され `$HOME/**` に絞った。外部ドライブ (`/Volumes/**`) は要望時に追加。一般化知見は `.claude/rules/tauri-permissions.md`。

**Status:** 完了 (2026-05-21) — 実機動作確認済み

---

## 17. 要約処理中の履歴ナビゲーション制御

**問題の本質**: 履歴詳細を開いて「要約」ボタンを押した処理中に履歴を閉じることができてしまい、再オープン時は新しい `createAiSession` インスタンスのため `isProcessing()` が false に戻り、要約タブも消える。処理は裏で続いているが UI からは追跡不能になる。

**結論 (2026-05-21)**: 方針 A (確認ダイアログ) を採用。`ResultViewer` に `onProcessingChange?: (op, cancel) => void` callback を追加し (既存 `onGeneratingTitleChange` と同じパターン)、`History.tsx` 側で `currentOp` / `cancelFn` signal を保持。Sheet `onOpenChange` と X ボタンを `attemptClose()` に集約し、`currentOp !== null` のとき `HistoryProcessingCloseDialog` (AlertDialog) で確認 → 確定で `cancelFn() → toast.info → clearSelectedEntry()`。ESC / 背景クリックも同経路に乗る。対象は `summary` / `cleanText` のみ、タイトル生成は短いため対象外。`AiOperation = "summary" | "cleanText" | null` 型を `createAiSession.ts` から export。

**キャンセル経路の限界 (要注意)**: BE 側 `text_processing_cancel` は streaming 版 (`run_inference`) ではチャンク受信ごとに `is_cancelled()` をチェックするため即時止まるが、**blocking 版 (`run_inference_blocking`、構造化要約の `stream:false` ルートで使用) は `.send().await` と JSON parse が完了するまで return しない**ため、フラグは立つが推論本体は走り続けるケースが残る (multi-chunk 要約のチャンク**間**ではキャンセル可、チャンク**内**は止まらない)。今回は UI 整合性のみ担保し、`run_inference_blocking` の reqwest AbortHandle wire は別 issue。

**Status:** 完了 (2026-05-21) — 実機確認済み

---

## 18. Notion 送信ダイアログのレイアウトシフト解消

**結論 (2026-05-22)**: 当初 plan は方針 A (ボタン行スペースを sending 中も `min-h-10` で予約) だったが、ユーザーから「送信中は見出し不要・中央に送信中のみが一般的」とフィードバックを受け、**方針 D: sending を中央配置の独自レイアウトに振る**方向に転換。Slack / Discord 風の loading ダイアログ UX に寄せた。

**実装ポイント**:
- **Title/Description は `<Switch>` の外に hoist** し常に DOM に存在させる。class を `sr-only` 動的切替 (sending 時のみ sr-only)、テキストは `titleText()` / `descriptionText()` memo で state に応じて切替。Kobalte の `aria-labelledby` / `aria-describedby` が指す id が branch swap の microtask 間で undefined になる race を回避。
- **sending 中の可視 spinner div** は `role="status"` + `aria-live="polite"` で aria-live region として動作させ、`FiLoader` (animate-spin) + 「送信中…」テキストを中央配置。可視 `<p>` は `aria-hidden="true"` (Description が SR への wire を持つ)。
- **focus 移動**: Kobalte の `onMountAutoFocus` は AlertDialog Content マウント時のみ発火し inner Switch の branch swap では再発火しないため、`createEffect` で `kind()` を監視し、`success` / `error` 遷移時に `queueMicrotask` 経由で新 Close ボタン (`ref`) に focus を明示移動。
- **i18n 集約**: `descriptionText` memo に `t()` 呼び出しを集約し、sr-only Description と可視 `<p>` が同じソースを参照 (キー rename 時の漏れ防止)。

**意図的に残した不揃い**: sending では visible grid item が 1 つ (spinner div のみ・sr-only は `position:absolute` で grid から外れる)、success / error では 2 つ (Description + buttons) になるため、sending と success/error の高さは branch 間で完全には揃わない。これは「送信中は中央配置」を優先する方針の意図的な選択 (success / error 同士の高さは揃っているので「完了したのに何か起きた」感は出ない)。

**スコープ外**: sending 中のキャンセル (BE `notion_share` の AbortHandle 化が必要 → #19 の延長案で別途検討)、「Notionで確認」ボタンの UX (→ #19)。

**Status:** 完了 (2026-05-22) — 実機確認済み

---

## 19. Notion 送信完了後の遷移確認 UI 再考

**結論 (2026-05-22)**: 案 C (トースト格下げ) + 案 A (開く / コピーの 2 アクション) のハイブリッドを採用。`NotionShareState` から `success` kind を削除し、`share()` の戻り値 `Promise<NotionPageRef | null>` で受ける形に変更したことで「ダイアログは error / sending 専用」が型レベルで保証される。

**実装ポイント**:
- **Toast API 拡張** (`src/components/ui/toast.tsx` + `src/lib/toast.ts`): `showToast` に `actions?: Array<{label, onClick}>` を追加。アクションボタンは押下で必ず `ToastPrimitive.toaster.dismiss(toastId)` を経て callback を呼ぶ (= 押下で必ず閉じる)。ファサード側は `toast.warning` 追加 + 全メソッドに `{description, duration, actions}` の optional 引数を導入。既存の `toast.success(msg)` 呼び出し ~21 箇所は破壊しない
- **成功時 UX**: `toast.success("Notion に送信しました", { actions: [{開く, コピー}], duration: 6000 })`。「開く」で `openUrl(ref.url)`、「コピー」で `writeText(ref.url)` 後にセカンダリ `toast.success("URL をコピーしました")` を別出し
- **partial 警告**: `toast.warning(..., { description: successPartialNote, duration: 8000 })` で重要度を表現。ダイアログ復活は避けて UX を一貫させる
- **NotionShareDialog**: success 分岐 / `successCloseRef` / openUrl import を全削除。`open()` 判定は `kind() !== "idle"` のままで sending + error のみが拾われる
- **i18n**: `successToastTitle` / `successPartialToastTitle` / `copyUrlAction` / `urlCopiedToast` / `copyFailedToast` の 5 キー追加、`successTitle` / `successDescription` の 2 キー削除 (デッドコードを残さない方針)

**スコープ外として残した項目**:
- **案 B (永続化チェックボックス)**: 「次回から開かない」設定。トースト化で問題が緩和されたため当面不要、要望が出たら再考
- **案 D (送信履歴ページ)**: `history` DB に `notion_page_url` 列を追加して「過去送信先を一覧」する導線。#6 ⇄ #10 の延長として中長期検討。「送信したか分からなくなった」フィードバックが出たら着手
- **sending 中のキャンセル**: BE 側 `notion_create_page` の AbortHandle 化が必要。プレリリースで rate limit / 巨大ペイロードの問題が観測されたら別タスク化
- **「開く」CTA 押下後のブラウザフォーカス制御**: Tauri 側でどう振る舞うかは OS 依存。実機運用で違和感があれば検討

**Status:** 完了 (2026-05-22) — 実機動作確認は別途

---

# B. モデル管理

公開モデルの取捨選択と利用者ディスクの整理。#7 → #8 の順で着手しないと、廃止モデルがディスクに残り続ける。

## 7. Whisper モデルを small / large-v3-turbo の2つに絞る

**結論 (2026-05-18)**: 完全削除方針を採用。`VALID_MODEL_IDS` を `["small", "large-v3-turbo"]` に縮小し、`get_model_list` も 2 件のみ返す。`is_valid_model_id` が廃止 ID を弾くため `model_path` / `model_exists` / `download_model` / `delete_model` も API レベルで一貫拒否。検討案にあった「カスタム base URL 経由で medium / large-v3 を再取得可能」は `is_valid_model_id` 縮小と両立できないため意図的に見送り。プレリリース前提なので `Settings.whisperModelId` が廃止 ID だった場合の自動切替 + トースト通知も実装後に撤去 (実ユーザー不在のため不要)。i18n から `models.whisper.medium.description` / `largeV3.description` も削除。

ユーザーディスクに残った廃止モデルファイルの削除は #8 へ委譲。

**Status:** 完了 (2026-05-18)

---

## 8. 不要 LLM / Whisper モデルのクリーンアップ機能

**結論 (2026-05-19)**: 当初 Whisper / LLM 両方に廃止モデル UI を実装したが、レビューで「Whisper は small / turbo で完結し今後廃止候補が出ない、LLM は良いモデルが出るたびにアップデート/追加していく」との方針が出たため、**廃止モデル機構を LLM 側にのみ移植**する形に修正 (`.claude/rules/tuning.md` の過剰機能回避方針に整合)。

- **Whisper 側**: 廃止モデル UI なし。`delete_model` は元の `is_valid_model_id` 厳格チェック維持。既存 medium / large-v3 ファイルはユーザー手動削除 (下記)
- **LLM 側**: 廃止概念のインフラを導入。現状 `LEGACY_MODEL_IDS: &[&str] = &[]` (空配列、将来用)。次回 LLM 廃止時に ID を追加するだけで Settings の「廃止済みモデル」Card が自動で機能する
- **合計サイズ表示** (`src/components/ui/TotalSizeFooter.tsx`): Whisper / LLM 両 Card 末尾に「合計: X.X GB」を表示。`formatBytes` (1024-base + 小数 1 桁) と `sumDownloadedBytes` を共通化

新規 BE コマンド `text_processing_get_legacy_models` + 純粋関数 `scan_legacy_text_models` (`fs::metadata` の `NotFound` 吸収で TOCTOU 回避)。FE 側は `LegacyTextModelList.tsx` で `onMount` 時に自己完結ロード、`<Show when={legacyModels().length > 0}>` で条件レンダ。

### 本機 Whisper 既存ファイルの手動削除 (本機作業)

本機には #7 以前にダウンロードされた廃止 Whisper モデルが残っている。アプリ側の UI は持たないため手動削除:

```bash
ls -la "~/Library/Application Support/com.whisper-tauri.desktop/models/"
# ggml-medium.bin   約 1.5 GB
# ggml-large-v3.bin 約 3.1 GB
rm "~/Library/Application Support/com.whisper-tauri.desktop/models/ggml-medium.bin"
rm "~/Library/Application Support/com.whisper-tauri.desktop/models/ggml-large-v3.bin"
```

`ggml-small.bin` / `ggml-large-v3-turbo.bin` / `ggml-silero-v5.1.2.bin` は現役なので残す。

### 次回 LLM 廃止時の運用手順

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

その他必要に応じて: `get_model_list()` のエントリ削除、`i18n` の `models.text.<id>` 説明文削除、テスト fixture の置換。

**Status:** 完了 (2026-05-19) — LLM 側の実環境動作確認は次回廃止モデル発生時に行う

---

# C. Notion 連携の強化

主要出力先の品質を上げる。要約構造 (#9) を先に固めると、Notion ブロック構造 (#10) のマッピングが綺麗に決まる。履歴メタ (#6) の基盤と同じ "実行時メタの保管・表示" パターンを共有する。

## 9. 要約の充実 (Notion 向けにキーワード / アクションアイテム / 3行要約)

**結論 (2026-05-20)**: LLM 1 回呼び出しで構造化 JSON を受け取る方式を採用。出力構造は `StructuredSummary { headline, tldr: String, keyPoints: [], actionItems: [], keywords: [] }`、`ActionItem { what, due? }` (due のみ optional)。

**主要な設計判断**:
- **`response_format: json_schema`** をリクエスト本体に渡す方式 (llama-server 起動引数 `--grammar-file` だと `clean_text` / `chat` / `title` にも影響するため不採用)。`additionalProperties: false` + `strict: true`
- **要約だけ `stream:false`** に切り替え (`run_inference_blocking` 新規追加)。途中の壊れた JSON を progress text として描画する経路を回避、UI は「処理中…」スピナーのみ
- **長文 (>4000 文字) のチャンキング**: 中間チャンク要約は平文 (SSE 逐次)、最終 1 回だけ structured 出力
- **履歴データ形式**: 既存 `ai_content.text` に `JSON.stringify(structured)` を保存 (DB スキーマ変更なし)。`parseSummaryContent` で旧 plain text もフォールバック吸収
- **`formatSummaryAsText`** ヘルパ (Markdown 形式、`# Headline` / `## TL;DR` 等) を新設。`ResultViewer.getCopyText` と #10 Notion 送信で再利用

**品質再検討 (2026-05-19, 第 1 弾)**: 実機で短文音声試行時に問題発見:
1. **tldr と keyPoints の差が薄い** → `tldr` を `Vec<String>` → `String` (1〜2 文のリード段落) に変更。`keyPoints` は「tldr で触れなかった具体的な論点・話題・事実」と明確化、プロンプトで「tldr と内容を重複させない」を明示
2. **actionItems の誤検出** (独白・朗読でも 1 件無理に抽出) → プロンプトを厳格化:「多くの音声では空配列が正解」「独白・朗読・講演・雑談・インタビュー・説明動画では必ず空配列」「話題提示や感想は action item ではない」「1 件だけ抽出するくらいなら空配列」

**品質再検討 (2026-05-19, 第 2 弾)**: 追加フィードバック:
- **`ActionItem.who` を完全削除** (発話だけから担当者特定は LLM の能力外と判断、仕様として割り切る)。UI / i18n キー (`summaryActionWho`) も削除
- **ActionItems を箇条書き UI に変更** (カード形式 → `• {what} (期日: {due})`)
- **入力長に応じた keyPoints 動的レンジ** (`summary_params_for_length(text_chars) -> (key_points_min, key_points_max, max_tokens)`):
  - `<1500`: 2〜4 / max_tokens 2048
  - `1500〜5000`: 3〜6 / max_tokens 2048
  - `5000〜15000`: 5〜10 / max_tokens 3072
  - `>=15000`: 7〜15 / max_tokens 4096
- **重複時の減少を許容**: 「内容が重複する場合は項目数を下回ってよい — 同じ趣旨の項目を 2 つ以上書かない」をプロンプト明示

**実環境動作確認 (2026-05-20)**: 短い独白 / 朗読で actionItems が空配列、会議録で tldr と keyPoints が役割分離、長尺音声で keyPoints 件数バケット動作、who 削除で精度低下なしを確認。

**スコープ外**: モデル別プロンプトチューニング、ユーザーカスタムプロンプト、要約フィールド単位の再生成、`chat` / `clean_text` / `generate_title` の structured 化、要約バージョニング (`schemaVersion`)、`run_inference_blocking` のリクエスト構造体抽出 (clippy `too_many_arguments` は `#[allow]` で対応)。

**Status:** 完了 (2026-05-20)

---

## 10. Notion へ "ブロック送信" + メタデータ付与

### 背景
- 現状: テキストを1ページに流し込む単純送信。
- ユーザーの想定 UX: 「日時・元ファイル名・モデル名・処理時間・要約」などのメタデータがブロックで構造化されているページが作られる。

### 確定方針 (ユーザー承認済み)

1. **送信コンテンツ**: コピー / 保存と同じく active タブの中身を送る。メタ callout は常に付与し、本体は active タブで切替 — text → 本文 paragraph、timeline → `[H:MM:SS] text` 形式の segment paragraph、cleanText → 整文テキスト、summary → 構造化要約ブロックのみ (本文なし)。divider は上のセクション + 本体の両方が存在するときだけ自動挟入。実機検証で「summary タブから送ると構造化要約 + Markdown 化要約が二重に出る」問題が判明したため、初稿の「常にまとめて送る」案を撤回して案 2 (タブ別切替) に転換した
2. **タイトル種別接尾辞**: 同じ録音から各タブを別ページとして送れるよう、タイトルに種別を付ける — text は無印、timeline → `(タイムライン)` / `(Timeline)`、summary → `(要約)` / `(Summary)`、cleanText → `(整文)` / `(Cleaned)`。Notion DB 一覧で識別可能に
3. **日時フィールド**: 「録音日時」一本 (`createdAt`)
4. **要約見出しの言語**: UI 言語追従 (`textProcessing.summaryTldr` 等を Notion ブロックでも再利用)。`NotionSummary.labels` フィールドに FE で localized 文字列を詰めて BE に渡す
5. **要約 headline ブロック**: `StructuredSummary.headline` を `heading_1` として要約セクション先頭に出す (種別接尾辞でタイトル重複問題が消えたため復活)
6. **100 ブロック超過時**: 初回 POST で先頭 100 → 余剰は `PATCH /v1/blocks/{page_id}/children` で 100 ずつ append。append 失敗時のみ `partial: true` を返してダイアログで警告
7. **ブロック表現**: メタは callout 1 つに `\n` 区切り + 📋 emoji。`NotionBlock` enum は導入せず、純粋関数 (`build_meta_callout` / `build_summary_blocks` / `build_divider_block` / `build_create_page_children` / `split_children_for_create`) で分割する素朴な実装に留めた
8. **処理時間**: FE 側で `Date.now() - startedAt` 計測 (`createWhisper.processingMs()` accessor)。履歴経路では渡さない (`Vec<NotionMetaField>` 構造で「あるフィールドだけ送る」が表現できる)

### 実装サマリ

- **BE**: `NotionPagePayload {title, meta, summary, body_text}` + `NotionMetaField {label, value}` + `NotionSummary {headline, tldr, keyPoints, actionItems, keywords, labels}` + `NotionActionItem {what, due?}`、`NotionPageRef.partial: bool` 追加。append 失敗は本流エラーではなく `eprintln!` ログ + `partial = true` を立てる
- **FE**: `src/lib/notion.ts` に `summaryToNotionPayload` / `buildNotionPagePayload` を新設。`createWhisper` に `processingMs` / `transcribedAt` の 2 signal 追加 (`batch` 内で 3 signal 同時更新)。`ResultViewer` の `handleShareToNotion` は active タブで分岐 (summary 時 `body = ""` + summary fill、それ以外 `body = getCopyText()` + summary null)
- **i18n**: `Dictionary.notionShare` に 12 キー新規 (`successPartialNote` / `metaCreatedAt` / `metaModel` / `metaProcessingTime` / `metaAudioLength` / `metaFileName` / `metaVadEnabled` / `metaVadOn` / `metaVadOff` / `titleSummary` / `titleCleanText` / `titleTimeline`)、`textProcessing.summary*` 5 キーを Notion ブロックの見出しでも再利用

### スコープ外として残した項目

- Notion API rate limit (429) / Retry-After 対応 — プレリリースで観測されてから別タスク化
- メタ / 要約 / 本文の ON-OFF 設定 UI — 「まずは固定」方針
- `NotionBlock` enum / type-safe block builder — 現状 5 種固定で素朴ヘルパーで十分
- HTTP モック導入によるネットワーク経路テスト — 既存密度に合わせ pure 関数テストに留める
- BE 側で `processingMs` を計測 / 履歴に永続化 — FE 計測で代用
- `createdAt` の録音 vs 文字起こし分離 — 履歴スキーマ追加が必要、別タスク
- Notion ページの更新 / 上書き — 現状ページ作成のみ

**実機確認時に発覚した残課題**: 送信ダイアログのレイアウトシフト (#18 へ分離) と「Notionで確認」ボタンの UX 再考 (#19 へ分離)。

**Status:** 完了 (2026-05-22) — 実機動作確認済み (text / summary / cleanText / 履歴詳細 / 長文 append / partial 警告のいずれも通過)

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

**結論 (2026-05-25)**: Phase 1 として `.github/workflows/ci.yml` を新設し、PR (main 宛) + main push をトリガに frontend / backend を並列で lint + test する最小構成を導入。release.yml refactor / Dependabot / フルビルド smoke は本項目のスコープ外として整理 (要望が出たら別タスク化)。

**ci.yml の構成**:
- **frontend** (ubuntu-latest): `pnpm/action-setup@v4` (`packageManager` から自動バージョン検出) + `actions/setup-node@v4` (`cache: pnpm`) → `pnpm install --frozen-lockfile` → `pnpm check` (Biome + tsc) → `pnpm test:run`
- **backend** (ubuntu-latest): `dtolnay/rust-toolchain@stable` (`components: rustfmt, clippy`) + `swatinem/rust-cache@v2` → Linux deps (`libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf libasound2-dev`) → `SOURCE_DATE_EPOCH` 設定 → `cargo fmt --all -- --check` → `cargo clippy --all-targets -- -D warnings` → `cargo test`
- **concurrency**: `${{ github.workflow }}-${{ github.ref }}` で同一 PR の古い run を cancel。main push では cancel しない
- **permissions**: `contents: read` のみ

**運用ルール (今後のために)**:
- **Rust toolchain の齟齬**: ローカル Rust と CI stable のバージョン差で「ローカル green / CI fail」が起きるため、`rustup update stable` でローカルも追従させる運用。`rust-toolchain.toml` 固定は tuning.md の「標準設定優先」に反するため不採用
- **`#[cfg(target_os = ...)]` ガード下の lint**: macOS ローカル clippy では Linux/Windows 固有コード (例: `converter::downloader::btbn_url`) の lint がスキップされるため、CI が初出 lint を見つけて修正するサイクルが基本。Linux 固有コードを書いた直後は CI run を見るまで完了扱いにしない
- **Linux deps の必須リスト**: `cpal` 経由で `libasound2-dev` が必要 (release.yml の Ubuntu ジョブは `bundle.targets = ["app"]` で実質コンパイルされず未検出だったため漏れていた歴史あり)
- **SOURCE_DATE_EPOCH**: `.claude/rules/workarounds.md` の通り、CI で `GGML_NATIVE=OFF` を効かせるため必須
- **ビルド時間目安**: 初回 backend ジョブは 5〜6 分 (`whisper-rs-sys` / `libsqlite3-sys` 等の依存コンパイル込み)。2 回目以降は `swatinem/rust-cache` ヒットで 1〜3 分に縮む想定。Cargo.lock 更新 PR では再びフルビルド

**スコープ外として残した項目** (要望が出たら別タスク化):
- **release.yml リファクタ**: `if` 分岐 2 回で同じ tauri-action を呼んでいる部分の統合 + Windows/Linux 成果物アップロード明示化。機能変更なし可読性タスク
- **Dependabot 有効化**: CI が安定してから
- **フルビルド smoke** (`pnpm tauri build --debug`): PR 毎は重すぎる。nightly でやるなら別 workflow

**Status:** 完了 (2026-05-25)

---

## 14. Windows / Linux ビルドおよび配布

**結論 (2026-05-26)**: `tauri.conf.json` の `bundle.targets` を `"all"` に変更し、`release.yml` の各 OS ジョブで `--bundles` を渡して必要な形式に絞る構成。`workflow_dispatch` の build-only モードで 3 OS すべてのビルド通過を確認。

**最終構成**:
- **macOS**: `--bundles app` (Install.command zip 経路を維持。`.dmg` は追加しない方針)
- **Windows**: `--bundles nsis` (NSIS `.exe` インストーラ。未署名 + SmartScreen 警告は install.md で案内)
- **Linux**: `--bundles deb,appimage` (Debian/Ubuntu は `.deb`、その他は `.AppImage`)
- **Linux deps**: `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf libasound2-dev` (cpal が ALSA を要求するため `libasound2-dev` 必須。ci.yml と同期)
- **install.md**: 各 OS のインストール手順 + SmartScreen / Gatekeeper 警告対応 + uninstall + app-data path を実態に合わせて書き直し

**運用ルール (今後のために)**:
- **`bundle.targets: "all"` + CLI `--bundles` 上書き**: tauri.conf.json で `"all"` にしておくと、ローカル `pnpm tauri build` を素で叩いた時にホスト OS のフル形式 (macOS なら app + dmg) が作られる。普段使いには CI と同じ `--bundles app` を渡せば現状維持
- **Windows コードサイニング**: 未署名で出して install.md の SmartScreen 「More info → Run anyway」案内でフォロー。EV 証明書はコスト過大 (年単位 数万〜10 万円) でプレリリース段階に見合わない
- **macOS `.dmg`**: Install.command zip 経路 (Gatekeeper 警告回避済み) で十分。`.dmg` を追加すると署名なしダブル経路で UX が分散するため意図的に作らない
- **install.md のファイル名プレースホルダー**: `<version>` は Tauri の bundle 命名規則任せ。NSIS は `<productName>_<version>_x64-setup.exe`、deb/AppImage は `whisper-tauri_<version>_amd64.<ext>` の想定。初リリース時に実 artifact 名を見て install.md を微調整する余地あり

**スコープ外として残した項目** (要望が出たら別タスク化):
- **実機 Win/Linux での起動確認**: CI ビルド通過まで。ffmpeg / llama-server の OS 別バイナリダウンロード (`converter/downloader.rs`, `text_processing/extract.rs`) が実機で動くかは初リリース後のフィードバック待ち
- **Windows MSI 併用**: 企業現場で MSI 需要が出たら検討
- **Linux RPM**: Fedora/RHEL 系の需要が出たら検討
- **AppImage の Ubuntu バージョン差異**: 22.04 でビルドして 24.04 で動くかは未検証。ユーザーフィードバック待ち
- **release.yml の `if` 分岐 2 回統合**: → #20 で着手

**Status:** 完了 (2026-05-26)

---

## 20. release.yml の if 分岐統合

### 背景
- `release.yml` は `tauri-apps/tauri-action@v0.5` を 2 回呼び分けている: `build-only` と `build and release`。どちらも同じ matrix / Linux deps / Rust toolchain の上に乗っており、`if:` だけが違う ~30 行の重複。
- #13 / #14 で「スコープ外」と整理してきたが、main へ release.yml の変更を積み重ねた結果 (Win/Linux bundle, libasound2-dev, releaseBody 書き換え) でこの重複の存在感が増し、次回の修正が両側を漏れなく触れるか不安に。
- `tauri-action` は `tagName` が空のときに release を作らない仕様なので、フラグで切り替える 1 ステップに統合できる。

### 案
- job レベルで `IS_RELEASE` フラグを `env:` に定義: `${{ github.event_name == 'push' || (github.event_name == 'workflow_dispatch' && inputs.mode == 'release') }}`
- `tauri-action` ステップを 1 つに統合:
  - `tagName`: `${{ env.IS_RELEASE == 'true' && env.RELEASE_TAG || '' }}`
  - `releaseName` / `releaseBody`: 同様の条件式
  - `releaseDraft` / `prerelease`: そのまま
  - Apple secrets (`APPLE_CERTIFICATE` 等): build-only でも env に並んで構わない (tauri-action は使わなければ無視)
- macOS installer zip upload の `if:` 条件も `env.IS_RELEASE == 'true'` に揃える

### スコープ外
- `RELEASE_TAG` のフォールバック (`v{run_number}-test`) ロジック維持
- `releaseBody` テンプレートの中身変更 (#14 で既に最新)
- Apple secrets を build-only 時に env からも外す (tauri-action 側で無視されるので問題なし)
- CI ジョブの並列化 / フルビルド smoke

### 完了条件
- `workflow_dispatch` の **build-only モード** で 3 OS green
- 既存の release ロジックが壊れていないことを目視 + 条件式の対称性で担保 (実際の release は次回のタグ push で確認)

**Status:** 進行中 (2026-05-26 着手)

---

## 運用ルール

- **同時進行は1項目だけ**。「進行中」が表に複数ある状態を作らない。
- 着手時: 進捗サマリー表のステータスを `進行中` に更新 → 該当セクションの `**Status:**` も更新。
- 完了時: コミット (もしくは PR マージ) と同じタイミングで `完了` に更新する。完了日を `**Status:** 完了 (2026-05-08)` の形で残しておくと履歴が追える。
- 完了項目を書くときは**結論サマリ + 将来必要な知見だけ**にし、背景 / 案 / 検討事項などの議論経緯は削る (議論はコミットメッセージと git log を一次ソースとする)。
- 案や検討事項に変化があったら、その項目のステータスを上げる前に該当セクションを書き直してから着手する。
- 項目を追加するときは、**進捗サマリー表と新規セクションを同じコミットで追加**する。表だけ・セクションだけの片側更新にしない。
- カテゴリ間の依存 (例: A → B → C、C は #9 → #10 の順、#6 ⇄ #10 はメタ基盤を共有、#3 ⇄ #4 は説明文/用語ヘルプの分業、#13 ⇄ #14 はリリース直前にセットで整備) は進捗サマリー表のメモ欄で示す。順序を入れ替えるときはメモも合わせて更新する。
