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
    title: "MeetingListener",
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
      // Give React a beat to mount, then check the app actually rendered.
      await new Promise((r) => setTimeout(r, 1500));
      const mounted = await win.webContents.executeJavaScript(
        "!!document.querySelector('#root')?.children.length",
      );
      console.log(
        mounted && renderErrors === 0 ? "SMOKE_OK" : "SMOKE_FAIL",
        win.webContents.getURL(),
        `mounted=${mounted} errors=${renderErrors}`,
      );
      app.exit(mounted && renderErrors === 0 ? 0 : 1);
    });
  }

  if (DEV_URL) {
    await win.loadURL(DEV_URL);
  } else {
    await win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }
}

app.whenReady().then(async () => {
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
