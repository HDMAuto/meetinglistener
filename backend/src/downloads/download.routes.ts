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
<title>Download MeetingListener</title>
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
  .brand { display:flex; align-items:center; gap:12px; margin-bottom:28px; }
  .logo { width:44px; height:44px; }
  .title { font-weight:800; font-size:20px; letter-spacing:-0.02em; }
  .title .l { color:#0D9488; }
  h1 { font-size:26px; font-weight:800; letter-spacing:-0.02em; margin:0 0 4px; }
  .sub { color:#64748B; font-size:15px; margin:0 0 24px; }
  .card { display:block; text-decoration:none; color:inherit; background:#fff;
          border:1px solid #E2E8F0; border-radius:16px; padding:18px 20px; margin-bottom:12px;
          box-shadow:0 1px 2px rgba(15,23,42,.04),0 6px 20px rgba(15,23,42,.06);
          transition:transform .15s ease, box-shadow .15s ease; }
  .card:hover { transform:translateY(-1px); box-shadow:0 10px 30px rgba(15,23,42,.12); }
  .row { display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .os { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#0D9488; }
  .fname { font-size:15px; font-weight:600; margin-top:2px; word-break:break-all; }
  .note { font-size:12px; color:#64748B; margin-top:6px; }
  .dl { text-align:right; white-space:nowrap; }
  .size { display:block; font-size:12px; color:#94A3B8; margin-bottom:6px; }
  .btn { display:inline-block; background:#0D9488; color:#fff; font-weight:600; font-size:14px;
         padding:8px 16px; border-radius:10px; }
  .empty { color:#64748B; }
  .foot { margin-top:20px; font-size:12px; color:#94A3B8; text-align:center; }
</style></head><body>
  <div class="wrap">
    <div class="brand">
      <svg class="logo" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#1E88E5"/><stop offset="1" stop-color="#2BD9BD"/></linearGradient></defs>
        <g transform="translate(0 108)">
          <path d="M 179.4 399.3 A 340 340 0 0 1 844.6 399.3" fill="none" stroke="url(#g)" stroke-width="46" stroke-linecap="round"/>
          <rect x="140" y="390" width="95" height="160" rx="40" fill="#1E88E5"/>
          <rect x="789" y="390" width="95" height="160" rx="40" fill="#2BD9BD"/>
          <polygon points="303.6,567.2 380.1,658.4 266.8,690.8" fill="#1E88E5"/>
          <circle cx="512" cy="470" r="210" fill="none" stroke="url(#g)" stroke-width="42"/>
          <g fill="url(#g)"><rect x="358" y="452" width="20" height="36" rx="10"/><rect x="394" y="435" width="20" height="70" rx="10"/><rect x="430" y="410" width="20" height="120" rx="10"/><rect x="466" y="380" width="20" height="180" rx="10"/><rect x="502" y="355" width="20" height="230" rx="10"/><rect x="538" y="380" width="20" height="180" rx="10"/><rect x="574" y="410" width="20" height="120" rx="10"/><rect x="610" y="435" width="20" height="70" rx="10"/><rect x="646" y="452" width="20" height="36" rx="10"/></g>
        </g>
      </svg>
      <span class="title">Meeting<span class="l">Listener</span></span>
    </div>
    <h1>Download the app</h1>
    <p class="sub">Install MeetingListener on your Mac or Windows PC.</p>
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
