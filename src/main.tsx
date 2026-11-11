// Order matters: record whether the browser has its own Web Bluetooth, then
// let the beacio polyfill give Safari on iPhone a navigator.bluetooth (it
// talks to the beacio Safari extension). Both run before any app code.
import './utils/printer/bluetoothProbe';
import '@beacio/core/auto';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);