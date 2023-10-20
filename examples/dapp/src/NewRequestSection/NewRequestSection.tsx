// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-console */

import { AptosAccount, BCS, TransactionBuilder, TxnBuilderTypes } from 'aptos';
import { NetworkName } from '@identity-connect/api';
import { useAppState } from '../AppStateContext.ts';
import { useDappClient } from '../DappClientContext.ts';
import useAsyncAction from '../utils/useAsyncAction.ts';
import './index.css';

function makeJsonPayload() {
  return {
    arguments: ['0xb0b', 717],
    function: '0x1::coin::transfer',
    type: 'entry_function_payload' as const,
    type_arguments: ['0x1::aptos_coin::AptosCoin'],
  };
}

function makeBcsPayload() {
  const typeArgs = [
    new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString('0x1::aptos_coin::AptosCoin')),
  ];
  const encodedArgs = [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex('0xb0b')), BCS.bcsSerializeUint64(717)];
  const entryFunction = TxnBuilderTypes.EntryFunction.natural('0x1::coin', 'transfer', typeArgs, encodedArgs);
  return new TxnBuilderTypes.TransactionPayloadEntryFunction(entryFunction);
}

function makeRawTxn(signerAddress: string) {
  const payload = makeBcsPayload();
  const expirationTimestamp = Math.ceil(Date.now() / 1000) + 60;
  return new TxnBuilderTypes.RawTransaction(
    TxnBuilderTypes.AccountAddress.fromHex(signerAddress),
    0n,
    payload,
    0n,
    0n,
    BigInt(expirationTimestamp),
    new TxnBuilderTypes.ChainId(2),
  );
}

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

  const signAndSubmitJsonTransaction = useAsyncAction(async () => {
    if (activeAccountAddress === undefined) {
      return;
    }
    const payload = makeJsonPayload();
    const response = await dappClient.signAndSubmitTransaction(activeAccountAddress, { payload });
    console.log(response);
  });

  const signAndSubmitBcsTransaction = useAsyncAction(async () => {
    if (activeAccountAddress === undefined) {
      return;
    }
    const payload = makeBcsPayload();
    const response = await dappClient.signAndSubmitTransaction(activeAccountAddress, { payload });
    console.log(response);
  });

  const signAndSubmitFeePayerTransaction = useAsyncAction(async () => {
    if (activeAccountAddress === undefined) {
      return;
    }
    const rawTxn = makeRawTxn(activeAccountAddress);
    const feePayer = new AptosAccount();
    const feePayerRawTxn = new TxnBuilderTypes.FeePayerRawTransaction(
      rawTxn,
      [],
      TxnBuilderTypes.AccountAddress.fromHex(feePayer.address()),
    );

    const txnSigningMessage = TransactionBuilder.getSigningMessage(feePayerRawTxn);
    const feePayerSignature = feePayer.signBuffer(txnSigningMessage);
    const feePayerSignatureBytes = feePayerSignature.toUint8Array();
    const feePayerAuthenticator = new TxnBuilderTypes.AccountAuthenticatorEd25519(
      new TxnBuilderTypes.Ed25519PublicKey(feePayer.signingKey.publicKey),
      new TxnBuilderTypes.Ed25519Signature(feePayerSignatureBytes),
    );

    const response = await dappClient.signAndSubmitTransaction(activeAccountAddress, {
      feePayerAuthenticator,
      rawTxn: feePayerRawTxn,
    });
    console.log(response);
  });

  const signJsonTransaction = useAsyncAction(async () => {
    if (activeAccountAddress === undefined) {
      return;
    }
    const payload = makeJsonPayload();
    const response = await dappClient.signTransaction(activeAccountAddress, { payload });
    console.log(response);
  });

  const signBcsTransaction = useAsyncAction(async () => {
    if (activeAccountAddress === undefined) {
      return;
    }
    const payload = makeBcsPayload();
    const response = await dappClient.signTransaction(activeAccountAddress, { payload });
    console.log(response);
  });

  const signRawTxn = useAsyncAction(async () => {
    if (activeAccountAddress === undefined) {
      return;
    }
    const rawTxn = makeRawTxn(activeAccountAddress);
    const response = await dappClient.signTransaction(activeAccountAddress, { rawTxn });
    console.log(response);
  });

  const signFeePayerTxn = useAsyncAction(async () => {
    if (activeAccountAddress === undefined) {
      return;
    }
    const rawTxn = makeRawTxn(activeAccountAddress);
    const feePayer = new AptosAccount();
    const feePayerRawTxn = new TxnBuilderTypes.FeePayerRawTransaction(
      rawTxn,
      [],
      TxnBuilderTypes.AccountAddress.fromHex(feePayer.address()),
    );

    const response = await dappClient.signTransaction(activeAccountAddress, { rawTxn: feePayerRawTxn });
    console.log(response);
  });

  return (
    <div>
      <h2>New request</h2>
      <div className="new-request-list">
        <div>
          Network: <NetworkSelect />
        </div>
        <button type="button" onClick={signMessage.trigger} disabled={!activeAccountAddress || signMessage.isLoading}>
          Sign message
        </button>
        <button
          type="button"
          onClick={signAndSubmitJsonTransaction.trigger}
          disabled={!activeAccountAddress || signAndSubmitJsonTransaction.isLoading}
        >
          Sign and submit JSON transaction
        </button>
        <button
          type="button"
          onClick={signAndSubmitBcsTransaction.trigger}
          disabled={!activeAccountAddress || signAndSubmitBcsTransaction.isLoading}
        >
          Sign and submit BCS transaction
        </button>
        <button
          type="button"
          onClick={signAndSubmitFeePayerTransaction.trigger}
          disabled={!activeAccountAddress || signAndSubmitFeePayerTransaction.isLoading}
        >
          Sign and submit fee payer raw transaction
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
        <button type="button" onClick={signRawTxn.trigger} disabled={!activeAccountAddress || signRawTxn.isLoading}>
          Sign raw transaction
        </button>
        <button
          type="button"
          onClick={signFeePayerTxn.trigger}
          disabled={!activeAccountAddress || signFeePayerTxn.isLoading}
        >
          Sign fee payer raw transaction
        </button>
      </div>
    </div>
  );
}

function NetworkSelect() {
  const appState = useAppState();
  const selectedNetwork = appState.watch('selectedNetwork');

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    appState.set('selectedNetwork', event.target.value as NetworkName);
  }

  return (
    <select onChange={onChange} defaultValue={selectedNetwork}>
      <option value={NetworkName.TESTNET}>Testnet</option>
      <option value={NetworkName.MAINNET}>Mainnet</option>
    </select>
  );
}
