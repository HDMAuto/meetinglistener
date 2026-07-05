import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { MeetingStatusBadge, TaskStatusBadge } from "./StatusBadge";
import { cn, Spinner, useFocusTrap } from "./ui";

// Must match backend/src/search/search.service.ts HIGHLIGHT_START/END.
const HL_START = "\u0001";
const HL_END = "\u0002";

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// Renders a ts_headline snippet: text between sentinels becomes a highlight.
// Everything is rendered as text nodes, so transcript content can never
// inject markup.
function Snippet({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  text.split(HL_START).forEach((chunk, i) => {
    if (i === 0) {
      if (chunk) nodes.push(chunk);
      return;
    }
    const end = chunk.indexOf(HL_END);
    if (end === -1) {
      nodes.push(chunk);
      return;
    }
    nodes.push(
      <mark key={i} className="rounded-sm bg-accent-500/20 px-0.5 font-semibold text-ink">
        {chunk.slice(0, end)}
      </mark>,
    );
    if (chunk.slice(end + 1)) nodes.push(chunk.slice(end + 1));
  });
  return <>{nodes}</>;
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
      {children}
    </div>
  );
}

interface RowProps {
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
  children: ReactNode;
}

function Row({ active, onHover, onSelect, children }: RowProps) {
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        active ? "bg-brand-50" : "hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const q = useDebounced(query, 250).trim();

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["search", q],
    queryFn: () => api.search(q),
    enabled: open && q.length >= 2,
    placeholderData: keepPreviousData,
  });

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      setQuery("");
      setSelected(0);
    }
  }, [open]);

  const results = q.length >= 2 ? data : undefined;

  // One flat list across groups for a single keyboard selection.
  const flat = useMemo(() => {
    if (!results) return [];
    return [
      ...results.meetings.map((m) => ({ key: `m-${m.id}`, meetingId: m.id })),
      ...results.transcripts.map((t) => ({ key: `t-${t.meetingId}`, meetingId: t.meetingId })),
      ...results.tasks.map((t) => ({ key: `k-${t.id}`, meetingId: t.meetingId })),
    ];
  }, [results]);

  useEffect(() => {
    setSelected(0);
  }, [results]);

  const trapRef = useFocusTrap(open);

  function go(meetingId: string) {
    onOpenChange(false);
    navigate(`/meetings/${meetingId}`);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      onOpenChange(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flat.length === 0) return;
      setSelected((s) => Math.min(s + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && flat[selected]) {
      go(flat[selected].meetingId);
    }
  }

  if (!open) return null;

  const transcriptOffset = results ? results.meetings.length : 0;
  const taskOffset = results ? transcriptOffset + results.transcripts.length : 0;
  const hasAny = flat.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative z-10 w-full max-w-xl animate-fade-up overflow-hidden rounded-2xl bg-white shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <svg
            className="h-5 w-5 shrink-0 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search meetings, transcripts, tasks…"
            className="w-full bg-transparent py-4 text-sm text-ink placeholder:text-slate-400 focus:outline-none"
          />
          {isFetching && <Spinner className="h-4 w-4 text-brand-500" />}
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            esc
          </kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {q.length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">
              Type at least two characters to search everything you've recorded.
            </p>
          ) : isError ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-muted">Search failed.</p>
              <button
                onClick={() => refetch()}
                className="mt-2 cursor-pointer text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Try again
              </button>
            </div>
          ) : results && !hasAny ? (
            <p className="px-3 py-8 text-center text-sm text-muted">
              No matches for “{results.query}”.
            </p>
          ) : results ? (
            <>
              {results.meetings.length > 0 && (
                <>
                  <GroupLabel>Meetings</GroupLabel>
                  {results.meetings.map((m, i) => (
                    <Row
                      key={`m-${m.id}`}
                      active={selected === i}
                      onHover={() => setSelected(i)}
                      onSelect={() => go(m.id)}
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                        {m.title}
                      </span>
                      <MeetingStatusBadge status={m.status} />
                    </Row>
                  ))}
                </>
              )}

              {results.transcripts.length > 0 && (
                <>
                  <GroupLabel>In transcripts</GroupLabel>
                  {results.transcripts.map((t, i) => (
                    <Row
                      key={`t-${t.meetingId}`}
                      active={selected === transcriptOffset + i}
                      onHover={() => setSelected(transcriptOffset + i)}
                      onSelect={() => go(t.meetingId)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">
                          {t.meetingTitle}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                          <Snippet text={t.snippet} />
                        </p>
                      </div>
                    </Row>
                  ))}
                </>
              )}

              {results.tasks.length > 0 && (
                <>
                  <GroupLabel>Tasks</GroupLabel>
                  {results.tasks.map((t, i) => (
                    <Row
                      key={`k-${t.id}`}
                      active={selected === taskOffset + i}
                      onHover={() => setSelected(taskOffset + i)}
                      onSelect={() => go(t.meetingId)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">
                          {t.description}
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          {t.meetingTitle}
                          {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                        </div>
                      </div>
                      <TaskStatusBadge status={t.status} />
                    </Row>
                  ))}
                </>
              )}
            </>
          ) : (
            <p className="px-3 py-8 text-center text-sm text-muted">Searching…</p>
          )}
        </div>
      </div>
    </div>
  );
}
