import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { isNewerVersion } from "../lib/version";

const DISMISS_KEY = "briefly_dismissed_version";
const FORCE_KEY = "briefly_force_update_banner";
const FOUR_HOURS = 4 * 60 * 60 * 1000;

// Only the Electron app can install updates; the web/dev instance never nags.
// The FORCE override exists so the banner can be exercised in browser previews.
const isDesktop =
  window.location.protocol === "file:" || localStorage.getItem(FORCE_KEY) === "1";

export function UpdateBanner() {
  const [dismissed, setDismissed] = useState<string | null>(
    localStorage.getItem(DISMISS_KEY),
  );

  const { data } = useQuery({
    queryKey: ["appVersion"],
    queryFn: api.getLatestVersion,
    enabled: isDesktop,
    refetchInterval: FOUR_HOURS,
    staleTime: FOUR_HOURS,
  });

  const latest = data?.latest ?? null;
  if (!isDesktop || !latest) return null;
  if (!isNewerVersion(latest, __APP_VERSION__)) return null;
  if (latest === dismissed) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, latest!);
    setDismissed(latest);
  }

  return (
    <div className="flex items-center gap-3 border-b border-brand-200 bg-brand-50 px-4 py-2 text-sm">
      <svg
        className="h-4 w-4 shrink-0 text-brand-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 3v12M7 10l5 5 5-5M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="flex-1 font-medium text-brand-900">
        Briefly {latest} is available.
      </span>
      <a
        href="https://meetings-api.hdmauto.app/download"
        target="_blank"
        rel="noreferrer"
        className="rounded-lg bg-brand-600 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Download
      </a>
      <button
        onClick={dismiss}
        aria-label="Dismiss update notice"
        className="cursor-pointer rounded p-1 text-brand-700 transition-colors hover:bg-brand-100"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
