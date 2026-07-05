import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type { ManagedUser, Role } from "../lib/types";
import { useAuth } from "../auth/AuthContext";
import { initials } from "../lib/format";
import { Button, Card, Field, Input, Modal, Spinner, cn } from "../components/ui";

function generateTempPassword(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  // base36-ish, always >= 12 chars, no confusing symbols
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

function RoleChip({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        role === "admin"
          ? "bg-brand-50 text-brand-700 ring-brand-200"
          : "bg-slate-50 text-slate-600 ring-slate-200",
      )}
    >
      {role === "admin" ? "Admin" : "Member"}
    </span>
  );
}

function TempPasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Field label="Temporary password" htmlFor="temp">
      <div className="flex gap-2">
        <Input
          id="temp"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={6}
          autoComplete="off"
        />
        <Button type="button" variant="outline" onClick={() => onChange(generateTempPassword())}>
          Generate
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!value}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Share it with them directly — they'll be asked to change it on first sign-in.
      </p>
    </Field>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "EMAIL_TAKEN") return "That email is already registered.";
    if (err.code === "LAST_ADMIN") return "You can't remove the last active admin.";
    return err.message;
  }
  return "Something went wrong. Try again.";
}

export function UserManagement() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<ManagedUser | null>(null);

  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ["allUsers"],
    queryFn: api.listAllUsers,
    enabled: me?.role === "admin",
  });

  if (me?.role !== "admin") return <Navigate to="/" replace />;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["allUsers"] });
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">User Management</h1>
          <p className="mt-1 text-sm text-muted">
            {users?.length ?? 0} account{(users?.length ?? 0) === 1 ? "" : "s"} · admins can add,
            edit, and deactivate users
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Add user
        </Button>
      </header>

      <Card className="mt-6 overflow-hidden">
        {isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm text-muted">Couldn't load users.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-brand-500" />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3 font-bold">User</th>
                <th className="px-5 py-3 font-bold">Role</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className={cn("border-b border-slate-100", !u.isActive && "opacity-60")}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink">
                          {u.name}
                          {u.id === me?.id && <span className="ml-1.5 text-xs font-medium text-muted">(you)</span>}
                        </div>
                        <div className="truncate text-xs text-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <RoleChip role={u.role} />
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-semibold",
                        u.isActive ? "text-emerald-700" : "text-slate-500",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          u.isActive ? "bg-emerald-500" : "bg-slate-400",
                        )}
                      />
                      {u.isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {new Date(u.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => setEditing(u)}>
                        Edit
                      </Button>
                      <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => setResetting(u)}>
                        Reset password
                      </Button>
                      <Button
                        variant="ghost"
                        className={cn("px-2.5 py-1.5 text-xs", u.isActive ? "text-red-600 hover:bg-red-50" : "text-brand-600")}
                        onClick={() => setConfirmToggle(u)}
                      >
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onDone={invalidate} />
      <EditUserModal user={editing} onClose={() => setEditing(null)} onDone={invalidate} />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} onDone={invalidate} />
      <ToggleActiveModal user={confirmToggle} onClose={() => setConfirmToggle(null)} onDone={invalidate} />
    </div>
  );
}

function AddUserModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setName("");
    setEmail("");
    setRole("member");
    setTempPassword("");
    setError(null);
    onClose();
  };

  const create = useMutation({
    mutationFn: () => api.createUser({ name, email, role, tempPassword }),
    onSuccess: () => {
      onDone();
      close();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Modal open={open} onClose={close} title="Add user">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-4"
      >
        <Field label="Name" htmlFor="nu-name">
          <Input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Email" htmlFor="nu-email">
          <Input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <RoleSelect value={role} onChange={setRole} />
        <TempPasswordField value={tempPassword} onChange={setTempPassword} />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create user
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RoleSelect({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <Field label="Role" htmlFor="role-select">
      <div className="flex gap-2" id="role-select">
        {(["member", "admin"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={cn(
              "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
              value === r
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-50",
            )}
          >
            {r === "admin" ? "Admin" : "Member"}
          </button>
        ))}
      </div>
    </Field>
  );
}

function EditUserModal({
  user,
  onClose,
  onDone,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (user && loadedFor !== user.id) {
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setError(null);
    setLoadedFor(user.id);
  }

  const close = () => {
    setError(null);
    setLoadedFor(null);
    onClose();
  };

  const update = useMutation({
    mutationFn: () => api.updateUser(user!.id, { name, email, role }),
    onSuccess: () => {
      onDone();
      close();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Modal open={!!user} onClose={close} title="Edit user">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate();
        }}
        className="space-y-4"
      >
        <Field label="Name" htmlFor="eu-name">
          <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Email" htmlFor="eu-email">
          <Input id="eu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <RoleSelect value={role} onChange={setRole} />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={update.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onDone,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setTempPassword("");
    setError(null);
    onClose();
  };

  const reset = useMutation({
    mutationFn: () => api.resetUserPassword(user!.id, tempPassword),
    onSuccess: () => {
      onDone();
      close();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Modal open={!!user} onClose={close} title={`Reset password — ${user?.name ?? ""}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          reset.mutate();
        }}
        className="space-y-4"
      >
        <p className="text-sm text-muted">
          They'll sign in with this temporary password and be asked to choose a new one.
        </p>
        <TempPasswordField value={tempPassword} onChange={setTempPassword} />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={reset.isPending}>
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ToggleActiveModal({
  user,
  onClose,
  onDone,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const deactivating = user?.isActive ?? false;

  const close = () => {
    setError(null);
    onClose();
  };

  const toggle = useMutation({
    mutationFn: () =>
      deactivating ? api.deactivateUser(user!.id) : api.reactivateUser(user!.id),
    onSuccess: () => {
      onDone();
      close();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Modal
      open={!!user}
      onClose={close}
      title={deactivating ? "Deactivate user?" : "Reactivate user?"}
    >
      <p className="text-sm text-muted">
        {deactivating
          ? `${user?.name} will immediately lose access and disappear from assignee pickers. Their meetings and task history stay intact. You can reactivate them anytime.`
          : `${user?.name} will be able to sign in again and appear in assignee pickers.`}
      </p>
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button
          variant={deactivating ? "accent" : "primary"}
          loading={toggle.isPending}
          onClick={() => toggle.mutate()}
        >
          {deactivating ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
    </Modal>
  );
}
