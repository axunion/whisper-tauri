# Tauri 2 Plugin Permissions

frontend から `@tauri-apps/plugin-*` の API を呼ぶときは、`src-tauri/capabilities/default.json` の `permissions` にコマンド単位の許可が登録されているか必ず確認する。

## 前提

- `fs:default` / `dialog:default` / `store:default` などの `*:default` バンドルにはコアセットしか含まれない。
- 特に `fs:default` には `writeTextFile` / `writeFile` / `copyFile` / `renameFile` / `removeFile` などの **書き込み系** permission は入っていない。
- 書き込み系を使うときは個別 permission を identifier + scope (allow パス) 付きで明示追加する。

## 例: ユーザー選択ダイアログ経由の保存

```json
{
  "permissions": [
    "fs:default",
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$HOME/**" }]
    },
    {
      "identifier": "fs:allow-copy-file",
      "allow": [{ "path": "$HOME/**" }]
    }
  ]
}
```

- scope は `**` (全パス) ではなく `$HOME/**` などに絞る。`/etc`, `/System` への書き込みは通常不要。
- `$HOME/**` は macOS の `~/Documents` / `~/Desktop` / `~/Downloads` を全てカバーする。
- 外部ドライブ (`/Volumes/**` on macOS) への保存は要望時に追加。

## チェックリスト (新規 plugin API 利用時)

1. plugin の `*:default` に必要なコマンドが含まれているか公式 docs / `src-tauri/gen/schemas/` で確認
2. 含まれていなければ `fs:allow-<command>` のような個別 identifier を `capabilities/default.json` に追加
3. scope (パス制限) は最小限にする (`**` は避けて `$HOME/**` 等を使う)
4. dev サーバーを **再起動** (capabilities は Tauri 起動時読み込みのため HMR で反映されない)
5. 実機で実際に API を呼び silent fail していないか確認

## 既知の落とし穴

- **silent fail**: permission 不足時は `<command> not allowed` のような Promise reject。frontend で `try/catch` でエラーを握りつぶしていると気づきにくい。デバッグ時は `catch (err) { console.error(err); ... }` で詳細を必ずログ出力する。
- **scope 不足**: identifier は登録されているが scope に対象パスが含まれていないと同様に拒否される。
- **HMR 非反映**: capabilities ファイルは frontend のホットリロードと無関係。dev サーバーの再起動が必須。

## 過去の事例

- **2026-05-20**: #16 (要約・整文タブで保存ボタン有効化) 実装中に、要約タブだけでなく text/timeline タブの保存 (`writeTextFile`) と録音 WAV 保存 (`copyFile`) も silent fail していたことが発覚。`fs:default` に write 系が含まれていない仕様を見落としていた。#2 (ファイル選択ダイアログの言語整合) 完了時点 (2026-05-13) で実機テストしていれば早期発見できた。
