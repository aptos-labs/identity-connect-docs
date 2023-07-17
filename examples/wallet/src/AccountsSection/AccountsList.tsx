// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import './index.css';
import useAccounts from '../useAccounts.ts';
import AccountsListItem from './AccountsListItem.tsx';

export default function AccountsList() {
  const accounts = useAccounts().watch();
  return (
    <ul className="accounts-list">
      {Object.values(accounts).map((account) => (
        <AccountsListItem key={account.address} account={account} />
      ))}
    </ul>
  );
}
