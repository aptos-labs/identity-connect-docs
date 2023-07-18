// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export interface AccountData {
  accountAddress: string;
  createdAt: Date;
  ed25519PublicKeyB64: string;
  transportEd25519PublicKeyB64: string;
  updatedAt: Date;
  userSubmittedAlias: string | null;
  // TODO: figure out why this looks like this
  walletNames: (string | null)[];
}
