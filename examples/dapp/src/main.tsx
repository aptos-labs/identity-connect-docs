// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { Buffer as BufferPolyfill } from 'buffer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppStateContextProvider } from './AppStateContext.ts';
import { DappClientContextProvider } from './DappClientContext.ts';
import './index.css';

// Identity connect relies heavily on Buffer which is not available on browser
globalThis.Buffer = BufferPolyfill;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppStateContextProvider>
      <DappClientContextProvider>
        <App />
      </DappClientContextProvider>
    </AppStateContextProvider>
  </React.StrictMode>,
);
