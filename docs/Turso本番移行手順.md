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
- **スキーマ適用方法の決定(確定・2026-10-16)**: 当初は`prisma migrate deploy`をTursoアダプタ経由で本番DBに直接実行する方式を検討したが、以下の理由で採用しなかった。
  1. `prisma migrate deploy`をTursoアダプタ経由で実行した実績が無く、未検証のリスクがあった。
  2. **実機検証の結果、`prisma/migrations`配下の13件の`migration.sql`をそのまま順番に再生しても、現在の`prisma/dev.db`の実際のスキーマとは一致しないことが判明した**(`AchievementAxisLink`等の一部カラム・`MarketDataEntry`テーブル・一部インデックスが`prisma db push`で追加され、対応する`migration.sql`に反映されていないため)。つまり13件のファイルは履行順序とchecksum計算には使えるが、CREATE TABLE文の再生だけでは本番スキーマを正しく作れない。
  - **採用した方式**: `turso-verify/create-prod-schema.cjs`を使う。
    - テーブル・インデックスのCREATE文は、13件のマイグレーションファイルを再生するのではなく、**現在の`prisma/dev.db`のsqlite_master(動いている正本のスキーマ)から直接抽出**して適用する(これにより本番スキーマが現在のアプリの実際の期待と完全一致することを保証する)。
    - `_prisma_migrations`テーブルは標準のPrisma定義で作成し、13件の`migration.sql`それぞれのsha256 checksum(Prismaと同一の算出方法であることを実機で確認済み)を使って、「この13件は既に適用済み」という履歴だけを記録する(SQLの再実行はしない。Prismaの「既存DBへのベースライン化」と同じ考え方)。
    - 実行前に、接続先に既存オブジェクトが1つも無いことを必ず確認し、1つでもあれば何も書き込まず中止する。
    - ローカルの一時DBに対する検証(`turso-verify/create-prod-schema.test.cjs`)で、作成結果が`prisma/dev.db`のテーブル・インデックス定義と完全一致すること、`_prisma_migrations`が13件・正しいchecksumで記録されることを確認済み。
  - **使い方(書き込み可能トークン発行後、承認を得てから実行)**:
    ```powershell
    cd "growth-osフォルダへのパス\turso-verify"
    node --env-file=../.env.turso-prod-write.local create-prod-schema.cjs "growth-os-prod"
    ```
    (`.env.turso-prod-write.local`に`TURSO_PROD_WRITE_DATABASE_URL`・`TURSO_PROD_WRITE_AUTH_TOKEN`を設定する。既存の読み取り専用用の変数名`TURSO_TEST_DATABASE_URL`/`TURSO_TEST_READONLY_TOKEN`とは別名にして混同を防ぐ。第1引数は誤接続防止のための接続先ホスト名確認用文字列。)
  - この判断は本番DB作成時に一度だけ必要(検証用DBのやり方を踏襲しない)。
- 作成後、全13テーブルが0件であることを確認する(`turso-restore.cjs`の`verifyTargetIsEmpty`相当のチェックで自動確認される)。

## 2. 接続トークンの発行・保管

- **読み書き両方が必要**(スキーマ作成・移行時の書き込み・アプリ運用時のCRUD双方)なトークンを、本番DB用に新規発行する。
- トークンは`.env.turso-prod-write.local`(変数名`TURSO_PROD_WRITE_DATABASE_URL`・`TURSO_PROD_WRITE_AUTH_TOKEN`)やVercelの環境変数にのみ保存し、チャット・ログ・Gitには一切記載しない。既存の読み取り専用トークン(`.env.turso-prod.local`)とはファイル・変数名を分け、混同を防ぐ。
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

## 10. マイグレーション履歴(_prisma_migrations)と実スキーマの差異(詳細)

`create-prod-schema.cjs`は、テーブル・インデックスの実体は現在の`prisma/dev.db`のsqlite_masterから
そのまま作るが、`_prisma_migrations`には13件の`migration.sql`のchecksumを「適用済み」として
記録する。この2つは厳密には一致しない(13件のファイルをそのまま再生しても、現在のdev.dbには
ならない)。実機検証(2026-10-16)で確認した具体的な差異は以下の通り。

| テーブル | 再生結果との差異 |
|---|---|
| `Achievement` | `role`・`thirdPartyFeedback`・`revenueAmount`・`revenueCurrency`・`revenueType`・`revenuePeriod`・`sourceDiaryEntryId`・`relatedRoadmapItemId`・`relatedIndividualGoalId`列が無い(旧`isReproducible`・`isMonetized`列のまま)。関連インデックス2件も無い。 |
| `MarketDataEntry` | テーブル自体がどのmigration.sqlにも存在しない(`prisma db push`のみで作られ、対応する記録が一度も残っていない)。 |
| `MarketValueScoreSnapshot` | `axisScoresJson`・`reasonNote`・`achievementCountAtSnapshot`列が無い。 |
| `RoadmapItem` | `content`・`completionCriteria`・`reason`列に`DEFAULT ''`が付かない(列自体はあるが既定値が異なる)。 |
| `WeeklyTodoItem` | `roadmapItemId`・`individualGoalId`列と、それに対応する外部キー制約2件が無い。 |

**今後のマイグレーション管理への影響**:
- `prisma migrate dev`は、migration.sql群を「シャドウDB」上で再生した結果をスキーマの基準として
  差分を計算する。上記の差異がある状態で`prisma migrate dev`を使うと、シャドウDBが実際の本番
  スキーマと異なるため、不要な(あるいは不整合な)マイグレーションが生成される可能性がある。
- 一方、`prisma db push`はシャドウDBを使わず、`schema.prisma`と実際のDBを直接比較するため、
  この差異の影響を受けない。
- **推奨**: 本番DBのスキーマを今後変更する際は、しばらくは`prisma db push`を使う(これまでの
  ローカル開発でも大半の変更が`db push`で行われてきており、運用上の実績もある)。`prisma migrate
  dev`を再度使いたい場合は、その前に「現在の実スキーマを反映した新しい1本のマイグレーション」を
  `prisma migrate dev --create-only`等で作り直し、履歴を実態に合わせてから再開する。

## 未確定事項

- 本番DB作成・読み取り専用トークン発行は完了済み。書き込み可能トークンの発行は、Tursoダッシュボードでの操作が必要(承認後に実施)。
- `create-prod-schema.cjs`・`turso-restore.cjs`とも、ローカル合成DBでの検証は完了しているが、実際のTurso本番DBへの書き込み実行はまだ行っていない(書き込み可能トークン発行・対象確認・承認後に実施)。
