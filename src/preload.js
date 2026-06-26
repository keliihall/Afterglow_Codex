const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("usageWidget", {
  getUsage: () => ipcRenderer.invoke("usage:get"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  openConfig: () => ipcRenderer.invoke("config:open"),
  hideWindow: () => ipcRenderer.invoke("window:hide"),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke("window:setAlwaysOnTop", enabled),
  onSnapshot: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("usage:snapshot", listener);
    return () => ipcRenderer.removeListener("usage:snapshot", listener);
  }
});
