// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import type { AccountData } from './account';
import type { AnonymousPairingData } from './pairing';
import { DappSpecificWallet } from './dappSpecificWallet';

export type WalletName = 'petra' | 'martian' | 'ic' | 'pontem';

export type WalletOS = 'linux' | 'osx' | 'win' | 'ios' | 'android' | 'ic';

export type WalletPlatform =
  /// Desktop
  | 'firefox-extension'
  | 'chrome-extension'
  | 'safari-extension'
  | 'brave-extension'
  | 'opera-extension'
  /// Mobile
  | 'kiwi-extension'
  | 'native-app'
  /// Reserved for IC full custody
  | 'ic-dapp-wallet';

export interface BaseWalletData {
  createdAt: Date;
  dappSpecificWallet?: DappSpecificWallet;
  dappSpecificWalletId?: string;
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
