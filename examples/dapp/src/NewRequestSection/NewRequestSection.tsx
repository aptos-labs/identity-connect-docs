// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-console */

import { BCS, TxnBuilderTypes } from 'aptos';
import { useAppState } from '../AppStateContext.ts';
import { useDappClient } from '../DappClientContext.ts';
import useAsyncAction from '../utils/useAsyncAction.ts';
import './index.css';

export default function NewRequestSection() {
  const dappClient = useDappClient();
  const appState = useAppState();

  const activeAccountAddress = appState.watch('activeAccountAddress');

  const signMessage = useAsyncAction(async () => {
    if (activeAccountAddress === undefined) {
      return;
    }

    const response = await dappClient.signMessage(activeAccountAddress, {
      message: 'testMessage',
      nonce: Date.now().toString(),
    });
    console.log(response);
  });

  const signJsonTransaction = useAsyncAction(async () => {
    if (activeAccountAddress === undefined) {
      return;
    }

    const payload = {
      arguments: ['0xb0b', 717],
      function: '0x1::coin::transfer',
      type: 'entry_function_payload' as const,
      type_arguments: ['0x1::aptos_coin::AptosCoin'],
    };

    const response = await dappClient.signAndSubmitTransaction(activeAccountAddress, payload);
    console.log(response);
  });

  const signBcsTransaction = useAsyncAction(async () => {
    if (activeAccountAddress === undefined) {
      return;
    }

    const typeArgs = [
      new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString('0x1::aptos_coin::AptosCoin')),
    ];
    const encodedArgs = [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex('0xb0b')), BCS.bcsSerializeUint64(717)];
    const entryFunction = TxnBuilderTypes.EntryFunction.natural('0x1::coin', 'transfer', typeArgs, encodedArgs);
    const payload = new TxnBuilderTypes.TransactionPayloadEntryFunction(entryFunction);
    const response = await dappClient.signAndSubmitTransaction(activeAccountAddress, payload);
    console.log(response);
  });

  return (
    <div>
      <h2>New request</h2>
      <div className="new-request-list">
        <button type="button" onClick={signMessage.trigger} disabled={!activeAccountAddress || signMessage.isLoading}>
          Sign message
        </button>
        <button
          type="button"
          onClick={signJsonTransaction.trigger}
          disabled={!activeAccountAddress || signJsonTransaction.isLoading}
        >
          Sign JSON transaction
        </button>
        <button
          type="button"
          onClick={signBcsTransaction.trigger}
          disabled={!activeAccountAddress || signBcsTransaction.isLoading}
        >
          Sign BCS transaction
        </button>
      </div>
    </div>
  );
}
