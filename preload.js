const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Child process management
  triggerChildProcess: () => ipcRenderer.invoke("trigger-child-process"),

  // Screenshot functionality
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  
  // Listen for child process output
  onChildProcessOutput: (callback) => {
    ipcRenderer.on("child-process-output", (event, data) => callback(data));
  },

  // Overlay content updates
  onOverlaySetContent: (callback) => {
    ipcRenderer.on("overlay-set-content", (_event, payload) =>
      callback(payload)
    );
  },
  
  // Platform information
  platform: process.platform,

  // App information
  appVersion: process.env.npm_package_version || "1.0.0",
});
