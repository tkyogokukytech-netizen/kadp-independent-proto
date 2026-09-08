# Legacy Migration Spec — 取得可能証拠に限定した初版

根拠: [KADP_LEGACY_MANIFEST.md](KADP_LEGACY_MANIFEST.md)

## 移行の境界

旧repositoryの追跡ファイル・Git履歴を変更しない。Independent Protoは別系統とし、旧仕様は参考資料として扱う。旧最新版が存在することを根拠に、未確認の実装・互換性・TEST成功を補完しない。

| 資産 | 現時点の扱い | 移行受入条件 |
|---|---|---|
| README Constitution | SPEC_ONLYの設計参考 | 今回のProto禁止事項を優先し、独立したSafety実装と保護TESTで検証 |
| roles.yaml | 役割をproviderから分離する設計参考 | 接続実装・利用権限・追加課金なしの確認。既存openai fallbackは継承しない |
| State Management | 日本語状態表示の設計参考 | Protoの状態遷移とGUIの実動作で検証 |
| Learning Principle | 人間権限を上書きしない原則の参考 | Safety・Constitution・protected testsへの自己変更を拒否 |
| Git履歴 | Manifest記載のcommitを参照 | 原本を維持し、取得元commitを明記 |
| 実装コード / TEST / 失敗履歴 | UNKNOWN、移植対象として未登録 | 実物を取得してファイル・commit・試験結果を確認後に登録 |
| 会社PC未push最新版との差分 | UNKNOWN | 正規に取得可能になった時点で比較。推定による補完禁止 |

## 後続Protoへの引継ぎ

1. 取得元とcommitを固定し、実コード・TEST・仕様を区別する。
2. 能力ごとに証拠と分類を更新する。未知の能力を実装済みと扱わない。
3. 移植はCandidateとして隔離し、Safety検証・保護TEST・通常TEST後にcommitする。
4. Safety、Constitution、protected testsの変更はWAITING_HUMANとする。
5. Codexを通常Workerまたは自動fallbackに登録しない。利用には人間の明示承認が必要。

## 現在の到達点

Phase 0の取得可能証拠を記録した段階。Proto出生、Bootstrap Worker接続、GUI E2E、自己開発、無人開発E2Eは未実施。これらを完了と報告しない。
受領した実行命令はPhase 1 E2Eの「このE2E中、Codexが裏側で、」で途切れている。後続の制約と引継ぎ条件を受領してから、その条件を反映する。
