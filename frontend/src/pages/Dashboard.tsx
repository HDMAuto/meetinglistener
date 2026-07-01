import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Meeting } from "../lib/types";
import { formatDate, formatDuration, isProcessing } from "../lib/format";
import { MeetingStatusBadge } from "../components/StatusBadge";
import { Button, Card, EmptyState, Input, Spinner } from "../components/ui";
import { NewMeetingModal } from "../components/NewMeetingModal";
import { useAuth } from "../auth/AuthContext";

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: api.listMeetings,
    refetchInterval: (q) =>
      (q.state.data ?? []).some((m: Meeting) => isProcessing(m.status)) ? 4000 : false,
  });

  const filtered = useMemo(() => {
    const list = meetings ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) =>
      [m.title, m.summary ?? "", m.goal ?? ""].some((t) => t.toLowerCase().includes(q)),
    );
  }, [meetings, search]);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {greeting()}, {user?.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {meetings?.length ?? 0} meeting{(meetings?.length ?? 0) === 1 ? "" : "s"} · your workspace
          </p>
        </div>
        <Button variant="accent" onClick={() => setModalOpen(true)}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          New meeting
        </Button>
      </header>

      <div className="mt-6">
        <div className="relative max-w-md">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" strokeLinecap="round" />
          </svg>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meetings, summaries, goals…"
            className="pl-9"
            aria-label="Search meetings"
          />
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted">
            <Spinner className="h-6 w-6 text-brand-600" />
          </div>
        ) : filtered.length === 0 ? (
          meetings && meetings.length > 0 ? (
            <EmptyState
              icon={<SearchIcon />}
              title="No matches"
              hint={`Nothing matches "${search}". Try a different search.`}
            />
          ) : (
            <EmptyState
              icon={<MicIcon />}
              title="No meetings yet"
              hint="Record or upload your first meeting and we'll transcribe it, summarize it, and pull out the tasks."
              action={
                <Button variant="accent" onClick={() => setModalOpen(true)}>
                  Record your first meeting
                </Button>
              }
            />
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m, i) => (
              <MeetingCard key={m.id} meeting={m} index={i} />
            ))}
          </div>
        )}
      </div>

      <NewMeetingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => {
          setModalOpen(false);
          qc.invalidateQueries({ queryKey: ["meetings"] });
          navigate(`/meetings/${id}`);
        }}
      />
    </div>
  );
}

function MeetingCard({ meeting, index }: { meeting: Meeting; index: number }) {
  return (
    <Link to={`/meetings/${meeting.id}`} className="group block animate-fade-up" style={{ animationDelay: `${index * 40}ms` }}>
      <Card className="h-full p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-semibold text-ink group-hover:text-brand-700">
            {meeting.title}
          </h3>
          <MeetingStatusBadge status={meeting.status} />
        </div>
        <p className="mt-3 line-clamp-3 min-h-[3.75rem] text-sm text-muted">
          {meeting.summary
            ? meeting.summary
            : isProcessing(meeting.status)
              ? "Processing — transcript and summary on the way…"
              : meeting.status === "failed"
                ? meeting.errorMessage ?? "Processing failed."
                : "No summary yet."}
        </p>
        <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon /> {formatDate(meeting.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon /> {formatDuration(meeting.durationSec)}
          </span>
        </div>
      </Card>
    </Link>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const SearchIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" strokeLinecap="round" />
  </svg>
);
const MicIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0014 0M12 18v3" strokeLinecap="round" />
  </svg>
);
const CalendarIcon = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18M8 2v4M16 2v4" strokeLinecap="round" />
  </svg>
);
const ClockIcon = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);
