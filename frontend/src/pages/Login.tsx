import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button, Field, Input } from "../components/ui";
import { ApiError } from "../lib/api";

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "INVALID_CREDENTIALS") setError("Wrong email or password.");
        else if (err.code === "ACCOUNT_DISABLED")
          setError("Your account has been deactivated. Contact your administrator.");
        else setError(err.message);
      } else {
        setError("Could not reach the server. Is the backend running?");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-700 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(60rem 60rem at 20% 10%, rgba(20,184,166,0.6), transparent), radial-gradient(40rem 40rem at 90% 90%, rgba(249,115,22,0.35), transparent)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v18M8 7v10M16 7v10M4 10v4M20 10v4" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-lg font-extrabold tracking-tight">MeetingListener</span>
        </div>
        <div className="relative">
          <h1 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">
            Every meeting, captured and understood.
          </h1>
          <p className="mt-4 max-w-md text-brand-100">
            Record a meeting and get a clean summary, the goal, and an itemized task list — with
            the right owner on every action.
          </p>
        </div>
        <div className="relative text-sm text-brand-200">Transcribe · Summarize · Assign · Notify</div>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm animate-fade-up">
          <h2 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h2>
          <p className="mt-1 text-sm text-muted">Sign in to your dashboard.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </Field>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
