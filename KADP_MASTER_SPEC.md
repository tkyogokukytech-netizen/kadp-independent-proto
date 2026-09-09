# KADP MASTER SPEC
## KYO AI Dev Pipeline 統合正本

**Version:** 1.3  
**Date:** 2026-09-09  
**Status:** 統合正本（KADP憲法 + 正式採用済み仕様 + Independent Proto 現行実装 + 将来構想/候補）

---

# 0. この文書の位置づけ

この文書は KADP（KYO AI Dev Pipeline）の開発・自己開発で最初に読む統合正本である。

統合対象：
1. `KADP_基本仕様書_v1.0.docx`
2. `KADP_MASTER_SPEC_v1.2.md`
3. 2026-09-09 時点の KADP Independent Proto 実装
4. 2026-09-09 に実証した自己開発 E2E
5. 将来構想・候補（正式仕様とは分離）

## 0.1 優先順位

**KADP憲法 > 安全規則 > 正式採用済み仕様 > 現在の実装仕様 > 人間の個別指示 > 将来構想・候補**

- 将来構想・候補をAIが勝手に正式仕様へ昇格してはならない。
- 会話記憶は正本ではない。
- Git内の `KADP_MASTER_SPEC.md` を正式な正本とする。
- KADP自身の自己開発でも本書を上位ルールとして扱う。
- 「実装できる」ことと「実行権限を持つ」ことを分離する。

## 0.2 Git Source of Truth

Independent Proto 正式リポジトリ：

`https://github.com/tkyogokukytech-netizen/kadp-independent-proto`

会社PC：
`C:\KADP\kadp-independent-proto`

HOME PC：
`C:\KADP\kadp-core\independent-proto`

正式正本：
`<repo-root>\KADP_MASTER_SPEC.md`

履歴：
`<repo-root>\docs\history\KADP_MASTER_SPEC_v1.3.md`

---

# 1. KADPの目的

KADPは、利用者が自然言語で目的を伝えるだけで、AIが要件整理・設計・実装・レビュー・自動テスト・安全確認までを行い、人間が確認・承認した成果物だけを次段階へ進める、モデル非依存・低コスト・安全重視のAI開発基盤である。

最終UX：

> 「カドップ、これやっといて」

KADPは裏で要件整理、リスク判定、実装、TEST、レビュー、Evidence保存を行い、人間には簡潔な確認だけを求める。

設計思想：

> **裏側は高度に。表側は、人と話すくらい簡単に。**

> **AIを使わせない。KADPと仕事してもらう。**

> **人間にKADPの使い方を覚えさせない。KADPが人間の仕事の仕方を覚える。**

> **自律性を上げるほど、権限は狭くする。**

> **Fast AI is not trusted; fast AI is used inside a safe process.**

---

# 2. KADP憲法

1. **PROD反映は必ず人間承認を必要とする。**
2. Money Forward等への外部送信・本番POST・金銭処理をAIが勝手に実行しない。
3. AIが間違える前提で安全装置を設計する。
4. TESTとPRODを分離し、AIが自由に触れる範囲を原則TESTまでに制限する。
5. TESTで人間が確認したGit commitと**同一成果物だけ**をPRODへ反映する。
6. 無料枠・既存契約・ローカル処理を優先し、新規課金は最後の手段とする。
7. 新規費用が必要なら、費用・理由・無料代替案・効果を提示し、人間承認まで停止する。
8. Secret、APIキー、OAuth token等をAI・ソース・Git・ログ・不要なプロンプトから隔離する。
9. 最小変更原則を守る。
10. 判断不能・AI間不一致では推測で進めず、人間へ確認して停止する。
11. 自主学習は許可するが、学習による権限・憲法・承認ルールの自動変更は禁止する。
12. protected tests をAIが都合よく変更できないよう保護する。
13. KADP自身の自己改善にも TEST → 人間確認 → 承認 → 反映 の安全フローを適用する。
14. 「KADP止めて」で新規AI実行・TEST反映・PROD関連処理を停止し、再開指示まで自動継続しない。
15. 能力拡張と権限拡張を同一視しない。
16. Safety Kernel・Constitution・protected tests は通常の自己開発対象にしない。

最終原則：

> **AIは自由に考えてよい。TESTは壊してよい。しかしPRODは人間の許可なく触れない。**

---

# 3. 基本アーキテクチャ

KADPは以下を分離する。

