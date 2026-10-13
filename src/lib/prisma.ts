import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// TURSO_DATABASE_URL/TURSO_AUTH_TOKENが両方設定されている場合だけTursoへ接続する。
// どちらも未設定ならこれまで通りローカルのSQLiteファイル(DATABASE_URL)へ接続する(挙動は変更しない)。
// 片方だけ設定されている状態は設定ミスとみなし、サイレントにフォールバックさせず明示的にエラーにする。
function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: tursoToken });
    return new PrismaClient({ adapter });
  }

  if (tursoUrl || tursoToken) {
    throw new Error(
      "TURSO_DATABASE_URLとTURSO_AUTH_TOKENは両方設定するか、両方とも未設定にしてください(片方だけの設定は不可)。",
    );
  }

  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
