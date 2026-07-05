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
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(60rem 60rem at 20% 10%, rgba(56,189,248,0.5), transparent), radial-gradient(40rem 40rem at 90% 90%, rgba(37,99,235,0.45), transparent)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <svg className="h-6 w-6" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="briefly-g-login" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" stopColor="#1D4ED8" />
                  <stop offset="0.55" stopColor="#2563EB" />
                  <stop offset="1" stopColor="#38BDF8" />
                </linearGradient>
              </defs>
              <path fill="url(#briefly-g-login)" d="M116 84 H312 L428 200 V336 a48 48 0 0 1 -48 48 H236 L156 462 V384 h-40 a48 48 0 0 1 -48 -48 V132 a48 48 0 0 1 48 -48 Z" />
              <path fill="#93C5FD" d="M312 84 L428 200 H344 a32 32 0 0 1 -32 -32 Z" />
              <rect x="152" y="196" width="168" height="24" rx="12" fill="#EFF6FF" />
              <rect x="152" y="244" width="208" height="24" rx="12" fill="#DBEAFE" />
              <rect x="152" y="292" width="128" height="24" rx="12" fill="#BFDBFE" />
              <path fill="#7DD3FC" d="M448 34 l16 40 40 16 -40 16 -16 40 -16 -40 -40 -16 40 -16 Z" />
            </svg>
          </div>
          <span className="text-lg font-extrabold tracking-tight">Briefly</span>
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
