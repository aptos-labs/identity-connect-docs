// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { useAppState } from '../AppStateContext.ts';
import { useDappClient } from '../DappClientContext.ts';
import useAsyncAction from '../utils/useAsyncAction.ts';
import './index.css';
import AccountsListItem from './AccountsListItem.tsx';

export default function AccountsSection() {
  const dappClient = useDappClient();
  const appState = useAppState();
  const pairings = appState.watch('icPairings');

  const connect = useAsyncAction(async () => {
    const accountAddress = await dappClient.connect();
    if (accountAddress !== undefined) {
      appState.set('activeAccountAddress', accountAddress);
    }
  });

  return (
    <div>
      <h2>Accounts</h2>
      <ul className="accounts-list">
        {Object.values(pairings).map((pairing) => (
          <AccountsListItem key={pairing.accountAddress} pairing={pairing} />
        ))}
      </ul>
      <button type="button" onClick={connect.trigger} disabled={connect.isLoading}>
        Connect
      </button>
    </div>
  );
}