1. Conversation / Human Interface
2. Planning / Workflow
3. Worker / AI Provider Adapter
4. Candidate
5. Safety Kernel
6. Isolated TEST
7. Human Approval
8. Git / Evidence
9. Project Adapter
10. PROD Executor（将来・別権限）

特定AI名を業務ロジックへ固定しない。AIは交換可能なAdapterとして扱う。

---

# 4. AI Council

将来の標準役割：

## PLANNER
- 要件整理
- 完了条件
- 許可範囲 / 禁止範囲
- リスク
- 影響範囲

## CODER
- 最小変更
- 実装
- テスト追加
- 修正

## REVIEWER / CRITIC
- バグ検出
- adversarial review
- 異常系
- 過剰実装検出
- セキュリティ観点

AI Councilは多数決で決めない。重大な反論は証拠・再現条件・TESTで検証する。
通常 critique → revision は最大2ラウンド。3ラウンド目以降は HUMAN REQUIRED。

**現状：未実装。**

---

# 5. 標準開発フロー

1. 自然言語指示
2. 要件・完成条件・許可/禁止範囲
3. リスク分類
4. 必要に応じAI Council
5. 合意不能なら HUMAN REQUIRED
6. DEV最小変更
7. AIレビュー
8. 自動テスト
9. 失敗なら自己修正
10. TEST
11. TEST再査読
12. 日本語の完成確認
13. 人間TEST確認
14. NGなら修正
15. OKなら承認候補固定
16. PROD前停止
17. PROD承認
18. 同一commitのみPROD
19. 結果・履歴・正常版保存
20. docs更新
21. 完了

## TEST確認とPROD承認

- TEST確認OKだけではPROD権限は発生しない。
- PROD承認は特定commit・特定変更にだけ有効。
- 包括承認にしない。

---

# 6. リスク管理

原則 HIGH：
- 金額変更
- 請求
- Money Forward POST
- 外部POST / 外部書き込み
- メール送信
- LINE送信
- データ削除
- 認証変更
- Secret変更
- PROD設定変更
- PRODデプロイ
- 権限変更
- 新規課金
- 安全装置変更

必要能力を満たすReviewerが利用不能なら安全側に停止する。

**現状：正式なLOW / MEDIUM / HIGH分類エンジンは未実装。**

---

# 7. TEST / PROD / 承認

- TESTとPRODは別環境。
- TEST確認済みcommit以外のPROD反映は禁止。
- PROD credentials はAI実装工程から原則アクセス不能。
- 外部送信はTESTではMock/Stub等で代替。
- 本番反映前の正常版を保存しrollback可能にする。
- 本番操作をテスト目的だけで実行しない。
- KADP自己開発では承認前Candidateを隔離領域に保持する。

---

# 8. テスト戦略

必須：
- 通常
- 異常系
- adversarial
- regression
- protected tests
- 影響範囲宣言
- 予定外変更検知
- Overdoing検出
- TEST evidence
- 重大バグの再現テスト

## 8.1 現行 Independent Proto

2026-09-09 時点：

**21 tests / 21 pass / 0 fail**

確認領域：
- OAuth URL parser
- CLI JSON parser
- safe task
- dangerous/private task fail-closed
- path traversal / drive / ADS / UNC / reserved name拒否
- protected kernel拒否
- junction / hard link拒否
- dangerous API拒否
- duplicate Candidate path拒否
- malformed TEST拒否
- lock / stale lock
- QuickJS host access遮断
- infinite loop interruption
- acceptance test
- isolated Candidate
- TEST fail時の非昇格
- retry上限
- STOP
- provider failure
- repo-scoped safe.directory
- unattended scheduler
- GUI HTTP / CSRF
- SELF_DEVELOPMENT_CHANGE

---

# 9. 状態管理

概念状態：

`相談中 → 仕様確定 → AI合議 → 実装中 → AIレビュー → 自動テスト → TEST反映 → 人間確認待ち → 承認済み → PROD反映 → 完了`

Independent Proto 現行：
- IDLE
- ACCEPTED
- READY
- RUNNING
- WORKER_RUNNING
- TESTING
- WAITING_HUMAN
- COMPLETED
- HOLD
- STOPPED
- ERROR

---

# 10. 監査・Evidence

記録対象：
- 人間指示
- Worker evidence
- Candidate
- Candidate hash
- baseline commit
- 変更file
- TEST
- OK/NG
- commit
- retry
- source
- codexIntervention
- status

現行：
- `.runtime/evidence`
- `.runtime/audit`

将来GUI表示：
- 何を変えたか
- TEST
- risk
- Candidate ID/hash
- commit
- PROD未実行
- 確認場所

