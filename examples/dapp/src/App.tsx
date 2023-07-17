// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import AccountsSection from './AccountsSection';
import NewRequestSection from './NewRequestSection';
import './App.css';

export default function App() {
  return (
    <>
      <h1>Example Dapp</h1>
      <div className="layout">
        <div className="card">
          <AccountsSection />
        </div>
        <div className="card">
          <NewRequestSection />
        </div>
      </div>
    </>
  );
}
