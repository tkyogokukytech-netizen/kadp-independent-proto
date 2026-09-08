# KADP Independent Proto

`Start-KADP.vbs`をダブルクリックすると、ローカル画面が開きます。初回は「Googleで接続する」から本人ログインを行います。その後は日本語で入力して「実行する」。必要なときはOK / NG / STOP。

現在は開発中。出生E2Eを完了するまでv0.1完成とは扱いません。

旧KADPと異なるGit repositoryです。remoteなし、push・deployなし。Node.js 24以降を使用します。

## 保守担当者向け

- `npm test`: 保護TEST。Workerのテストダブルを使う試験は非Codex実E2Eではありません。
- `npm start`: ローカルGUI。127.0.0.1:4317のみ。
- `core/`, `ui/`, `tests/`, `CONSTITUTION.md`, 既存`cases/`: 保護対象。
- `app/*.js`: QuickJS隔離環境で実行する純粋な自己開発コード。Node直接実行禁止。
- `cases/*.json`: Workerが追加できる受入TESTデータ。登録済みTESTは変更不可。
- `evidence/`: 成功CandidateとTESTのGit追跡記録。
- `.runtime/`: ローカル状態・失敗証拠・候補worktree。Git保存しない。
- `.private/`: 公式CLI認証領域。Git/promptへ保存しない。

Workerの外部ツールは空allowlistとdeny policyで禁止。QuickJSにはホスト機能を公開しない。GUIはテキスト描画のみ。AIに任意のNode/PowerShell/TESTコマンドを実行させない。
