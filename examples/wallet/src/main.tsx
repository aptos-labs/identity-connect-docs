// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { Buffer as BufferPolyfill } from 'buffer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppStateContextProvider } from './AppStateContext.ts';
import './index.css';
import { WalletClientContextProvider } from './WalletClientContext.ts';

globalThis.Buffer = BufferPolyfill;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppStateContextProvider>
      <WalletClientContextProvider>
        <App />
      </WalletClientContextProvider>
    </AppStateContextProvider>
  </React.StrictMode>,
);
