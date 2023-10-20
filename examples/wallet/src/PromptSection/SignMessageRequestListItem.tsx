// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import {
  decodeBase64,
  KeyTypes,
  makeEd25519SecretKeySignCallbackNoDomainSeparation,
  toKey,
} from '@identity-connect/crypto';
import { FullMessageParams, makeFullMessage } from '@identity-connect/wallet-api';
import { SignMessageRequest } from '@identity-connect/wallet-sdk';
import { HexString } from 'aptos';
import { useAppState } from '../AppStateContext.ts';
import useAsyncAction from '../utils/useAsyncAction.ts';
import { useWalletClient } from '../WalletClientContext.ts';
import './index.css';

interface RequestListItemProps {
  onRespond: () => void;
  request: SignMessageRequest;
}

export default function SignMessageRequestListItem({ onRespond, request }: RequestListItemProps) {
  const appState = useAppState();
  const walletClient = useWalletClient();

  const respond = useAsyncAction(async (action: string) => {
    const accounts = appState.get('accounts');
    const account = accounts[request.accountAddress];
    if (account === undefined) {
      throw new Error('Account not available in wallet');
    }

    const accountEd25519SecretKey = toKey(decodeBase64(account.secretKeyB64), KeyTypes.Ed25519SecretKey);
    const signCallback = makeEd25519SecretKeySignCallbackNoDomainSeparation(accountEd25519SecretKey);

    if (action === 'approve') {
      const { message, nonce, ...flags } = request.args;

      const address = request.accountAddress;
      const application = request.registeredDapp.hostname;
      const chainId = request.networkName === 'mainnet' ? 1 : 2;
      const params: FullMessageParams = { address, application, chainId, message, nonce };

      const { fullMessage, prefix } = makeFullMessage(params, flags);

      const fullMessageBytes = new TextEncoder().encode(fullMessage);
      const signatureBytes = await signCallback(fullMessageBytes);
      const signature = HexString.fromUint8Array(signatureBytes).toString();

      await walletClient.approveSigningRequest(request.id, request.pairingId, {
        ...params,
        fullMessage,
        prefix,
        signature,
      });
    } else {
      await walletClient.rejectSigningRequest(request.id, request.pairingId);
    }
    onRespond();
  });

  const collapsedId = `${request.id.slice(0, 4)}...${request.id.slice(-4)}`;

  return (
    <div className="signing-request">
      <div style={{ textAlign: 'left' }}>
        <div>
          ({collapsedId}) <b>Sign Message</b>
        </div>
        <div>{request.args.message}</div>
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
