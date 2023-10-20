// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export interface RegisteredDappDataBase {
  dappSpecificWalletAllowed: boolean;
  description: string | null;
  feePayerAllowed: boolean;
  hostname: string;
  iconUrl: string | null;
  id: string;
  name: string;
}

export interface GetDappData extends RegisteredDappDataBase {
  adminUserId: string;
  allowPairingsWithoutHostname: boolean;
  createdAt: Date;
  id: string;
  isDappHostnameVerified: boolean;
  updatedAt: Date;
}
