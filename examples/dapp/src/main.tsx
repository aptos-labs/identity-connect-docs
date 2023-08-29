// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppStateContextProvider } from './AppStateContext.ts';
import { DappClientContextProvider } from './DappClientContext.ts';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppStateContextProvider>
      <DappClientContextProvider>
        <App />
      </DappClientContextProvider>
    </AppStateContextProvider>
  </React.StrictMode>,
);