---

# 11. Learning Engine

将来記憶：
- 成功
- 失敗
- AI議論
- TEST
- HOLD理由
- 人間OK/NG
- 人間修正
- 成功/失敗Workflow

基本：

**構造化履歴 + 検索 + 必要文脈注入**

Learning Engineが自動変更できない：
- 憲法
- PROD承認
- Secretアクセス
- HIGH基準
- Safety Kernel
- protected tests

## Workflow Distillation

> **KADPが賢くなる = 同じ定型問題にはAIを使わなくなっていく。**

安定処理は AI推論 → Workflow → 通常コード/ルール へ落とす。

---

# 12. 正式採用済み追加原則

## Cost Routing
1. 無料
2. 既存契約
3. 低コストAPI
4. 高コストモデル

月予算：
- 7,000円：警告
- 9,000円：高コスト制限
- 10,000円：停止

## Async
待たなくてよい処理は安価・低速。人間を止める処理は速度へコストを使う。

## Multimodal
将来、音声・テキスト・写真・ファイルを同一コンテキストで扱う。

## Proactive Secretary
Project / Schedule / Deadline / Progress を理解して警告・提案。外部確定は人間承認。

## Human Interface
目標：

> **おじいちゃん・おばあちゃんでも普通に使える。**

基本：会話 / カメラ / ファイル / OK / NG。

## External AI Compliance

**Compliance → Safety → existing availability → Quality → Cost → Speed**

公式API / CLI / SDK / Business接続を優先。

## Self-Development
改善案 → Candidate → Safety → Isolated TEST → 人間確認 → 承認 → Git

---

# 13. Independent Proto 現在の実装状況

## 13.1 リポジトリ

GitHub：
`tkyogokukytech-netizen/kadp-independent-proto`

確認済み最新commit：
`c1a4c94`

主要checkpoint：
- `5bdfb94` — safe self-development task mode
- `9afded2` — self-development human approval gate
- `b4b7320` — sandboxed workflow planner
- `c1a4c94` — KADP自身による承認済み自己改善

## 13.2 GUI

`http://127.0.0.1:4317`

現在可能：
- 自然言語Task
- 実行
- STOP
- OK / NG
- Google / Antigravity接続
- 状態
- Task履歴
- TEST結果
- 自己開発承認

未実装：
- ChatGPT級会話UI
- 長期会話履歴
- ファイルupload
- drag & drop
- project switching
- structured approval summary
- risk表示
- Candidate diff GUI

## 13.3 Worker

現行：
**Google Antigravity official CLI**

Worker ID：
`official-antigravity-cli`

原則：
- official CLI
- OAuthは人間操作
- Candidate-only
- Worker自身はGit/TEST/PRODを実行しない
- HostがSafety/TEST/Gitを担当
- provider adapter方式

Company executable：
`%LOCALAPPDATA%\agy\bin\agy.exe`

Workspace：
`<repo-root>\.private\worker-workspace`

## 13.4 Candidate / Isolation

WorkerはCandidate JSONを返す。
Hostがpath、secret、protected範囲、dangerous API、TEST形式、size等を再検査する。

Candidateは：
`<repo-root>\.runtime\candidates\<task-id>-<attempt>`

のGit worktreeへ隔離適用する。

## 13.5 QuickJS Sandbox

`app/*.js` をQuickJS内で実行。

現行制限：
- process不可
- require不可
- fetch不可
- std/os不可
- memory/stack/time制限
- function allowlist

現在：
- `formatResult`
- `plan`

## 13.6 Sandboxed Workflow Planner

`app/workflow.js` は無権限の判断層。
次Taskを**提案**するだけで実行権限は持たない。

`core/engine.mjs` がTask存在・READY・dependencies・Safety・resource limitを再検証して実行する。

## 13.7 SELF_DEVELOPMENT_CHANGE

Task type：
- CHANGE
- SELF_DEVELOPMENT_CHANGE

現在の自己開発許可は保守的に：
- `app/*.js`
- 新規 `cases/*.json`

保護：
- `core/safety.mjs`
- Safety Kernel
- Constitution
- protected tests
- PROD
- auth
- Secret
- permission
- allowlist外

## 13.8 Human Approval Gate

SELF_DEVELOPMENT_CHANGE：

1. Worker Candidate
2. Safety
3. isolated apply
4. TEST
5. PASS
6. WAITING_HUMAN
7. Candidate保持
8. 人間レビュー
9. OK
10. 同一Candidateのみpromote
11. commit
12. COMPLETED

