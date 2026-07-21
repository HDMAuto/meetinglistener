import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { MeetingSpeakers, MeetingWithTeam, SpeakerView, Task, User } from "../lib/types";
import { STATUS_LABEL, formatDateTime, formatDuration, initials, isProcessing } from "../lib/format";
import { MeetingStatusBadge, TaskStatusBadge } from "../components/StatusBadge";
import { Button, Card, Modal, Spinner, cn } from "../components/ui";

export function MeetingDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting", id],
    queryFn: () => api.getMeeting(id),
    refetchInterval: (q) => (q.state.data && isProcessing(q.state.data.status) ? 3000 : false),
  });

  const deleteMeeting = useMutation({
    mutationFn: () => api.deleteMeeting(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      navigate("/");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    );
  }
  if (!meeting) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-center">
        <p className="text-muted">Meeting not found.</p>
        <Link to="/" className="mt-3 inline-block font-semibold text-brand-600">
          ← Back to meetings
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Meetings
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{meeting.title}</h1>
          <div className="mt-2 flex items-center gap-4 text-sm text-muted">
            <span>{formatDateTime(meeting.createdAt)}</span>
            <span>·</span>
            <span>{formatDuration(meeting.durationSec)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {meeting.team && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              {meeting.team.name}
            </span>
          )}
          <MeetingStatusBadge status={meeting.status} />
          <button
            onClick={() => setConfirmOpen(true)}
            aria-label="Delete meeting"
            title="Delete meeting"
            className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {isProcessing(meeting.status) ? (
        <ProcessingState meeting={meeting} />
      ) : meeting.status === "failed" ? (
        <FailedState meeting={meeting} />
      ) : (
        <ReadyState meeting={meeting} />
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete meeting?">
        <p className="text-sm text-slate-600">
          This permanently deletes <span className="font-semibold text-ink">{meeting.title}</span> —
          its transcript, tasks, and notifications. This can’t be undone.
        </p>
        {deleteMeeting.isError && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Couldn’t delete the meeting. Please try again.
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => deleteMeeting.mutate()}
            loading={deleteMeeting.isPending}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            Delete meeting
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ProcessingState({ meeting }: { meeting: MeetingWithTeam }) {
  const steps = ["uploaded", "transcribing", "summarizing", "ready"] as const;
  const currentIdx = steps.indexOf(meeting.status as (typeof steps)[number]);
  return (
    <Card className="mt-8 p-8">
      <div className="flex items-center gap-3">
        <Spinner className="h-5 w-5 text-brand-600" />
        <span className="font-semibold text-ink">{STATUS_LABEL[meeting.status]}…</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        This runs in the background — the page updates automatically when it's done.
      </p>
      <ol className="mt-6 space-y-3">
        {steps.slice(1).map((s, i) => {
          const idx = i + 1;
          const done = currentIdx > idx;
          const active = currentIdx === idx;
          return (
            <li key={s} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  done && "bg-emerald-100 text-emerald-700",
                  active && "bg-brand-100 text-brand-700",
                  !done && !active && "bg-slate-100 text-slate-400",
                )}
              >
                {done ? "✓" : idx}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  active ? "text-ink" : done ? "text-slate-500" : "text-slate-400",
                )}
              >
                {STATUS_LABEL[s]}
              </span>
              {active && <Spinner className="h-3.5 w-3.5 text-brand-500" />}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function FailedState({ meeting }: { meeting: MeetingWithTeam }) {
  return (
    <Card className="mt-8 border-red-200 p-8">
      <h2 className="flex items-center gap-2 font-semibold text-red-700">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
        </svg>
        Processing failed
      </h2>
      <p className="mt-2 text-sm text-muted">
        {meeting.errorMessage ?? "Something went wrong while processing this meeting."}
      </p>
    </Card>
  );
}

function ReadyState({ meeting }: { meeting: MeetingWithTeam }) {
  const { data: tasks } = useQuery({
    queryKey: ["tasks", meeting.id],
    queryFn: () => api.listTasks(meeting.id),
  });
  const { data: transcript } = useQuery({
    queryKey: ["transcript", meeting.id],
    queryFn: () => api.getTranscript(meeting.id).catch(() => null),
  });
  const { data: speakerData } = useQuery({
    queryKey: ["speakers", meeting.id],
    queryFn: () => api.getSpeakers(meeting.id).catch(() => null),
  });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: api.listUsers });

  const needsReview = tasks?.filter((t) => t.status === "needs_assignee").length ?? 0;
  const teamMemberIds = new Set(meeting.team?.members.map((m) => m.id) ?? []);
  const speakerByLabel = new Map((speakerData?.speakers ?? []).map((s) => [s.label, s]));

  return (
    <div className="mt-8 space-y-6">
      {/* Goal */}
      {meeting.goal && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            Meeting goal
          </div>
          <p className="mt-2 text-[15px] font-medium text-brand-900">{meeting.goal}</p>
        </div>
      )}

      {/* Summary */}
      <Card className="p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Summary</h2>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-700">
          {(meeting.summary ?? "No summary.").split("\n").filter(Boolean).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </Card>

      {/* Assignments */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Assignments {tasks ? `(${tasks.length})` : ""}
          </h2>
          {needsReview > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {needsReview} need{needsReview === 1 ? "s" : ""} review
            </span>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {!tasks ? (
            <Spinner className="h-5 w-5 text-brand-600" />
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted">No action items were detected in this meeting.</p>
          ) : (
            tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                users={users ?? []}
                meetingId={meeting.id}
                teamMemberIds={teamMemberIds}
              />
            ))
          )}
        </div>
      </Card>

      {/* Speakers */}
      {speakerData && speakerData.speakers.length > 0 && (
        <SpeakersCard
          meetingId={meeting.id}
          speakers={speakerData.speakers}
          candidates={speakerData.candidates}
        />
      )}

      {/* Notes / transcript */}
      <Card className="p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Notes · Transcript</h2>
        {transcript ? (
          <div className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {transcript.segments && transcript.segments.length > 0
              ? transcript.segments.map((u, i) => {
                  const sp = speakerByLabel.get(u.speaker);
                  return (
                    <p key={i} className="mb-2">
                      <span className={cn("font-semibold", speakerColor(u.speaker).name)}>
                        {sp?.displayName ?? `Speaker ${u.speaker}`}:
                      </span>{" "}
                      {u.text}
                    </p>
                  );
                })
              : transcript.fullText}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No transcript available.</p>
        )}
      </Card>
    </div>
  );
}

// Stable per-speaker accent so a speaker reads the same colour in the card and
// the transcript. AssemblyAI emits sequential letters (A, B, C…).
const SPEAKER_COLORS = [
  { chip: "bg-brand-100 text-brand-700", name: "text-brand-700" },
  { chip: "bg-violet-100 text-violet-700", name: "text-violet-700" },
  { chip: "bg-emerald-100 text-emerald-700", name: "text-emerald-700" },
  { chip: "bg-amber-100 text-amber-700", name: "text-amber-700" },
  { chip: "bg-rose-100 text-rose-700", name: "text-rose-700" },
  { chip: "bg-cyan-100 text-cyan-700", name: "text-cyan-700" },
] as const;

function speakerColor(label: string): (typeof SPEAKER_COLORS)[number] {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + hash * 31;
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
}

const GUEST = "__guest__";
const CLEAR = "__clear__";

function SpeakersCard({
  meetingId,
  speakers,
  candidates,
}: {
  meetingId: string;
  speakers: SpeakerView[];
  candidates: MeetingSpeakers["candidates"];
}) {
  return (
    <Card className="p-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Speakers ({speakers.length})
      </h2>
      <p className="mt-1 text-xs text-muted">
        Confirm who each speaker is — corrections update the transcript and any tasks assigned to them.
      </p>
      <div className="mt-4 space-y-2.5">
        {speakers.map((s) => (
          <SpeakerRow key={s.label} meetingId={meetingId} speaker={s} candidates={candidates} />
        ))}
      </div>
    </Card>
  );
}

function StatusPill({ speaker }: { speaker: SpeakerView }) {
  const identified = speaker.userId || speaker.guestName;
  // No identity (unmapped, or explicitly "Not identified") always reads as
  // needs-review — a green "Confirmed" pill next to a nameless speaker is a lie.
  const cls = !identified
    ? "bg-slate-100 text-slate-500"
    : speaker.confirmed
      ? "bg-emerald-100 text-emerald-700"
      : "bg-amber-100 text-amber-700";
  const label = !identified ? "Needs review" : speaker.confirmed ? "Confirmed" : "Guessed";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>{label}</span>
  );
}

function SpeakerRow({
  meetingId,
  speaker,
  candidates,
}: {
  meetingId: string;
  speaker: SpeakerView;
  candidates: MeetingSpeakers["candidates"];
}) {
  const qc = useQueryClient();
  const [guestMode, setGuestMode] = useState(false);
  const [guestName, setGuestName] = useState("");
  const color = speakerColor(speaker.label);

  const update = useMutation({
    mutationFn: (body: { userId: string } | { guestName: string } | { clear: true }) =>
      api.updateSpeaker(meetingId, speaker.label, body),
    onSuccess: (data) => {
      qc.setQueryData(["speakers", meetingId], data);
      qc.invalidateQueries({ queryKey: ["tasks", meetingId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setGuestMode(false);
      setGuestName("");
    },
  });

  const onSelect = (value: string) => {
    if (!value) return;
    if (value === GUEST) {
      setGuestName(speaker.guestName ?? "");
      setGuestMode(true);
    } else if (value === CLEAR) {
      update.mutate({ clear: true });
    } else {
      update.mutate({ userId: value });
    }
  };

  const chipText = speaker.userId || speaker.guestName ? initials(speaker.displayName) : speaker.label;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              color.chip,
            )}
          >
            {chipText}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-ink">{speaker.displayName}</span>
              <StatusPill speaker={speaker} />
            </div>
            {(speaker.userId || speaker.guestName) && (
              <span className="text-xs text-muted">Speaker {speaker.label}</span>
            )}
          </div>
        </div>

        {guestMode ? (
          <form
            className="flex shrink-0 items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (guestName.trim()) update.mutate({ guestName: guestName.trim() });
            }}
          >
            <input
              autoFocus
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Guest name"
              className="w-36 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <Button type="submit" disabled={!guestName.trim()} loading={update.isPending}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={() => setGuestMode(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <select
            value=""
            onChange={(e) => onSelect(e.target.value)}
            disabled={update.isPending}
            aria-label={`Set who Speaker ${speaker.label} is`}
            className="shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm transition-colors hover:border-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">Change…</option>
            <optgroup label="People">
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <option value={GUEST}>＋ Guest…</option>
            {(speaker.userId || speaker.guestName) && <option value={CLEAR}>Not identified</option>}
          </select>
        )}
      </div>

      {speaker.quotes.length > 0 && (
        <p className="mt-2 line-clamp-2 pl-[42px] text-xs italic text-slate-500">
          “{speaker.quotes[0]}”
        </p>
      )}
      {update.isError && (
        <p className="mt-2 pl-[42px] text-xs font-medium text-red-600">
          Couldn’t update this speaker. Please try again.
        </p>
      )}
    </div>
  );
}

