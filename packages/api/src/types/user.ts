// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export interface UserData {
  confirmedPrivacyPolicy: boolean;
  confirmedTOS?: boolean;
  createdAt: Date;
  updatedAt: Date;
  username: string;
}

export interface ProjectData {
  adminUserId: string;
  allowPairingsWithoutHostname: boolean;
  createdAt: Date;
  description: string;
  hostname: string;
  iconUrl: string | null;
  id: string;
  isDappHostnameVerified: boolean;
  name: string;
  updatedAt: Date;
}
