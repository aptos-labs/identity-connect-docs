// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import './index.css';
import useAccounts from '../useAccounts.ts';
import AccountsList from './AccountsList.tsx';

export default function AccountsSection() {
  const accounts = useAccounts();

  const onGenerate = async () => {
    const newAccount = accounts.generate();
    accounts.add(newAccount);
  };

  return (
    <div>
      <h2>Accounts</h2>
      <AccountsList />
      <button type="button" onClick={onGenerate}>
        Generate
      </button>
    </div>
  );
}
