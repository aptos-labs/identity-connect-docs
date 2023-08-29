// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export interface WalletConnectionAccount {
  address: string;
  ed25519PublicKeyB64: string;
  transportEd25519PublicKeyB64: string;
  transportEd25519SecretKeyB64: string;
  userSubmittedAlias?: string;
}

export interface WalletConnectionData {
  accounts: { [address: string]: WalletConnectionAccount };
  icEd25519PublicKeyB64: string;
  walletEd25519PublicKeyB64: string;
  walletEd25519SecretKeyB64: string;
  walletId: string;
}

export type WalletConnectionDataMap = { [walletId: string]: WalletConnectionData };

export interface WalletStateAccessors {
  get: (walletId: string) => Promise<WalletConnectionData | undefined>;
  getAll: () => Promise<WalletConnectionDataMap>;
  update: (walletId: string, pairing?: WalletConnectionData) => Promise<void>;
}
