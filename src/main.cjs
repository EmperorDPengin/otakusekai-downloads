// OtakuSekai desktop app (Windows, macOS, Linux).
// This is a LAUNCHER: it opens the live game, so every game update reaches players the moment you deploy it, with nothing to download.
// The only thing that is ever installed again is this small launcher, and only when it becomes too old: at start-up it asks the server which launcher
// version is still allowed (/desktop-version) and, if this one is older, shows an "update needed" screen with a download button.
const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const DEV = process.argv.includes("--dev");
// A shipped copy only ever opens the real game over https; the override and plain http are for a dev run (--dev) only.
const PROD_URL = "https://play.otakuswonderland.com";
const GAME_URL = DEV ? process.env.OTAKU_URL || "http://localhost:5173" : PROD_URL;
const GAME_ORIGIN = new URL(GAME_URL).origin;

app.setName("OtakuSekai");

// --- remember the window between runs (a tiny json file, no extra package) ---
const stateFile = path.join(app.getPath("userData"), "window.json");
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return {};
  }
}
function saveState(win) {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile, JSON.stringify({ ...b, maximized: win.isMaximized(), fullscreen: win.isFullScreen() }));
  } catch {
    /* not worth stopping the game over */
  }
}

/** "0.31.0" -> [0,31,0] */
const parts = (v) => String(v).split(".").map((n) => parseInt(n, 10) || 0);
function older(a, b) {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0);
  }
  return false;
}

/** Asks the server whether this launcher is still allowed. Any failure (offline, slow) lets the game open normally. */
async function updateNeeded() {
  if (DEV) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(`${PROD_URL}/desktop-version`, { signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = await res.json();
    if (typeof j.minimum === "string" && older(app.getVersion(), j.minimum)) return { download: typeof j.download === "string" ? j.download : `${PROD_URL}/download` };
    return null;
  } catch {
    return null;
  }
}

let win = null;

async function createWindow() {
  const s = loadState();
  win = new BrowserWindow({
    width: s.width || 1280,
    height: s.height || 800,
    x: s.x,
    y: s.y,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: "#070d14",
    title: "OtakuSekai",
    icon: path.join(__dirname, "..", "resources", "icon.png"),
    show: false,
    autoHideMenuBar: true,
    fullscreenable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: DEV,
    },
  });
  Menu.setApplicationMenu(null);
  if (s.maximized) win.maximize();
  if (s.fullscreen) win.setFullScreen(true);
  win.once("ready-to-show", () => win.show());

  // Nothing the page asks for (camera, microphone, location ...) is granted, except what a card game needs: fullscreen and notifications.
  win.webContents.session.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === "fullscreen" || permission === "notifications"));
  win.webContents.session.setPermissionCheckHandler((_wc, permission) => permission === "fullscreen" || permission === "notifications");
  win.webContents.on("will-attach-webview", (e) => e.preventDefault());

  // The game's own address stays in the window; anything else (a survey link from an inbox message, say) opens in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(GAME_ORIGIN) && !url.startsWith("file://")) {
      e.preventDefault();
      openExternalSafe(url);
    }
  });
  win.webContents.on("did-fail-load", (_e, code, _desc, failedUrl, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = a navigation cancelled on purpose
    win.loadFile(path.join(__dirname, "offline.html"), { query: { retry: failedUrl } });
  });

  // F11 / Alt+Enter: fullscreen. Ctrl+R: reload. F12: dev tools (dev run only).
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11" || (input.alt && input.key === "Enter")) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (input.control && input.key.toLowerCase() === "r") {
      win.webContents.reload();
      e.preventDefault();
    } else if (DEV && input.key === "F12") {
      win.webContents.toggleDevTools();
    }
  });

  win.on("close", () => saveState(win));
  win.on("closed", () => (win = null));

  const old = await updateNeeded();
  if (old) win.loadFile(path.join(__dirname, "update.html"), { query: { download: old.download } });
  else win.loadURL(GAME_URL);
}

function openExternalSafe(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:") shell.openExternal(url);
  } catch {
    /* ignore malformed links */
  }
}

// one running copy; a second launch just brings the first forward
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    void createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

process.on("uncaughtException", (err) => {
  try {
    dialog.showErrorBox("OtakuSekai", String(err && err.message ? err.message : err));
  } catch {
    /* nothing more to do */
  }
});
