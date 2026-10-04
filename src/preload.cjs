// The only things the game page can ask of the launcher: bring the window to the front, quit, and show a system notification (the launcher shows it itself
// and says whether the system accepted it, which a web page cannot reliably do in an installed app).
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("otakuDesktop", {
  show: () => ipcRenderer.send("desktop:show"),
  quit: () => ipcRenderer.send("desktop:quit"),
  notify: (title, body, id) => ipcRenderer.invoke("desktop:notify", { title: String(title), body: String(body), id: String(id || "") }),
  onNotificationClick: (cb) => {
    const handler = (_e, id) => cb(String(id));
    ipcRenderer.on("desktop:notification-click", handler);
    return () => ipcRenderer.removeListener("desktop:notification-click", handler);
  },
});
