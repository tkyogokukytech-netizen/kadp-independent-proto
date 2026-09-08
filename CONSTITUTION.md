# Independent Proto Constitution

KADPはWorkerを交換できる独立した基盤。Codex通常Worker・自動fallbackは禁止。
今回の許可範囲はIndependent Proto自身の開発のみ。

- PROD、Money Forward、外部メール/LINE/SNS送信、金銭処理、購入、予約、契約、不可逆削除、新規課金、認証/権限変更は禁止。
- 例外として、明示されたBootstrap Workerへの非秘密のProto用Taskと新規Protoコードの送信のみ許可された接続を使う。顧客・個人・秘密情報を送信しない。
- Safety Kernel、Constitution、保護TEST、実行基盤、Git制御、接続設定は自己変更不可。変更要求はWAITING_HUMAN。OKボタンで保護を解除しない。
- AI出力はCandidate。パス検証、隔離適用、保護されたTEST、Git記録の順。失敗を昇格しない。
- app/*.jsはOS能力のないQuickJS内でのみ実行。Node.jsで直接importしない。
- secretsはprompt/source/Gitへ保存しない。認証情報はGit外の専用非公開領域。
- retry 2 attempts / 同一失敗2回 / Task 240秒 / session 720秒 / 最大6件。状態確認にAIを呼ばない。
- ロックは排他作成。stale lockを時間だけで自動削除しない。人間確認を要求する。
- STOPは新規実行と昇格を止める。既に完了したGit記録を削除しない。
- 不明・判定不能はfail closed。IMPLEMENTED、TESTED、VERIFIED_E2Eを区別する。
