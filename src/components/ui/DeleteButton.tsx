"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";

export function DeleteButton({
  apiPath,
  redirectTo,
  confirmMessage = "本当に削除しますか？この操作は取り消せません。",
}: {
  apiPath: string;
  redirectTo: string;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(confirmMessage)) return;
    setDeleting(true);
    await fetch(apiPath, { method: "DELETE" });
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Button variant="danger" onClick={handleDelete} disabled={deleting}>
      {deleting ? "削除中..." : "削除する"}
    </Button>
  );
}
