import { useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { initials } from "../lib/format";
import { cn } from "./ui";
import { CommandPalette } from "./CommandPalette";
import { UpdateBanner } from "./UpdateBanner";

function LogoMark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg className="h-9 w-9" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="briefly-g" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#1D4ED8" />
            <stop offset="0.55" stopColor="#2563EB" />
            <stop offset="1" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
        <path fill="url(#briefly-g)" d="M116 84 H312 L428 200 V336 a48 48 0 0 1 -48 48 H236 L156 462 V384 h-40 a48 48 0 0 1 -48 -48 V132 a48 48 0 0 1 48 -48 Z" />
        <path fill="#93C5FD" d="M312 84 L428 200 H344 a32 32 0 0 1 -32 -32 Z" />
        <rect x="152" y="196" width="168" height="24" rx="12" fill="#EFF6FF" />
        <rect x="152" y="244" width="208" height="24" rx="12" fill="#DBEAFE" />
        <rect x="152" y="292" width="128" height="24" rx="12" fill="#BFDBFE" />
        <path fill="#7DD3FC" d="M448 34 l16 40 40 16 -40 16 -16 40 -16 -40 -40 -16 40 -16 Z" />
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-extrabold tracking-tight text-brand-900">Briefly</div>
        <div className="text-[11px] font-medium text-muted">Meetings, briefly.</div>
      </div>
    </div>
  );
}

function NavItem({
  to,
  end,
  label,
  badge,
  icon,
}: {
  to: string;
  end?: boolean;
  label: string;
  badge?: number;
  icon: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
          isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-ink",
        )
      }
    >
      <span className="h-5 w-5">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.listNotifications,
    refetchInterval: 15000,
  });
  const unread = notifications?.filter((n) => !n.read).length ?? 0;
  const [searchOpen, setSearchOpen] = useState(false);
  const isMac = navigator.platform.toUpperCase().includes("MAC");

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5">
        <div className="px-1">
          <LogoMark />
        </div>

        <button
          onClick={() => setSearchOpen(true)}
          className="mt-6 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-500"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>

        <nav className="mt-4 flex flex-col gap-1">
          <NavItem
            to="/"
            end
            label="Meetings"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 9h18M8 4v5" strokeLinecap="round" />
              </svg>
            }
          />
          <NavItem
            to="/teams"
            label="My Teams"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
              </svg>
            }
          />
          <NavItem
            to="/notifications"
            label="Notifications"
            badge={unread}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" />
              </svg>
            }
          />
          {user?.role === "admin" && (
            <NavItem
              to="/admin/users"
              label="User Management"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
                </svg>
              }
            />
          )}
        </nav>

        <div className="mt-auto border-t border-slate-200 pt-4">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {user ? initials(user.name) : "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">{user?.name}</div>
              <div className="truncate text-xs text-muted">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <UpdateBanner />
        <Outlet />
      </main>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
