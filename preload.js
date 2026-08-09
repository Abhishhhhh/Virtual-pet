// preload.js — exposes a tiny, safe bridge from main -> the pet renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  onInit: (cb) => ipcRenderer.on('init', (_e, data) => cb(data)),
  onCursor: (cb) => ipcRenderer.on('cursor', (_e, point) => cb(point)),
  onCommand: (cb) => ipcRenderer.on('command', (_e, cmd) => cb(cmd)),
  onRenamed: (cb) => ipcRenderer.on('renamed', (_e, name) => cb(name)),
});
