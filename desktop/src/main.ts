import { app, BrowserWindow, session, shell, systemPreferences } from "electron";
import path from "node:path";

// In dev we point at the Vite dev server; packaged builds load the bundled renderer.
const DEV_URL = process.env.ELECTRON_START_URL;
const SMOKE = !!process.env.SMOKE_TEST;

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "Briefly",
    backgroundColor: "#f8fafc",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  // External links open in the system browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (SMOKE) {
    let renderErrors = 0;
    win.webContents.on("console-message", (_e, level, message) => {
      if (level >= 3) {
        renderErrors += 1;
        console.error("SMOKE_RENDER_ERROR", message);
      }
    });
    win.webContents.on("did-finish-load", async () => {
      if (win.webContents.getURL().startsWith("data:")) return; // dev waiting page
      // Poll up to 20s for React to mount (cold dev servers compile on demand).
      let mounted = false;
      for (let i = 0; i < 40 && !mounted; i++) {
        await new Promise((r) => setTimeout(r, 500));
        mounted = await win.webContents.executeJavaScript(
          "!!document.querySelector('#root')?.children.length",
        );
      }
      console.log(
        mounted && renderErrors === 0 ? "SMOKE_OK" : "SMOKE_FAIL",
        win.webContents.getURL(),
        `mounted=${mounted} errors=${renderErrors}`,
      );
      app.exit(mounted && renderErrors === 0 ? 0 : 1);
    });
  }

  if (DEV_URL) {
    await loadDevUrlWithRetry(win, DEV_URL);
  } else {
    await win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }
}

// In dev the Vite server may not be up yet (or may restart) — show a small
// waiting page and keep retrying instead of dying with ERR_CONNECTION_REFUSED.
async function loadDevUrlWithRetry(win: BrowserWindow, url: string): Promise<void> {
  const waitingPage =
    "data:text/html;charset=utf-8," +
    encodeURIComponent(
      `<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;background:#f8fafc;color:#334155">
        <div style="text-align:center">
          <div style="font-size:15px;font-weight:600">Waiting for the dev server…</div>
          <div style="margin-top:6px;font-size:13px;color:#64748b">Start it with <code>npm run frontend</code> (repo root). Retrying automatically.</div>
        </div>
      </body>`,
    );

  for (let attempt = 1; !win.isDestroyed(); attempt++) {
    try {
      await win.loadURL(url);
      return;
    } catch {
      if (attempt === 1) {
        console.log(`Dev server not reachable at ${url} — waiting for it to start…`);
        await win.loadURL(waitingPage).catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

app.whenReady().then(async () => {
  // Packaged builds get the bundle icon; in dev, set the Dock icon manually.
  if (process.platform === "darwin" && DEV_URL) {
    const devIcon = path.join(__dirname, "..", "build", "icon.png");
    try {
      app.dock?.setIcon(devIcon);
    } catch {
      /* icon is cosmetic — never block startup on it */
    }
  }

  // Ask macOS for mic access up front so in-app recording just works.
  if (process.platform === "darwin" && !SMOKE) {
    await systemPreferences.askForMediaAccess("microphone").catch(() => {});
  }

  // Grant getUserMedia (mic) to our own renderer; deny everything else.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media");
  });

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || SMOKE) app.quit();
});
