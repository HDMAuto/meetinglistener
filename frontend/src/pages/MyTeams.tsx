import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Team, User } from "../lib/types";
import { initials } from "../lib/format";
import { Button, Card, EmptyState, Field, Input, Modal, Spinner, cn } from "../components/ui";

export function MyTeams() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);

  const { data: teams, isLoading } = useQuery({ queryKey: ["teams"], queryFn: api.listTeams });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["teams"] });

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">My Teams</h1>
          <p className="mt-1 text-sm text-muted">
            Attach a team to a meeting and only its members get auto-assigned tasks.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          New team
        </Button>
      </header>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-brand-500" />
          </div>
        ) : !teams || teams.length === 0 ? (
          <EmptyState
            icon={
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
              </svg>
            }
            title="No teams yet"
            hint="Create a team of people you meet with, then pick it when you record — task assignment will stick to those members."
            action={<Button onClick={() => setCreateOpen(true)}>Create your first team</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {teams.map((t) => (
              <Card key={t.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-ink">{t.name}</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {t.members.length} member{t.members.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => setEditing(t)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                      onClick={() => setDeleting(t)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex items-center">
                  {t.members.length === 0 ? (
                    <span className="text-sm text-slate-400">No members yet</span>
                  ) : (
                    <>
                      <div className="flex -space-x-2">
                        {t.members.slice(0, 6).map((m) => (
                          <span
                            key={m.id}
                            title={m.name}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 ring-2 ring-white"
                          >
                            {initials(m.name)}
                          </span>
                        ))}
                      </div>
                      {t.members.length > 6 && (
                        <span className="ml-2 text-xs font-medium text-muted">
                          +{t.members.length - 6} more
                        </span>
                      )}
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <TeamFormModal
        open={createOpen || !!editing}
        team={editing}
        onClose={() => {
          setCreateOpen(false);
          setEditing(null);
        }}
        onDone={invalidate}
      />
      <DeleteTeamModal team={deleting} onClose={() => setDeleting(null)} onDone={invalidate} />
    </div>
  );
}

function TeamFormModal({
  open,
  team,
  onClose,
  onDone,
}: {
  open: boolean;
  team: Team | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const { data: users } = useQuery({ queryKey: ["users"], queryFn: api.listUsers, enabled: open });

  // Re-initialize when the modal opens for a different target (create = "new").
  const target = team ? team.id : "new";
  if (open && loadedFor !== target) {
    setName(team?.name ?? "");
    setSelected(new Set(team?.members.map((m) => m.id) ?? []));
    setError(null);
    setLoadedFor(target);
  }

  function close() {
    setName("");
    setSelected(new Set());
    setError(null);
    setLoadedFor(null);
    onClose();
  }

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), memberIds: [...selected] };
      return team ? api.updateTeam(team.id, body) : api.createTeam(body);
    },
    onSuccess: () => {
      onDone();
      close();
    },
    onError: () => setError("Couldn't save the team. Check the members and try again."),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal open={open} onClose={close} title={team ? "Edit team" : "New team"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate();
        }}
        className="space-y-4"
      >
        <Field label="Team name" htmlFor="team-name">
          <Input
            id="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Product launch"
            required
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-medium text-slate-700">Members</span>
            <span className="text-xs text-muted">{selected.size} selected</span>
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {!users ? (
              <div className="flex justify-center py-6">
                <Spinner className="h-5 w-5 text-brand-500" />
              </div>
            ) : (
              users.map((u: User) => (
                <label
                  key={u.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
                    selected.has(u.id) ? "bg-brand-50" : "hover:bg-slate-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggle(u.id)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {initials(u.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{u.name}</span>
                    <span className="block truncate text-xs text-muted">{u.email}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!name.trim()}>
            {team ? "Save changes" : "Create team"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteTeamModal({
  team,
  onClose,
  onDone,
}: {
  team: Team | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function close() {
    setError(null);
    onClose();
  }

  const del = useMutation({
    mutationFn: () => api.deleteTeam(team!.id),
    onSuccess: () => {
      onDone();
      close();
    },
    onError: () => setError("Couldn't delete the team. Try again."),
  });

  return (
    <Modal open={!!team} onClose={close} title="Delete team?">
      <p className="text-sm text-slate-600">
        This deletes <span className="font-semibold text-ink">{team?.name}</span>. Past meetings
        keep their tasks and history — they just lose the team label.
      </p>
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button
          onClick={() => del.mutate()}
          loading={del.isPending}
          className="bg-red-600 text-white hover:bg-red-700"
        >
          Delete team
        </Button>
      </div>
    </Modal>
  );
}
