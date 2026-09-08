# Antigravity CLI Bootstrap Worker evaluation

調査日: 2026-09-09

- Google公式installer: `https://antigravity.google/cli/install.ps1`
- installed binary: `agy 1.1.27`
- 正式な入口: `agy` / `agy --print`
- 認証: Google OAuth、または Google Cloud project。公式Codelabは個人GmailとGoogle OAuth、Cloud project経路ではVertex AI API有効化・project・global locationを案内する。
- 無料/既存契約: 公式資料で個人Gmail OAuthの利用手順は確認できたが、この端末のアカウントの無料枠・既存契約・quota残量は確認不能。新規課金は行わない。Cloud project/API利用は課金設定を変更せず、今回は選択しない。
- 規約境界: 公式`agy` CLIのみを使用。Consumer UI自動操作、quota迂回、第三者ツール経由の認証・送信は行わない。

## 実機証拠

`agy --mode plan --output-format json --print-timeout 60s --print="Reply exactly READY. Do not use tools."` は、Google OAuth URLを発行し、認証コード待ちになった。GUIの「Googleで接続する」経路でも同じURLが`login.url`に表示されることを確認した。

認証コードは本人操作が必要なため、Codexは入力しない。認証完了前は`WAITING_HUMAN`、Worker未接続として扱う。

## Adapter

`core/antigravity.mjs`にprovider固有処理を隔離した。EngineのWorker Interface、Candidate、Safety Validation、隔離適用、TEST、Git記録は変更していない。`--mode plan`でツールを許可せず、JSON Candidateだけを受け取る。

## 判定

正式CLIとOAuth入口は利用可能。実Worker接続は本人認証待ちで未完了。したがってCodex非依存`VERIFIED_E2E`は未達成であり、Antigravity CLIを接続済みと報告しない。

Sources: [Google Codelab — Antigravity CLI](https://codelabs.developers.google.com/antigravity-cli-hands-on?hl=en), [Google Codelab — Accelerating Development with Antigravity CLI](https://codelabs.developers.google.com/genai-for-dev-antigravity-cli?hl=en)
