// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { DeserializedTransactionPayload, ensurePayloadDeserialized } from '@identity-connect/api';
import { KeyTypes, makeEd25519SecretKeySignCallback, toKey } from '@identity-connect/crypto';
import { SignTransactionRequest } from '@identity-connect/wallet-sdk';
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
    return {
      args: [], // TODO
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
  request: SignTransactionRequest;
}

export default function SignTransactionRequestListItem({ onRespond, request }: RequestListItemProps) {
  const appState = useAppState();
  const walletClient = useWalletClient();

  const serializedPayload = request.body;
  const payload = useMemo(() => ensurePayloadDeserialized(serializedPayload), [serializedPayload]);

  const respond = useAsyncAction(async (action: string) => {
    const accounts = appState.get('accounts');
    const account = accounts[request.accountAddress];
    if (account === undefined) {
      throw new Error('Account not available in wallet');
    }

    const accountEd25519SecretKey = toKey(Buffer.from(account.secretKeyB64, 'base64'), KeyTypes.Ed25519SecretKey);
    const signCallback = makeEd25519SecretKeySignCallback(accountEd25519SecretKey);

    if (action === 'approve') {
      const version = Date.now();
      const hashBytes = await signCallback(new TextEncoder().encode(version.toString()));
      const hash = Buffer.from(hashBytes).toString('hex');
      const mockUserTxn = {
        hash,
        sender: account.address,
        sequence_number: 1,
        signature: '0x123456789',
        success: true,
        version,
      };
      await walletClient.approveSigningRequest(request.id, request.pairingId, mockUserTxn as any);
    } else {
      await walletClient.rejectSigningRequest(request.id, request.pairingId);
    }
    onRespond();
  });

  const collapsedId = `${request.id.slice(0, 4)}...${request.id.slice(-4)}`;

  const payloadInfo = getEntryFunctionInfo(payload);

  return (
    <div className="signing-request">
      <div>
        <div style={{ textAlign: 'left' }}>
          <div>
            ({collapsedId}) <b>Sign transaction</b>
          </div>
          <div>{payloadInfo.functionId}</div>
          <div>{JSON.stringify(payloadInfo.args)}</div>
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
