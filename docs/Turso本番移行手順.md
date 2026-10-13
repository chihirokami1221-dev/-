# Growth OS 本番DB移行手順(Turso)

- 最終更新: 2026-10-13
- 前提: 本番用Turso DBは未作成。実データ移行は未実施。この手順書は計画であり、実行には別途承認が必要。

## 全体の流れ

1. 本番用Turso DBの作成
2. 安全な接続トークンの発行・保管
3. 移行直前のSQLiteバックアップ(既存手順を使用)
4. 13テーブルの移行(`turso-verify/turso-restore.cjs`を使用)
5. 件数・内容ハッシュ照合
6. アプリの接続先切替
7. 切替後のTursoバックアップ運用開始

## 1. 本番用Turso DBの作成

- Tursoダッシュボードで、本番用の新しいデータベースを作成する(名称例: `growth-os-prod`)。
- `init_from_schema.sql`(既存の、実データに触れない読み取り専用コマンドで生成したスキーマ定義)を適用する。
- 作成後、全13テーブルが0件であることを確認する(`turso-restore.cjs`の`verifyTargetIsEmpty`相当のチェックで自動確認される)。

## 2. 接続トークンの発行・保管

- **読み書き両方が必要**(移行時の書き込み・アプリ運用時のCRUD双方)なトークンを、本番DB用に新規発行する。
- トークンは`.env`やVercelの環境変数にのみ保存し、チャット・ログ・Gitには一切記載しない。
- 既存の検証用トークン(`growth-os-test`・`growth-os-migration-test`用)とは別物として管理する。

## 3. 移行直前のSQLiteバックアップ

- 既存の`docs/週次バックアップ手順書.md`の手順(`backup-sqlite.cjs`)で、移行直前のローカルSQLiteを必ずバックアップする。
- 整合性確認(`RESULT=SUCCESS`)を確認してから次へ進む。
- **このバックアップは、移行が失敗した場合にローカル運用へ戻すための保険であり、移行後も削除しない。**

## 4. 13テーブルの移行

1. ローカルSQLite(`prisma/dev.db`)を直接の移行元として使う(Turso同期を介さない、最もシンプルな経路)。
2. `turso-verify/turso-restore.cjs`を使い、以下のように実行する。
   ```powershell
   cd "growth-osフォルダへのパス\turso-verify"
   node --env-file=../.env.turso-prod.local turso-restore.cjs "../prisma/dev.db" "growth-os-prod"
   ```
   (`.env.turso-prod.local`に`TURSO_RESTORE_TARGET_URL`・`TURSO_RESTORE_TARGET_TOKEN`を設定。第2引数の`"growth-os-prod"`は、誤接続防止のための接続先ホスト名確認用の文字列。)
3. スクリプトは、**接続先が空であることを確認した上で**、全テーブルを1つのトランザクションで書き込み、失敗時は自動的に反映されない(ロールバック)。
4. 完了後、`RESULT=SUCCESS`と、件数・内容ハッシュの一致を確認する。

## 5. 件数・内容ハッシュ照合

- `turso-restore.cjs`自体が、復元後に件数・内容ハッシュを自動比較し、不一致があれば`RESULT=FAILURE`として報告する。
- 念のため、Tursoダッシュボードからも主要テーブルの件数を目視確認する。

## 6. アプリの接続先切替

1. Vercel(または他のホスティング先)の環境変数に、`TURSO_DATABASE_URL`・`TURSO_AUTH_TOKEN`(本番用、`src/lib/prisma.ts`が参照する変数名)を設定する。
2. ローカル開発環境では、`.env`に同変数を追加しない限り、これまで通りローカルSQLiteのまま動作する(`src/lib/prisma.ts`の既存の分岐ロジックにより、両方未設定なら無変更)。
3. 本番環境でのみ、Tursoへの接続に切り替わることを確認する。

## 7. 移行失敗時の復旧方法

- 移行スクリプト自体は「空のDBにだけ書き込む」設計のため、失敗してもTurso側に不完全なデータが残ることはない(`verifyTargetIsEmpty`が先に止めるか、`batch()`のロールバックが働く)。
- 失敗した場合は、原因を調査した上で、**同じ空の本番DBに対して再実行する**(ローカルSQLiteは一切変更されていないため、やり直しは安全)。
- アプリの接続先は、環境変数を設定するまでローカルSQLiteのままなので、移行作業中にアプリの動作が止まることはない。

## 8. 切替後のTursoバックアップ運用

- `docs/週次Tursoバックアップ手順書.md`の手順を、本番DBの接続情報で開始する。
- 本番切替後は、**ローカルSQLiteとTursoの両方が存在する状態**になるが、本番運用上の正本はTurso側になる。ローカルSQLiteは移行直前の状態で保持し、万一の復旧用として残す。

## 未確定事項

- `growth-os-migration-test`での実際の復元リハーサル(本手順の4を、本番の代わりに検証用DBで試す)は、認証情報が未準備のため未実施。
- 本番DB作成・トークン発行は、Tursoダッシュボードでの操作が必要(承認後に実施)。