function TaskRow({
  task,
  users,
  meetingId,
  teamMemberIds,
}: {
  task: Task;
  users: User[];
  meetingId: string;
  teamMemberIds: Set<string>;
}) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tasks", meetingId] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const assign = useMutation({
    mutationFn: (assigneeId: string) => api.assignTask(task.id, assigneeId),
    onSuccess: invalidate,
  });
  const complete = useMutation({
    mutationFn: () => api.completeTask(task.id),
    onSuccess: invalidate,
  });

  const assignee = users.find((u) => u.id === task.assigneeId);
  const hasTeam = teamMemberIds.size > 0;
  const teamUsers = users.filter((u) => teamMemberIds.has(u.id));
  const nonTeamUsers = users.filter((u) => !teamMemberIds.has(u.id));
  const suggestions = task.suggestedAssigneeIds
    .map((sid) => users.find((u) => u.id === sid))
    .filter((u): u is User => !!u);
  const others = users.filter((u) => !task.suggestedAssigneeIds.includes(u.id));

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        task.status === "done" ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-[15px] font-medium text-ink",
            task.status === "done" && "text-slate-400 line-through",
          )}
        >
          {task.description}
        </p>
        <TaskStatusBadge status={task.status} />
      </div>

      {task.status === "needs_assignee" ? (
        <div className="mt-3 rounded-lg bg-amber-50/70 p-3">
          <p className="text-xs font-semibold text-amber-800">
            Who is this for?{" "}
            {task.assigneeText && (
              <span className="font-normal text-amber-700">(heard as “{task.assigneeText}”)</span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="">Select a person…</option>
              {hasTeam ? (
                <>
                  <optgroup label="Team">
                    {teamUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </optgroup>
                  {nonTeamUsers.length > 0 && (
                    <optgroup label="Others">
                      {nonTeamUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              ) : (
                <>
                  {suggestions.length > 0 && (
                    <optgroup label="Suggested">
                      {suggestions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={suggestions.length ? "Everyone else" : "People"}>
                    {others.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
            <Button
              onClick={() => picked && assign.mutate(picked)}
              disabled={!picked}
              loading={assign.isPending}
            >
              Assign
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {assignee ? initials(assignee.name) : "?"}
            </span>
            <span className="text-sm text-slate-600">
              {assignee ? assignee.name : task.assigneeText ?? "Unassigned"}
            </span>
          </div>
          {task.status === "open" && (
            <Button variant="outline" onClick={() => complete.mutate()} loading={complete.isPending}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Mark done
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
