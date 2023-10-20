// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export interface DappSpecificWallet {
  addressHex: string;
  createdAt: Date;
  id: string;
  publicKeyHex: string;
  registeredDappId: string;
  transportEd25519PublicKeyB64: string;
  updatedAt: Date;
  userId: string;
}
