// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import './index.css';
import { WalletAccount } from '../AppStateContext.ts';
import useAccounts from '../useAccounts.ts';

export interface AccountsListItemProps {
  account: WalletAccount;
}

export default function AccountsListItem({ account }: AccountsListItemProps) {
  const accounts = useAccounts();

  const collapsedAddress = account.address.slice(0, 18);

  const onRemove = () => {
    accounts.remove(account.address);
  };

  return (
    <li className="accounts-list-item">
      <span>{collapsedAddress}</span>
      <button className="btn-small" type="button" onClick={onRemove}>
        x
      </button>
    </li>
  );
}
