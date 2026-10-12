export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
      {message}
    </div>
  );
}
