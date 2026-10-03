// The only things the game page can ask of the launcher: bring the window to the front (a clicked notification) and quit.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("otakuDesktop", { show: () => ipcRenderer.send("desktop:show"), quit: () => ipcRenderer.send("desktop:quit") });
