---
name: verify
description: 作業完了後の検証チェックを一括実行する（自動修正・並行実行対応）
argument-hint: "[frontend|backend|all]"
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash, TaskCreate, TaskUpdate, TaskList, Read, Edit, Glob, Grep
---

# /verify - 検証スキル

フェーズ制で検証チェックを実行する。自動修正可能なエラーは修正し、独立したチェックは並行実行する。

## Argument Parsing

`$ARGUMENTS` からターゲットを決定する:
- `frontend` or `fe` → Frontend のみ
- `backend` or `be` → Backend のみ
- `all` or 空 → Frontend + Backend 両方

不正な引数の場合はエラーメッセージを表示して停止。

## ターゲット別コマンドマップ

| Phase | Frontend (`fe`) | Backend (`be`) | All |
|-------|----------------|----------------|-----|
| 0: Auto-fix | `pnpm lint:fix` | `cargo fmt` | 両方並行 |
| 1: Static Analysis | `pnpm lint` + `pnpm typecheck` (並行) | `cargo fmt --check` + `cargo clippy -- -D warnings` (並行) | 4つ並行 |
| 2: Tests | `pnpm test:run` | `cargo test` | 両方並行 |
| 3: Build | `pnpm build` | (なし) | `pnpm build` |

## フェーズ実行ルール

### Phase 0: Auto-fix

ファイルを自動修正するフェーズ。対象コマンドを**並行**で実行する。

- Frontend: `pnpm lint:fix`（Biome の lint + format 自動修正。`pnpm format` の上位互換）
- Backend: `cargo fmt`（Rust フォーマット自動修正）

このフェーズは常に成功扱い（修正を適用するだけ）。

### Phase 1: Static Analysis

読み取り専用の静的解析フェーズ。対象コマンドを**すべて並行**で実行する。

- Frontend: `pnpm lint` + `pnpm typecheck`
- Backend: `cargo fmt --check` + `cargo clippy -- -D warnings`

**失敗時の自動修正（最大2回リトライ）:**

1. 失敗したチェックのエラー出力を確認する
2. 自動修正を試みる:
   - `pnpm lint` 失敗 → `pnpm lint:fix` を再実行し、再チェック
   - `cargo fmt --check` 失敗 → `cargo fmt` を再実行し、再チェック
   - `pnpm typecheck` 失敗 → エラー出力を読み、**明確な修正**ならコードを修正して再チェック
   - `cargo clippy` 失敗 → 警告を読み、**明確な修正**ならコードを修正して再チェック
3. 再チェックは**失敗したチェックのみ**を対象とする（成功済みのチェックは再実行しない）
4. 2回リトライしても失敗する場合は停止してエラー報告

### Phase 2: Tests

Phase 1 が全パスした後に実行。対象コマンドを**並行**で実行する。

- Frontend: `pnpm test:run`
- Backend: `cargo test`

**失敗時の自動修正（最大1回リトライ）:**

1. 失敗したテストのエラー出力を確認する
2. **明確な修正**ならコードを修正して再テスト
3. 1回リトライしても失敗する場合は停止してエラー報告

### Phase 3: Build

Phase 2 が全パスした後に実行。

- Frontend: `pnpm build`

**失敗時**: 修正せずエラー報告して停止。

## 「明確な修正」の判断基準

以下に該当するエラーは自動修正してよい:
- unused import / unused variable の除去
- 型不一致（missing field、wrong type、`undefined` の扱い等）
- missing `override` キーワード
- clippy の suggestion に従った修正（redundant clone、unnecessary `&` 等）
- フォーマットの問題

以下は自動修正**しない**（ユーザーに報告して停止）:
- アーキテクチャ変更が必要なエラー
- ビジネスロジックの判断が必要なエラー
- テストの期待値自体が間違っている可能性があるケース
- 修正方法が複数ある曖昧なエラー

## 実行手順

1. **タスクリスト作成**: ターゲットに応じた全ステップを TaskCreate で作成する
2. **Phase 0 実行**: 対象の auto-fix コマンドを並行で実行。タスクを in_progress → completed に更新
3. **Phase 1 実行**: 対象の静的解析コマンドを並行で実行。失敗があれば自動修正ルールに従いリトライ
4. **Phase 2 実行**: 対象のテストコマンドを並行で実行。失敗があれば自動修正ルールに従いリトライ
5. **Phase 3 実行**: ビルドコマンドを実行
6. **結果報告**: サマリーを表示

## 結果報告フォーマット

全パス時:
```
✅ All checks passed
```

自動修正で回復した場合:
```
✅ All checks passed (auto-fixed: <修正内容の要約>)
```

失敗時:
```
❌ Failed at: <Phase名 — チェック名>
<エラー出力の要約>
```
