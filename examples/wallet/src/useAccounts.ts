// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { encodeBase64 } from '@identity-connect/crypto';
import { AptosAccount } from 'aptos';
import { useAppState, WalletAccount } from './AppStateContext.ts';

export default function useAccounts() {
  const appState = useAppState();

  function get() {
    return appState.get('accounts');
  }

  function watch() {
    return appState.watch('accounts');
  }

  function generate(): WalletAccount {
    const account = new AptosAccount();
    const address = account.address().hex();
    const publicKeyB64 = encodeBase64(account.signingKey.publicKey);
    const secretKeyB64 = encodeBase64(account.signingKey.secretKey);
    return {
      address,
      publicKeyB64,
      secretKeyB64,
    };
  }

  function add(account: WalletAccount) {
    const accounts = appState.get('accounts');
    const newAccounts = {
      ...accounts,
      [account.address]: account,
    };
    appState.set('accounts', newAccounts);
  }

  function remove(address: string) {
    const accounts = appState.get('accounts');
    const { [address]: _, ...newAccounts } = accounts;
    appState.set('accounts', newAccounts);
  }

  return {
    add,
    generate,
    get,
    remove,
    watch,
  };
}
