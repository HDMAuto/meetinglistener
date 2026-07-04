import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/api";
import { Button, Field, Input } from "../components/ui";

// Full-screen gate shown after login while user.mustChangePassword is set.
// The user cannot reach the app until the change succeeds.
export function ForcePasswordChange() {
  const { user, logout, updateStoredUser } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      updateStoredUser({ mustChangePassword: false });
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") {
        setError("Current password is incorrect.");
      } else {
        setError("Could not change the password. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 018 0v3" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Set a new password</h1>
        <p className="mt-1 text-sm text-muted">
          Hi {user?.name.split(" ")[0]} — your password was set by an administrator. Choose your
          own to continue.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="Current (temporary) password" htmlFor="current">
            <Input
              id="current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" htmlFor="next">
            <Input
              id="next"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm">
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </Field>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Save new password
          </Button>
        </form>

        <button
          onClick={logout}
          className="mt-6 w-full cursor-pointer text-center text-sm font-medium text-muted hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
