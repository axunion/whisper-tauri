---
name: refactor-fe
description: フロントエンド（SolidJS/TypeScript）のリファクタリング
argument-hint: "<file or description>"
user-invocable: true
---

# /refactor-fe — フロントエンドリファクタリング

`$ARGUMENTS` で指定されたファイルまたは対象を、プロジェクト規約に基づいてリファクタリングする。

## プロジェクト規約

### import パス

- `~/` エイリアス（`src/` にマップ）を使用する。相対パス `../` は同一モジュール内でのみ許容
- 型は `import type` で import する

```typescript
// ✅ Good
import { cn } from "~/lib/utils";
import type { AppError } from "~/types/errors";

// ❌ Bad
import { cn } from "../../lib/utils";
import { AppError } from "~/types/errors";  // 型なのに import type でない
```

### Tailwind クラス結合

- `cn()` (`~/lib/utils`) で結合する。文字列テンプレートや手動結合は避ける

### エラーハンドリング

- プリミティブ内: `parseError()` で `AppError` に統一し `setError()` で保持
- コンポーネント層: `ErrorDisplay` でエラー表示、`toast` で操作結果フィードバック
- ErrorDisplay と toast の重複回避

### 状態管理

- `createSignal` / `createStore` を使用。外部状態管理ライブラリは不使用
- イベントリスナーは `onCleanup()` で解除する

### コンポーネントパターン

- solid-ui コンポーネントは `splitProps` で props を分割
- variant は `class-variance-authority` (`cva`) で定義

### 型安全

- `noUncheckedIndexedAccess` 有効 — 配列アクセスは `undefined` チェック必須
- `exactOptionalPropertyTypes` 有効 — `undefined` と省略を区別

### コード整理

- **未使用コードの除去**: 未使用の import、変数、関数、型定義を削除する。後方互換のための re-export や `_` 変数は不要
- **関数の粒度**: 1つの関数は1つの責務に絞る。30行を超える関数はロジックの分離を検討する
- **コンポーネントの粒度**: 複数の独立した UI ブロックを含むコンポーネントは分割を検討する。ただし、1箇所でしか使わない小さな要素を過度に分割しない
- **重複コードの統合**: 同一ロジックが2箇所以上にあれば共通関数に抽出する。ただし、似ているだけで文脈が異なるコードを無理に統合しない
- **冗長な記述の簡素化**: 不要な中間変数、冗長な条件分岐、過剰なネストを整理する

### スタイルガイド

- Biome: ダブルクォート、セミコロン必須、インデント幅 2
- Tailwind CSS v4 を使用

## 手順

1. 対象ファイルを読み込み、規約違反を特定する
2. リファクタリングを実施する
3. 検証コマンドを実行する:

```bash
pnpm lint && pnpm typecheck && pnpm test:run
```

4. 失敗があれば修正し、全パスするまで繰り返す
