// preload-rename.js — bridge for the small "rename your pet" dialog window.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('renameAPI', {
  submit: (name) => ipcRenderer.send('rename-submit', name),
  cancel: () => ipcRenderer.send('rename-cancel'),
});
