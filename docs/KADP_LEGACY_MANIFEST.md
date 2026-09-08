# KADP Legacy Manifest

調査日: 2026-09-09（Asia/Tokyo）

## 証拠範囲

この資料は、このPCで取得可能な作業ツリーとローカルGit履歴のみを対象とする。
会社PC上の未push最新版は参照できない。最新版との差分・能力・TEST成績はUNKNOWN。
remoteへのfetch/pullは実行していない。会話記憶を実装証拠にしない。

- repository: `C:/KADP/kadp-core`
- configured origin: `https://github.com/tkyogokukytech-netizen/kadp-core.git`
- branch: `main`
- HEAD: `61b716f16f4eefe75a888d3e51d8b52b6e7b338d`
- 調査開始時 `git status --porcelain=v1`: 出力なし
- `git ls-files` / `git ls-tree -r --name-only HEAD`: `README.md`, `config/roles.yaml`
- 読み取りはUTF-8。PowerShell既定文字コードでの表示の乱れは原本破損の証拠ではない。

## 分類

IMPLEMENTED=実装証拠あり、TESTED=実行TEST証拠あり、PARTIAL=部分的な証拠、SPEC_ONLY=仕様のみ、CODEX_DEPENDENT=Codex依存の具体的証拠あり、UNKNOWN=確認不能。
仕様の存在と実行時の保証を区別する。今回TESTEDまたはCODEX_DEPENDENTと断定できる項目はない。

| 項目 | 分類 | 証拠と限界 |
|---|---|---|
| 主要ファイル | PARTIAL | HEADにはREADME.mdとconfig/roles.yamlのみ。最新版の一覧はUNKNOWN |
| AI Council / Worker役割 | PARTIAL | config/roles.yamlにPLANNER/CODER/CRITIC/REVIEWER、provider、fallbackの設定あり。読込・実行実装は未確認 |
| Constitution / Safety | SPEC_ONLY | README.md「KADP Constitution」13項。実行時の強制機構は未確認 |
| protected files/tests | SPEC_ONLY | Constitution 8・9に保護TESTと安全規則の保護。具体的な保護ファイル一覧・TESTコードは未確認 |
| TEST一覧 | UNKNOWN | 取得可能ツリー内にTESTファイル・runner・結果なし。最新版に存在しないとは言えない |
| state | SPEC_ONLY | README.md「State Management」の通常状態と例外状態。永続化・遷移検証実装は未確認 |
| history / learning | SPEC_ONLY | README.md「Learning Principle」。実行履歴・失敗履歴・学習データは未確認 |
| retry / time / lock | UNKNOWN | 今回確認した2ファイルに具体的実装・試験証拠なし |
| Git資産 | IMPLEMENTED | ローカルGitに下記3コミット。実行結果とcommitの自動紐付けは未確認 |
| 承認commitとPROD一致 | SPEC_ONLY | Constitution 4。デプロイ実装は未確認 |
| Codex依存箇所 | UNKNOWN | roles.yamlにopenai指定はあるが、OpenAI provider指定だけではCodex依存を証明できない |
| GUI / 自己開発 / 無人開発 | UNKNOWN | 取得可能な実装・E2E証拠なし |
| Money Forward | SPEC_ONLY | README.md「First Project」。GAS実装は今回のツリーにない。Protoでは禁止対象 |

## 確認できるGit履歴

`git log --all --format='%H %s'`:

```text
61b716f16f4eefe75a888d3e51d8b52b6e7b338d Add AI Council role configuration
08d00cc7df6e74b40aeeb3758ed031cfbf009a1e Initialize KADP Constitution v0.1
eab223648e70eb2c5da0623b2ec8ce10b632c29b Initial commit
```

## Known limitations

- 会社PCの未push最新版・追加履歴・失敗履歴・TEST資産はUNKNOWN。
- 現行remoteの最新状態は未検証。上記はローカルの証拠。
- 実行コードを確認できないため、旧システムの動作試験は未実施。
- heartbeatの稼働状態はUNKNOWN。本調査では起動・再開していない。
- Codex利用枠の正確な残量は取得していない。推測値を記載しない。
