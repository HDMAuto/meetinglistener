import { Router } from "express";
import express from "express";
import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../config/env.js";

export const downloadRouter = Router();
const dir = resolve(env.DOWNLOADS_DIR);

function humanSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(0)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function platformFor(name: string): { os: string; note: string } {
  const lower = name.toLowerCase();
  if (lower.endsWith(".dmg")) {
    return {
      os: "macOS",
      note: "First open: right-click the app → Open (it's not yet notarized).",
    };
  }
  if (lower.endsWith(".exe")) {
    return {
      os: "Windows",
      note: "If SmartScreen warns: More info → Run anyway (not yet code-signed).",
    };
  }
  return { os: "File", note: "" };
}

function page(files: { name: string; size: number }[]): string {
  const rows = files
    .map((f) => {
      const p = platformFor(f.name);
      return `
      <a class="card" href="/download/${encodeURIComponent(f.name)}" download>
        <div class="row">
          <div>
            <div class="os">${p.os}</div>
            <div class="fname">${f.name}</div>
            ${p.note ? `<div class="note">${p.note}</div>` : ""}
          </div>
          <div class="dl">
            <span class="size">${humanSize(f.size)}</span>
            <span class="btn">Download</span>
          </div>
        </div>
      </a>`;
    })
    .join("");

  const empty = `<p class="empty">No installers are available yet.</p>`;

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Download Briefly</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; background:#F8FAFC; color:#0F172A;
         font-family:'Plus Jakarta Sans',system-ui,sans-serif;
         display:flex; align-items:center; justify-content:center; padding:32px; }
  .wrap { width:100%; max-width:560px; }
  .hero { background:#0B1533; border-radius:20px; padding:28px 24px; margin-bottom:28px;
          background-image:radial-gradient(24rem 16rem at 25% 20%, rgba(56,189,248,.35), transparent),
                           radial-gradient(30rem 20rem at 80% 90%, rgba(37,99,235,.3), transparent); }
  .brand { display:flex; align-items:center; gap:12px; }
  .logo { width:44px; height:44px; }
  .title { font-weight:800; font-size:22px; letter-spacing:-0.02em; color:#fff; }
  .tag { color:#93C5FD; font-size:14px; margin:10px 0 0; }
  h1 { font-size:26px; font-weight:800; letter-spacing:-0.02em; margin:0 0 4px; }
  .sub { color:#64748B; font-size:15px; margin:0 0 24px; }
  .card { display:block; text-decoration:none; color:inherit; background:#fff;
          border:1px solid #E2E8F0; border-radius:16px; padding:18px 20px; margin-bottom:12px;
          box-shadow:0 1px 2px rgba(15,23,42,.04),0 6px 20px rgba(15,23,42,.06);
          transition:transform .15s ease, box-shadow .15s ease; }
  .card:hover { transform:translateY(-1px); box-shadow:0 10px 30px rgba(15,23,42,.12); }
  .row { display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .os { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#2563EB; }
  .fname { font-size:15px; font-weight:600; margin-top:2px; word-break:break-all; }
  .note { font-size:12px; color:#64748B; margin-top:6px; }
  .dl { text-align:right; white-space:nowrap; }
  .size { display:block; font-size:12px; color:#94A3B8; margin-bottom:6px; }
  .btn { display:inline-block; background:#2563EB; color:#fff; font-weight:600; font-size:14px;
         padding:8px 16px; border-radius:10px; }
  .empty { color:#64748B; }
  .foot { margin-top:20px; font-size:12px; color:#94A3B8; text-align:center; }
</style></head><body>
  <div class="wrap">
    <div class="hero">
      <div class="brand">
        <svg class="logo" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="briefly-g" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stop-color="#1D4ED8"/><stop offset="0.55" stop-color="#2563EB"/><stop offset="1" stop-color="#38BDF8"/></linearGradient></defs>
          <path fill="url(#briefly-g)" d="M116 84 H312 L428 200 V336 a48 48 0 0 1 -48 48 H236 L156 462 V384 h-40 a48 48 0 0 1 -48 -48 V132 a48 48 0 0 1 48 -48 Z"/>
          <path fill="#93C5FD" d="M312 84 L428 200 H344 a32 32 0 0 1 -32 -32 Z"/>
          <rect x="152" y="196" width="168" height="24" rx="12" fill="#EFF6FF"/>
          <rect x="152" y="244" width="208" height="24" rx="12" fill="#DBEAFE"/>
          <rect x="152" y="292" width="128" height="24" rx="12" fill="#BFDBFE"/>
          <path fill="#7DD3FC" d="M448 34 l16 40 40 16 -40 16 -16 40 -16 -40 -40 -16 40 -16 Z"/>
        </svg>
        <span class="title">Briefly</span>
      </div>
      <p class="tag">Meetings, briefly.</p>
    </div>
    <h1>Download the app</h1>
    <p class="sub">Install Briefly on your Mac or Windows PC.</p>
    ${files.length ? rows : empty}
    <p class="foot">Internal build · connects to meetings-api.hdmauto.app</p>
  </div>
</body></html>`;
}

downloadRouter.get("/", (_req, res) => {
  let files: { name: string; size: number }[] = [];
  try {
    files = readdirSync(dir)
      .filter((f) => !f.startsWith(".") && !f.endsWith(".blockmap"))
      .map((f) => ({ name: f, size: statSync(resolve(dir, f)).size }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    // downloads dir may not exist yet — render the empty state.
  }
  res.type("html").send(page(files));
});

// Serve the actual installer files (express.static guards against path traversal).
downloadRouter.use(express.static(dir));
