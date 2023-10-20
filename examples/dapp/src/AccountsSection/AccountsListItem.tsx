// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { DappPairingData } from '@identity-connect/dapp-sdk';
import { useAppState } from '../AppStateContext.ts';
import { useDappClient } from '../DappClientContext.ts';
import useAsyncAction from '../utils/useAsyncAction.ts';
import './index.css';

export interface AccountsListItemProps {
  pairing: DappPairingData;
}

export default function AccountsListItem({ pairing }: AccountsListItemProps) {
  const dappClient = useDappClient();
  const appState = useAppState();

  const disconnect = useAsyncAction(async () => {
    await dappClient.disconnect(pairing.accountAddress);
    const activeAccountAddress = appState.get('activeAccountAddress');
    if (activeAccountAddress === pairing.accountAddress) {
      appState.set('activeAccountAddress', undefined);
    }
  });

  const offboard = async () => {
    await dappClient.offboard(pairing.accountAddress);
    const activeAccountAddress = appState.get('activeAccountAddress');
    if (activeAccountAddress === pairing.accountAddress) {
      appState.set('activeAccountAddress', undefined);
    }
  };

  const onSelect = () => {
    appState.set('activeAccountAddress', pairing.accountAddress);
  };

  // Determine if this is the active account on the first render.
  // No need to handle re-renders as HTML will take care of updating all radio buttons
  // on change
  const initialActiveAccountAddress = appState.get('activeAccountAddress');

  const collapsedAddress = pairing.accountAddress.slice(0, 18);

  return (
    <li className="accounts-list-item">
      <span>{collapsedAddress}</span>
      <input
        type="radio"
        name="activeAccount"
        onChange={onSelect}
        defaultChecked={initialActiveAccountAddress === pairing.accountAddress}
      />
      <button type="button" className="btn-small" onClick={disconnect.trigger} disabled={disconnect.isLoading}>
        x
      </button>
      {pairing.dappWalletId ? (
        <button type="button" className="btn-small" onClick={offboard}>
          Off
        </button>
      ) : null}
    </li>
  );
}
