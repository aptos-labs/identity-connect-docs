// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import type { AccountData } from './account';
import type { AnonymousPairingData } from './pairing';

export type WalletName = 'petra';

export type WalletOS = 'linux' | 'osx' | 'win' | 'ios' | 'android';

export type WalletPlatform =
  | '!test'
  /// Desktop
  | 'firefox-extension'
  | 'chrome-extension'
  | 'safari-extension'
  | 'brave-extension'
  | 'opera-extension'
  // Mobile
  | 'kiwi-extension'
  | 'native-app';

export interface BaseWalletData {
  createdAt: Date;
  icEd25519PublicKeyB64: string;
  id: string;
  updatedAt: Date;
}

export interface NewWalletData extends BaseWalletData {
  walletEd25519PublicKeyB64: null;
}

export interface BaseConnectedWalletData extends BaseWalletData {
  accounts: AccountData[];
  deviceIdentifier: string;
  platform: WalletPlatform;
  platformOS: WalletOS;
  walletEd25519PublicKeyB64: string;
  walletName: WalletName;
}

export interface AuthenticatedWalletData extends BaseConnectedWalletData {
  anonymousPairing: null;
  userId: string;
}

export interface AnonymousWalletData extends BaseConnectedWalletData {
  anonymousPairing: AnonymousPairingData;
  userId: null;
}

export type ConnectedWalletData = AuthenticatedWalletData | AnonymousWalletData;

export type WalletData = NewWalletData | ConnectedWalletData;
