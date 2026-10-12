import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => <h1 className="mb-3 mt-6 text-xl font-bold text-slate-900 first:mt-0">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 text-lg font-bold text-slate-900 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-base font-bold text-slate-800 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-3 text-sm font-bold text-slate-800 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="mb-3 text-sm leading-6 text-slate-700 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1 text-sm leading-6 text-slate-700 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1 text-sm leading-6 text-slate-700 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  hr: () => <hr className="my-4 border-slate-200" />,
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700">{children}</th>
  ),
  td: ({ children }) => <td className="border border-slate-200 px-2 py-1.5 text-slate-700">{children}</td>,
  a: ({ children, href }) => (
    <a href={href} className="text-emerald-700 underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-slate-300 pl-3 text-sm text-slate-500 last:mb-0">{children}</blockquote>
  ),
};

export function Markdown({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
