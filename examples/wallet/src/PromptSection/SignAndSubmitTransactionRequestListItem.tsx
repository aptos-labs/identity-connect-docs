// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { DeserializedTransactionPayload } from '@identity-connect/api';
import {
  decodeBase64,
  KeyTypes,
  makeEd25519SecretKeySignCallbackNoDomainSeparation,
  toKey,
} from '@identity-connect/crypto';
import { deserializeSignAndSubmitTransactionRequestArgs, JsonTransactionPayload } from '@identity-connect/wallet-api';
import { SignAndSubmitTransactionRequest } from '@identity-connect/wallet-sdk';
import { HexString, TxnBuilderTypes } from 'aptos';
import { useMemo } from 'react';
import { useAppState } from '../AppStateContext.ts';
import useAsyncAction from '../utils/useAsyncAction.ts';
import { useWalletClient } from '../WalletClientContext.ts';
import './index.css';

function getEntryFunctionInfo(payload: DeserializedTransactionPayload) {
  if (payload instanceof TxnBuilderTypes.TransactionPayloadEntryFunction) {
    const moduleAddress = HexString.fromUint8Array(payload.value.module_name.address.address).toShortString();
    const moduleName = payload.value.module_name.name.value;
    const functionName = payload.value.function_name.value;
    const encodedArgs = payload.value.args.map((arg) => HexString.fromUint8Array(arg).toShortString());
    return {
      args: encodedArgs,
      functionId: `${moduleAddress}::${moduleName}::${functionName}`,
    };
  }

  if (payload instanceof TxnBuilderTypes.TransactionPayload) {
    throw new Error('Not supported');
  }
  if (payload.type === 'multisig_payload') {
    throw new Error('Not supported');
  }

  return {
    args: payload.arguments,
    functionId: payload.function,
  };
}

interface RequestListItemProps {
  onRespond: () => void;
  request: SignAndSubmitTransactionRequest;
}

export default function SignAndSubmitTransactionRequestListItem({ onRespond, request }: RequestListItemProps) {
  const appState = useAppState();
  const walletClient = useWalletClient();

  const deserializedArgs = useMemo(() => deserializeSignAndSubmitTransactionRequestArgs(request.args), [request.args]);

  const respond = useAsyncAction(async (action: string) => {
    const accounts = appState.get('accounts');
    const account = accounts[request.accountAddress];
    if (account === undefined) {
      throw new Error('Account not available in wallet');
    }

    const accountEd25519SecretKey = toKey(decodeBase64(account.secretKeyB64), KeyTypes.Ed25519SecretKey);
    const signCallback = makeEd25519SecretKeySignCallbackNoDomainSeparation(accountEd25519SecretKey);

    if (action === 'approve') {
      const version = Date.now();
      const hashBytes = await signCallback(new TextEncoder().encode(version.toString()));
      const mockHash = HexString.fromUint8Array(hashBytes).toString();
      await walletClient.approveSigningRequest(request.id, request.pairingId, { hash: mockHash });
    } else {
      await walletClient.rejectSigningRequest(request.id, request.pairingId);
    }
    onRespond();
  });

  const collapsedId = `${request.id.slice(0, 4)}...${request.id.slice(-4)}`;

  let payload: JsonTransactionPayload | TxnBuilderTypes.TransactionPayload | undefined;
  let feePayerAddress: string | undefined;
  if ('payload' in deserializedArgs) {
    payload = deserializedArgs.payload;
  } else if (deserializedArgs.rawTxn instanceof TxnBuilderTypes.RawTransaction) {
    payload = deserializedArgs.rawTxn.payload;
  } else {
    payload = deserializedArgs.rawTxn.raw_txn.payload;
    if (deserializedArgs.rawTxn instanceof TxnBuilderTypes.FeePayerRawTransaction) {
      feePayerAddress = deserializedArgs.rawTxn.fee_payer_address.toHexString().toString();
    }
  }
  const payloadInfo = payload ? getEntryFunctionInfo(payload) : undefined;

  return (
    <div className="signing-request">
      <div>
        <div style={{ textAlign: 'left' }}>
          <div>
            ({collapsedId}) <b>Sign and submit transaction</b>
          </div>
          <div>{payloadInfo?.functionId}</div>
          {feePayerAddress !== undefined ? <div>Fee payer: {feePayerAddress.slice(0, 4)}...</div> : null}
          <div>{JSON.stringify(payloadInfo?.args)}</div>
        </div>
      </div>
      <div>
        <button
          type="button"
          className="btn-small"
          onClick={() => respond.trigger('approve')}
          disabled={respond.isLoading}
        >
          o
        </button>
        <button
          type="button"
          className="btn-small"
          onClick={() => respond.trigger('reject')}
          disabled={respond.isLoading}
        >
          x
        </button>
      </div>
    </div>
  );
}
