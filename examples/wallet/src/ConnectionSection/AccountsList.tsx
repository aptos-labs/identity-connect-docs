// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable jsx-a11y/label-has-associated-control */

import { AccountConnectionAction, KeyTypes, makeEd25519SecretKeySignCallback, toKey } from '@identity-connect/crypto';
import { createWalletAccountConnectInfo, WalletAccountConnectInfo } from '@identity-connect/wallet-sdk';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import useAccounts from '../useAccounts.ts';
import AccountsListItem from './AccountsListItem.tsx';
import './index.css';

const defaultInitialConnectedAddresses = new Set<string>();

export interface AccountsListHandle {
  getActionRequests: () => WalletAccountConnectInfo[];
}

export interface AccountsListProps {
  initialConnectedAddresses?: Set<string>;
  walletId: string;
}

const AccountsList = forwardRef<AccountsListHandle, AccountsListProps>(
  ({ initialConnectedAddresses = defaultInitialConnectedAddresses, walletId }, ref) => {
    const accounts = useAccounts().watch();
    const actionRequestCache = useRef<{ [address: string]: WalletAccountConnectInfo }>({});
    const [connectedAddresses, setConnectedAddresses] = useState(initialConnectedAddresses);

    useImperativeHandle(ref, () => ({
      getActionRequests: () =>
        Object.entries(actionRequestCache.current)
          .filter(([address]) => initialConnectedAddresses.has(address) !== connectedAddresses.has(address))
          .map(([_, value]) => value),
    }));

    useEffect(() => {
      actionRequestCache.current = {};
    }, [initialConnectedAddresses, walletId]);

    const onAccountToggle = useCallback(
      async (address: string, shouldBeConnected: boolean) => {
        if (!(address in actionRequestCache.current)) {
          const wasConnected = initialConnectedAddresses.has(address);
          const action = wasConnected ? AccountConnectionAction.REMOVE : AccountConnectionAction.ADD;
          const account = accounts[address];
          const secretKeyBytes = Buffer.from(account.secretKeyB64, 'base64');
          const publicKeyBytes = Buffer.from(account.publicKeyB64, 'base64');

          const signCallback = makeEd25519SecretKeySignCallback(toKey(secretKeyBytes, KeyTypes.Ed25519SecretKey));
          actionRequestCache.current[address] = await createWalletAccountConnectInfo(
            signCallback,
            toKey(publicKeyBytes, KeyTypes.Ed25519PublicKey),
            action,
            walletId,
          );
        }
        setConnectedAddresses((prevValue) => {
          const newValue = new Set(prevValue);
          if (shouldBeConnected) {
            newValue.add(address);
          } else {
            newValue.delete(address);
          }
          return newValue;
        });
      },
      [accounts, initialConnectedAddresses, walletId],
    );

    return (
      <ul className="accounts-list">
        {Object.values(accounts).map((account) => (
          <AccountsListItem
            key={account.address}
            account={account}
            isConnected={connectedAddresses.has(account.address)}
            onChange={onAccountToggle}
          />
        ))}
      </ul>
    );
  },
);

export default AccountsList;
