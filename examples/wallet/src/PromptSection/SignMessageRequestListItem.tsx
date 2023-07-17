// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { KeyTypes, makeEd25519SecretKeySignCallback, toKey } from '@identity-connect/crypto';
import { SignMessageRequest } from '@identity-connect/wallet-sdk';
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

    const accountEd25519SecretKey = toKey(Buffer.from(account.secretKeyB64, 'base64'), KeyTypes.Ed25519SecretKey);
    const signCallback = makeEd25519SecretKeySignCallback(accountEd25519SecretKey);

    if (action === 'approve') {
      // TODO: derive from SigningRequest
      const application = 'Dapp example';
      // TODO: derive from network
      const chainId = 1;
      const prefix = 'ExampleWallet::';
      const { message, nonce } = request.body;

      const fullMessageParts = [
        request.body.address ? request.accountAddress : undefined,
        request.body.chainId ? chainId : undefined,
        request.body.application ? application : undefined,
        nonce,
        prefix,
        message,
      ];

      const fullMessage = fullMessageParts.filter(Boolean).join('\n');
      const fullMessageBytes = new TextEncoder().encode(fullMessage);

      const signatureBytes = await signCallback(fullMessageBytes);
      const signature = Buffer.from(signatureBytes).toString('hex');
      await walletClient.approveSigningRequest(request.id, request.pairingId, {
        address: request.accountAddress,
        application,
        chainId,
        fullMessage,
        message,
        nonce,
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
        <div>{request.body.message}</div>
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
