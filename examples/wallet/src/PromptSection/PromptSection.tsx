// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { SigningRequestTypes } from '@identity-connect/api';
import { SignRequest } from '@identity-connect/wallet-sdk';
import { useState } from 'react';
import './index.css';
import useAsyncAction from '../utils/useAsyncAction.ts';
import { useWalletClient } from '../WalletClientContext.ts';
import SignMessageRequestListItem from './SignMessageRequestListItem.tsx';
import SignTransactionRequestListItem from './SignTransactionRequestListItem.tsx';

export default function PromptSection() {
  const walletClient = useWalletClient();

  const [signingRequests, setSigningRequests] = useState<SignRequest[]>();
  const fetchSigningRequests = useAsyncAction(async () => {
    const newSigningRequests = await walletClient.getAllSigningRequests();
    setSigningRequests(newSigningRequests);
  });

  return (
    <div className="signing-requests-container">
      <h2>Signing requests</h2>
      <div className="signing-requests-body">
        <ul className="signing-requests">
          {signingRequests?.map((request) => {
            switch (request.type) {
              case SigningRequestTypes.SIGN_MESSAGE:
                return (
                  <SignMessageRequestListItem
                    key={request.id}
                    request={request}
                    onRespond={fetchSigningRequests.trigger}
                  />
                );
              case SigningRequestTypes.SIGN_AND_SUBMIT_TRANSACTION:
                return (
                  <SignTransactionRequestListItem
                    key={request.id}
                    request={request}
                    onRespond={fetchSigningRequests.trigger}
                  />
                );
              default:
                return null;
            }
          })}
        </ul>
        <button type="button" onClick={fetchSigningRequests.trigger} disabled={fetchSigningRequests.isLoading}>
          Fetch
        </button>
      </div>
    </div>
  );
}
