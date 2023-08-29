// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppStateContextProvider } from './AppStateContext.ts';
import './index.css';
import { WalletClientContextProvider } from './WalletClientContext.ts';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppStateContextProvider>
      <WalletClientContextProvider>
        <App />
      </WalletClientContextProvider>
    </AppStateContextProvider>
  </React.StrictMode>,
);
