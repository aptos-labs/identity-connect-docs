// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { memo, useRef } from 'react';
import './index.css';
import { WalletAccount } from '../AppStateContext.ts';

export interface AccountsListItemProps {
  account: WalletAccount;
  isConnected: boolean;
  onChange: (address: string, shouldBeConnected: boolean) => void;
}

const AccountsListItem = memo(({ account, isConnected, onChange }: AccountsListItemProps) => {
  const collapsedAddress = account.address.slice(0, 18);

  const inputRef = useRef<HTMLInputElement>(null);
  const onCheckboxChange = () => {
    if (inputRef.current) {
      onChange(account.address, inputRef.current.checked);
    }
  };

  return (
    <li className="accounts-list-item">
      <span>{collapsedAddress}</span>
      <input ref={inputRef} type="checkbox" checked={isConnected} onChange={onCheckboxChange} />
    </li>
  );
});

export default AccountsListItem;
