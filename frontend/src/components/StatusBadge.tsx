import type { MeetingStatus, TaskStatus } from "../lib/types";
import { STATUS_LABEL, isProcessing } from "../lib/format";
import { cn } from "./ui";

const MEETING_STYLES: Record<MeetingStatus, string> = {
  recording: "bg-slate-100 text-slate-600",
  uploaded: "bg-amber-50 text-amber-700",
  transcribing: "bg-brand-50 text-brand-700",
  summarizing: "bg-brand-50 text-brand-700",
  ready: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  const processing = isProcessing(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        MEETING_STYLES[status],
      )}
    >
      <span className="relative flex h-2 w-2">
        {processing && (
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-500" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            status === "ready" && "bg-emerald-500",
            status === "failed" && "bg-red-500",
            processing && "bg-brand-500",
            (status === "recording") && "bg-slate-400",
          )}
        />
      </span>
      {STATUS_LABEL[status]}
    </span>
  );
}

const TASK_STYLES: Record<TaskStatus, string> = {
  needs_assignee: "bg-amber-50 text-amber-700 ring-amber-200",
  open: "bg-brand-50 text-brand-700 ring-brand-200",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};
const TASK_LABEL: Record<TaskStatus, string> = {
  needs_assignee: "Needs review",
  open: "Open",
  done: "Done",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TASK_STYLES[status],
      )}
    >
      {TASK_LABEL[status]}
    </span>
  );
}
