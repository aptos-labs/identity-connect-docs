// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import './App.css';
import AccountsSection from './AccountsSection';
import ConnectionSection from './ConnectionSection';
import PromptSection from './PromptSection';

function App() {
  return (
    <>
      <h1>Example Wallet</h1>
      <div className="layout">
        <div className="card">
          <AccountsSection />
        </div>
        <div className="card">
          <ConnectionSection />
        </div>
        <div className="card">
          <PromptSection />
        </div>
      </div>
    </>
  );
}

export default App;
