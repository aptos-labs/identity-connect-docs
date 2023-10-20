// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { DappSpecificWallet } from './dappSpecificWallet';

export interface AccountData {
  accountAddress: string;
  createdAt: Date;
  ed25519PublicKeyB64: string;
  id: string;
  transportEd25519PublicKeyB64: string;
  updatedAt: Date;
  userSubmittedAlias: string | null;
  // TODO: figure out why this looks like this
  walletAccounts: {
    dappSpecificWallet?: DappSpecificWallet | null;
    dappSpecificWalletId?: string | null;
    walletAccountId: string;
    walletName: string | null;
  }[];
}