NG：
- commitしない
- HOLD
- decision evidence

baseline変更時：
- promote拒否

## 13.9 重要な制限

### 通常CHANGE
通常CHANGEは既存互換のため、まだSELF_DEVELOPMENT_CHANGEと同じ人間承認ゲートへ統一されていない。

### CORE自己開発
`core/engine.mjs` 等のHost権限コードは自己開発対象へまだ開放しない。

理由：
- fs
- Git
- Host modules
- Worker control

等の高権限を持ち、現行 `validateApp()` は app/cases 検証中心だから。

> **高権限COREを無理に自己変更させず、無権限ロジック層を先に育てる。**

### DIAGNOSTIC_READONLY
未実装。

### Conversation Brain
未実装。現在GUIはTask UI。

---

# 14. 2026-09-09 VERIFIED SELF-DEVELOPMENT E2E

実証Task：

`workflow.jsで、elapsedMsが負数または不正な値の場合は安全にstopを返すよう改善し、その動作を確認する新しい受入TESTも追加`

Worker変更：
- `app/workflow.js`
- `cases/workflow.json`

追加安全動作：
- elapsedMs が number でない
- finiteでない
- 0未満

→ `{ action: 'stop' }`

追加TEST：
- `-1`
- `"invalid"`
- `null`

実フロー：
1. GUI自己開発依頼
2. Antigravity Worker
3. Candidate
4. Safety PASS
5. isolated worktree
6. TEST PASS
7. main clean
8. WAITING_HUMAN
9. 人間差分レビュー
10. OK
11. 同一Candidate commit
12. COMPLETED
13. GitHub push

証拠：
- commit `c1a4c94`
- Candidate `d5c98e4d-32d1-443e-adb9-c91059bf6e66-1`

結論：

> **KADP Independent Proto は、安全な無権限領域において「自分で改善案を作り、TESTし、人間承認後に自分へ取り込む」実動ループを成立させた。**

---

# 15. 自己開発ルール v1.3

自己開発ループ：
1. Master Spec
2. Project仕様
3. protected特定
4. PROD除外
5. 現状コード
6. 改善案
7. Candidate
8. Safety
9. Isolated Apply
10. TEST
11. bounded retry
12. PASSなら人間確認
13. NGならHOLD
14. OKなら同一Candidate commit
15. Evidence
16. GitHub同期
17. 完了

禁止：
- 憲法自己変更
- Safety弱体化
- protected tests自己変更
- 承認省略
- PROD無承認自己反映
- Secret不要アクセス
- PROD credentials取得
- HIGH無承認実行
- Candidateから直接main書換え
- TEST無しcommit
- baseline不一致昇格

最初に育てる：

**Unprivileged Logic Layer**
- workflow
- classification
- ranking
- formatting
- deterministic rules
- sandbox判断

当面保護：

**Privileged Host Layer**
- Safety
- Git
- sandbox
- authentication
- server security
- external Worker execution
- PROD executor

---

# 16. 次の優先課題

## Priority 0: Verified E2E維持
`c1a4c94` を基準checkpoint。
21/21 testsを維持。

## Priority 1: Master Spec Git正本化
本書を `<repo-root>\KADP_MASTER_SPEC.md` へ配置。

## Priority 2: Approval Policy一般化
SELF_DEVELOPMENT_CHANGEで成立したゲートを基準に、通常CHANGEを含むTask別approval policyを設計。

## Priority 3: DIAGNOSTIC_READONLY
変更を伴わない調査・状態確認・差分説明・原因分析・仕様比較をCandidate無しで実行。

## Priority 4: Approval / Evidence UX
GUIでCandidate差分、変更file、TEST、risk、baseline、commit前/後、OK/NGを確認可能にする。

## Priority 5: Conversation Brain
- chat
- clarification
- consult vs execute routing
- project context
- history
- memory retrieval
- approval recognition
- FACT / FORECAST / INFERENCE / PROPOSAL
- safety explanation

Conversation Brainは直接権限を持たずExecution EngineへTaskを発行する。

## Priority 6: Workflow Brain育成
`app/workflow.js` を段階的に強化。
最終権限はHostに残す。

## Priority 7: AI Council
PLANNER / CODER / REVIEWER。

## Priority 8: Cost / Learning / Agent
Cost Routing / Learning Engine / Workflow Registry / Trust Level / KADP Agents。

---

# 17. KADP Agent 方針

