# Growth OS 本番DB移行手順(Turso)

- 最終更新: 2026-10-14
- 前提: 本番用Turso DBは未作成。実データ移行は未実施。この手順書は計画であり、実行には別途承認が必要。
- **`growth-os-migration-test`での復元リハーサルは、合成データ14件で実施し成功済み**(件数・内容ハッシュ完全一致、単一ファイルへのバックアップ取得往復も成功)。この手順自体の安全性は実機で確認済み。

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
- **スキーマ適用方法の判断(重要)**: 検証用の2DB(`growth-os-test`・`growth-os-migration-test`)は、いずれも`init_from_schema.sql`を直接適用する方法で作られており、**`_prisma_migrations`テーブルが存在しない**ことを確認済み(読み取り専用調査で確認)。この方法のままだと、将来Prismaでスキーマ変更をする際に`prisma migrate deploy`が履歴を認識できず、正しく動作しない可能性がある。
  - **推奨**: 本番DBだけは、`init_from_schema.sql`の直接適用ではなく、**`prisma migrate deploy`を本番DB(Tursoアダプタ経由)に対して実行**し、既存の13件のマイグレーションファイルを正規の手順で適用する。これにより`_prisma_migrations`に正しい履歴が残り、以後のスキーマ変更が通常のPrismaワークフローで行える。
  - この判断は本番DB作成時に一度だけ必要(検証用DBのやり方を踏襲しない)。
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
   (`.env.turso-prod.local`に`TURSO_TEST_DATABASE_URL`・`TURSO_TEST_READONLY_TOKEN`を設定。変数名は検証時と同じものを使う。第2引数の`"growth-os-prod"`は、誤接続防止のための接続先ホスト名確認用の文字列。値の前後に誤って括弧や引用符が付いても、スクリプト側で自動的に除去される。)
3. **移行中はアプリを使用しない**(ブラウザでGrowth OSを操作しない)。移行元はこの時点のローカルSQLiteファイルのスナップショットであり、移行中に新しい記録を追加しても反映されないため。
4. スクリプトは、**接続先が空であることを確認した上で**、全テーブルを1つのトランザクションで書き込み、失敗時は自動的に反映されない(ロールバック)。
5. 完了後、`RESULT=SUCCESS`と、件数・内容ハッシュの一致を確認する。

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

## 9. GitHub・Vercel公開までの作業順序

1. ローカルGitの未push分を確認し、秘密情報が含まれていないことを最終確認する(`.env`・DBファイルは`.gitignore`で既に除外済み)。
2. GitHubへpush(承認後)。
3. Vercelでリポジトリを連携し、プロジェクトを作成する。
4. Vercelの環境変数に、本番用の`TURSO_DATABASE_URL`・`TURSO_AUTH_TOKEN`・`AUTH_PASSWORD_SALT`・`AUTH_PASSWORD_HASH`・`AUTH_SESSION_SECRET`・`AI_FEATURES_DISABLED=true`を設定する。
5. デプロイを実行する(承認後)。
6. デプロイ後、Vercelダッシュボードでログイン用のWAFレート制限ルールを設定する(デプロイ前は設定不可)。

## 未確定事項

- 本番DB作成・トークン発行は、Tursoダッシュボードでの操作が必要(承認後に実施)。
- `prisma migrate deploy`を実際にTursoアダプタ経由で本番DBへ実行した実績はまだない(ローカルSQLiteでの実行実績はあるが、Turso向けは未検証)。本番DB作成時に初めて試すことになる。
