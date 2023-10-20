// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { DeserializedTransactionPayload } from '@identity-connect/api';
import {
  decodeBase64,
  KeyTypes,
  makeEd25519SecretKeySignCallbackNoDomainSeparation,
  toKey,
} from '@identity-connect/crypto';
import {
  bcsSerialize,
  deserializeSignTransactionRequestArgs,
  JsonTransactionPayload,
} from '@identity-connect/wallet-api';
import { SignTransactionRequest } from '@identity-connect/wallet-sdk';
import { HexString, TransactionBuilder, TxnBuilderTypes } from 'aptos';
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
  if ((payload as any).type === 'multisig_payload') {
    throw new Error('Not supported');
  }

  return {
    args: (payload as any).arguments,
    functionId: (payload as any).function,
  };
}

function makeMockPayload() {
  const entryFunction = new TxnBuilderTypes.EntryFunction(
    TxnBuilderTypes.ModuleId.fromStr('0x1::mock'),
    new TxnBuilderTypes.Identifier('doSomething'),
    [],
    [],
  );
  return new TxnBuilderTypes.TransactionPayloadEntryFunction(entryFunction);
}

interface RequestListItemProps {
  onRespond: () => void;
  request: SignTransactionRequest;
}

export default function SignTransactionRequestListItem({ onRespond, request }: RequestListItemProps) {
  const appState = useAppState();
  const walletClient = useWalletClient();

  const deserializedArgs = useMemo(() => deserializeSignTransactionRequestArgs(request.args), [request.args]);

  const respond = useAsyncAction(async (action: string) => {
    const accounts = appState.get('accounts');
    const account = accounts[request.accountAddress];
    if (account === undefined) {
      throw new Error('Account not available in wallet');
    }

    const accountEd25519SecretKey = toKey(decodeBase64(account.secretKeyB64), KeyTypes.Ed25519SecretKey);
    const signCallback = makeEd25519SecretKeySignCallbackNoDomainSeparation(accountEd25519SecretKey);

    if (action === 'approve') {
      let rawTxn: TxnBuilderTypes.RawTransaction | undefined;
      let signingMessageBytes: Uint8Array;
      if ('payload' in deserializedArgs) {
        const expirationTimestamp = Math.ceil(Date.now() / 1000) + 60;
        const sender = deserializedArgs.options?.sender ?? request.accountAddress;
        rawTxn = new TxnBuilderTypes.RawTransaction(
          TxnBuilderTypes.AccountAddress.fromHex(sender),
          0n,
          makeMockPayload(),
          0n,
          0n,
          BigInt(expirationTimestamp),
          new TxnBuilderTypes.ChainId(request.networkName === 'mainnet' ? 1 : 2),
        );
        signingMessageBytes = TransactionBuilder.getSigningMessage(rawTxn);
      } else {
        signingMessageBytes = TransactionBuilder.getSigningMessage(deserializedArgs.rawTxn);
      }

      const signatureBytes = await signCallback(signingMessageBytes);
      const accountAuthenticator = new TxnBuilderTypes.AccountAuthenticatorEd25519(
        new TxnBuilderTypes.Ed25519PublicKey(decodeBase64(account.publicKeyB64)),
        new TxnBuilderTypes.Ed25519Signature(signatureBytes),
      );

      await walletClient.approveSigningRequest(request.id, request.pairingId, {
        accountAuthenticator: bcsSerialize(accountAuthenticator),
        rawTxn: rawTxn ? bcsSerialize(rawTxn) : undefined,
      });
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
            ({collapsedId}) <b>Sign transaction</b>
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
