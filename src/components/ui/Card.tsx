export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}
