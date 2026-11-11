'use strict';
/* The only bridge between the UI and the system. The renderer has no Node.js access. */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  invoke: (channel, payload) => {
    if (typeof channel !== 'string' || !/^[a-z]+:[A-Za-z]+$/.test(channel)) return Promise.reject(new Error('Invalid channel'));
    return ipcRenderer.invoke('api', channel, payload);
  },
  on: (event, handler) => {
    if (!['menu', 'license'].includes(event)) return;
    ipcRenderer.on('event:' + event, (_e, data) => handler(data));
  },
});