候補：
- Dev
- Accounting
- Site
- Completion Book
- Secretary
- Review
- Security

原則：

> **KADP Agentは製品ではなく、KADPの内部部品。**

> **KADPだけが雇える内部AI社員。**

Agent作成 = 権限付与ではない。

---

# 18. 将来構想・候補
## 未確定 / 自動実装禁止

### AEGIS
Zero Trust / Assume Breach / Least Privilege / Policy Engine / Execution Gateway / Secret Zero Exposure / immutable audit / recovery / red team。

> **表は相棒。裏は要塞。**

### 24時間自己改善
夜間Candidate → isolated TEST → 朝提案 → 人間承認後のみ採用。

### 対話型業務OS
メール、Calendar、図面、写真、見積、発注、納品、請求、完成図書、担当者、期限、ToDoを案件単位で理解する「会社の第二の脳」。

### 現場職人向け極小UI
図書カメラ / 報告 / 図面。

### Mobile KADP
PC/スマホでProject・History・Task・Approval・Contextを共有。

---

# 19. Project Adapter

将来：
- Money Forward
- 完成図書AI
- LINE報告
- LP
- Web/GAS
- Calendar/出面
- 現場写真整理
- 図面連携
- 請求・経理補助

COREへ案件固有ロジックを混在させない。

---

# 20. 開発開始時の必須読み込み

1. `KADP_MASTER_SPEC.md`
2. Project README
3. Project固有仕様
4. protected tests
5. safety rules
6. Git state
7. DEV/TEST state

その後：
- PROD特定/除外
- allowlist
- denylist
- risk
- completion criteria

を確定する。

---

# 21. 作業完了時の報告

人間には：
- 何を変更
- TEST
- リスク
- 変更file
- Candidate / commit
- 確認場所
- PROD影響
- PROD未実行

を簡潔な日本語で報告する。

---

# 22. Human PowerShell Zero

最終目標：

**自然文 → 実装 → TEST → Candidate review → OK/NG → Git**

までGUI完結。

2026-09-09時点：

**部分達成。**

自己開発E2Eは成立したが、環境構築・OAuthトラブル対応・Candidate差分確認等にPowerShellが残る。

---

# 23. 現在の到達点

2026-09-09、KADP Independent Proto は初めて、

> **自分で自分の安全なロジックを改善し、隔離TESTし、人間確認で停止し、OK後だけ同一Candidateをcommitする**

E2Eを実物で完走した。

完全自律KADPの完成ではないが、

- Worker
- Candidate
- Safety
- Sandbox
- Isolated TEST
- Human Approval
- Git
- Evidence

をつないだ最小自己改善ループが成立した。

---

# 24. v1.3 更新点

1. Source of Truthを `kadp-independent-proto` へ更新。
2. Independent Proto現行構成を正式記録。
3. Antigravity official CLI Workerを記録。
4. CHANGE / SELF_DEVELOPMENT_CHANGEを記録。
5. Candidate-only Worker Interfaceを記録。
6. QuickJS無権限ロジック層を記録。
7. workflow.js sandboxed plannerを正式化。
8. SELF_DEVELOPMENT_CHANGE human approval gateを記録。
9. Candidate隔離worktree方式を記録。
10. VERIFIED SELF-DEVELOPMENT E2Eを正式記録。
11. `c1a4c94` をcheckpoint化。
12. CORE自己開発をまだ開放しない理由を明記。
13. 通常CHANGEは承認ゲート統一前であることを明記。
14. DIAGNOSTIC_READONLY / Conversation Brain未実装を明記。
15. 次の優先順位を更新。

---

# 25. KADPの到達目標

利用者：

> 「カドップ、○○やっといて」

KADP：

> 「調べました。安全に進められるので実装してTESTしました。変更点は○○、TESTはPASSです。確認してください。」

利用者：

> 「OK」

KADP：

> 「承認された同一成果物を保存しました。次に進める操作がある場合は、その権限に応じて改めて確認します。」

> **人間の仕事は、目的を伝えることと、重要な判断を承認すること。**

---

# 26. 変更禁止メモ

本書を読んだAI / Agentは：

- 本書を自己判断で書き換えない。
- Constitutionを弱めない。
- Safety Kernelを弱めない。
- protected testsを都合よく変更しない。
- PROD承認を省略しない。
- 人間のOKを別Candidateへ流用しない。
- 能力追加を権限追加と解釈しない。
- 不明点を推測で突破しない。

---

**END OF KADP MASTER SPEC v1.3**
