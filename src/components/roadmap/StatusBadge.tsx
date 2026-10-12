export const STATUS_ORDER = ["IN_PROGRESS", "NOT_STARTED", "ON_HOLD", "DONE"] as const;

export const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "未着手",
  IN_PROGRESS: "進行中",
  ON_HOLD: "保留",
  DONE: "完了",
};

export const STATUS_COLOR: Record<string, string> = {
  NOT_STARTED: "#94a3b8",
  IN_PROGRESS: "#2563eb",
  ON_HOLD: "#d97706",
  DONE: "#16a34a",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: STATUS_COLOR[status] ?? "#64748b" }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const PRIORITY_LABEL: Record<string, string> = {
  HIGH: "優先度:高",
  MEDIUM: "優先度:中",
  LOW: "優先度:低",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-600">
      {PRIORITY_LABEL[priority] ?? priority}
    </span>
  );
}
