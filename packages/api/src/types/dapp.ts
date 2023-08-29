// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export interface RegisteredDappDataBase {
  description: string | null;
  hostname: string;
  iconUrl: string | null;
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
