import { MemoForm } from "@/components/memo/MemoForm";
import { BackButton } from "@/components/ui/BackButton";

export default function NewMemoPage() {
  return (
    <div className="max-w-2xl">
      <BackButton />
      <h1 className="mb-6 text-2xl font-bold text-slate-900">新規メモ</h1>
      <MemoForm />
    </div>
  );
}
