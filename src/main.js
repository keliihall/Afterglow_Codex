const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage, screen } = require("electron");
const path = require("node:path");
const { loadUsageSnapshot } = require("./usage");
const { loadConfig, saveConfig, CONFIG_FILE } = require("./usage/config");

const widgetWindows = new Map();
let tray;
let alwaysOnTop = true;
let refreshTimer;
let widgetsVisible = true;

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="9" fill="#151515"/>
      <circle cx="16" cy="16" r="8" fill="#f0b84d"/>
      <path d="M16 8a8 8 0 0 1 0 16 5.5 5.5 0 0 0 0-16Z" fill="#f8f8f4"/>
    </svg>`;
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  image.setTemplateImage(false);
  return image;
}

const WINDOW_WIDTH = 202;
const WINDOW_HEIGHT = 54;
const ALWAYS_ON_TOP_LEVEL = "screen-saver";
const ALL_SPACES_OPTIONS = {
  visibleOnFullScreen: true,
  skipTransformProcessType: true
};

function bottomRightBounds(display) {
  const bounds = display.workArea;
  return {
    x: Math.round(bounds.x + bounds.width - WINDOW_WIDTH - 28),
    y: Math.round(bounds.y + bounds.height - WINDOW_HEIGHT - 72)
  };
}

function positionBottomRight(win, display) {
  if (!win || win.isDestroyed()) return;
  const { x, y } = bottomRightBounds(display);
  win.setPosition(x, y, false);
}

function visibleWindows() {
  return Array.from(widgetWindows.values()).filter((win) => !win.isDestroyed());
}

function showAllWidgets() {
  widgetsVisible = true;
  for (const win of visibleWindows()) {
    win.show();
    win.moveTop();
  }
}

function hideAllWidgets() {
  widgetsVisible = false;
  for (const win of visibleWindows()) {
    win.hide();
  }
}

function setWidgetAlwaysOnTop(enabled) {
  alwaysOnTop = enabled;
  for (const win of visibleWindows()) {
    applyWindowSpaceBehavior(win);
  }
}

function applyWindowSpaceBehavior(win) {
  if (!win || win.isDestroyed()) return;
  win.setVisibleOnAllWorkspaces(true, ALL_SPACES_OPTIONS);
  win.setAlwaysOnTop(alwaysOnTop, alwaysOnTop ? ALWAYS_ON_TOP_LEVEL : "normal");
  win.setVisibleOnAllWorkspaces(true, ALL_SPACES_OPTIONS);
}

async function pushSnapshot() {
  const snapshot = await loadUsageSnapshot();
  for (const win of visibleWindows()) {
    win.webContents.send("usage:snapshot", snapshot);
  }
  updateTrayTitle(snapshot);
}

function updateTrayTitle(snapshot) {
  const codex = snapshot.providers.find((provider) => provider.id === "codex");
  const primary = codex?.windows?.find((window) => window.id === "5h");
  if (primary && Number.isFinite(primary.remainingPercent)) {
    tray?.setToolTip(`余晖 Afterglow  5h 剩余 ${Math.round(primary.remainingPercent)}%`);
    return;
  }
  tray?.setToolTip("余晖 Afterglow");
}

function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const config = loadConfig();
  const seconds = Math.max(5, Number(config.refreshSeconds) || 20);
  refreshTimer = setInterval(pushSnapshot, seconds * 1000);
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: "显示/隐藏",
      click: () => {
        const shouldHide = visibleWindows().some((win) => win.isVisible());
        if (shouldHide) {
          hideAllWidgets();
        } else {
          showAllWidgets();
        }
      }
    },
    { label: "立即刷新", click: pushSnapshot },
    {
      label: "窗口置顶",
      type: "checkbox",
      checked: alwaysOnTop,
      click: (item) => setWidgetAlwaysOnTop(item.checked)
    },
    {
      label: "开机启动",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
    },
    { type: "separator" },
    { label: "打开配置文件", click: () => shell.openPath(CONFIG_FILE) },
    { label: "退出", role: "quit" }
  ]);
}

function createWindow(display) {
  const { x, y } = bottomRightBounds(display);
  const win = new BrowserWindow({
    x,
    y,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  widgetWindows.set(display.id, win);
  applyWindowSpaceBehavior(win);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.once("ready-to-show", () => {
    positionBottomRight(win, display);
    if (widgetsVisible) {
      win.show();
      win.moveTop();
    }
    applyWindowSpaceBehavior(win);
    pushSnapshot();
  });
  win.on("closed", () => {
    widgetWindows.delete(display.id);
  });
}

function syncWindowsToDisplays() {
  const displays = screen.getAllDisplays();
  const displayIds = new Set(displays.map((display) => display.id));

  for (const [displayId, win] of widgetWindows.entries()) {
    if (!displayIds.has(displayId) && !win.isDestroyed()) {
      win.close();
      widgetWindows.delete(displayId);
    }
  }

  for (const display of displays) {
    const existing = widgetWindows.get(display.id);
    if (existing && !existing.isDestroyed()) {
      positionBottomRight(existing, display);
      if (widgetsVisible && !existing.isVisible()) {
        existing.show();
        existing.moveTop();
      }
      continue;
    }
    createWindow(display);
  }
}

app.whenReady().then(() => {
  app.setActivationPolicy("accessory");
  tray = new Tray(createTrayIcon());
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", () => {
    const shouldHide = visibleWindows().some((win) => win.isVisible());
    if (shouldHide) {
      hideAllWidgets();
    } else {
      showAllWidgets();
    }
  });

  syncWindowsToDisplays();
  screen.on("display-added", syncWindowsToDisplays);
  screen.on("display-removed", syncWindowsToDisplays);
  screen.on("display-metrics-changed", syncWindowsToDisplays);
  scheduleRefresh();
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("before-quit", () => {
  if (refreshTimer) clearInterval(refreshTimer);
});

ipcMain.handle("usage:get", loadUsageSnapshot);
ipcMain.handle("config:get", () => loadConfig());
ipcMain.handle("config:save", (_event, nextConfig) => {
  const saved = saveConfig(nextConfig);
  scheduleRefresh();
  pushSnapshot();
  return saved;
});
ipcMain.handle("config:open", () => shell.openPath(CONFIG_FILE));
ipcMain.handle("window:hide", () => hideAllWidgets());
ipcMain.handle("window:setAlwaysOnTop", (_event, enabled) => {
  setWidgetAlwaysOnTop(Boolean(enabled));
  tray?.setContextMenu(buildTrayMenu());
  return alwaysOnTop;
});
