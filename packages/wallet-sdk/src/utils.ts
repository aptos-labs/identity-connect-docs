// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import {
  AccountConnectInfo,
  AccountConnectionAction,
  createSerializedAccountInfo,
  deriveAccountTransportEd25519Keypair,
  Ed25519PublicKey,
  SignCallback,
} from '@identity-connect/crypto';
import { WalletAccountConnectInfo } from './types';

export function walletAccountFromConnectInfo({ info, transportEd25519SecretKey }: WalletAccountConnectInfo) {
  const { accountAddress, action, ed25519PublicKeyB64, transportEd25519PublicKeyB64 } = JSON.parse(
    info.accountInfoSerialized,
  ) as AccountConnectInfo;
  const transportEd25519SecretKeyB64 = Buffer.from(transportEd25519SecretKey.key).toString('base64');
  return {
    account: {
      address: accountAddress,
      ed25519PublicKeyB64,
      transportEd25519PublicKeyB64,
      transportEd25519SecretKeyB64,
    },
    action,
  };
}

export async function createWalletAccountConnectInfo(
  signCallback: SignCallback,
  ed25519PublicKey: Ed25519PublicKey,
  action: AccountConnectionAction,
  intentId: string,
  accountAddress?: string,
): Promise<WalletAccountConnectInfo> {
  const transportKeys = await deriveAccountTransportEd25519Keypair(signCallback, ed25519PublicKey);
  const info = await createSerializedAccountInfo(
    signCallback,
    ed25519PublicKey,
    transportKeys.publicKey,
    action,
    intentId,
    accountAddress,
  );
  return { info, transportEd25519SecretKey: transportKeys.secretKey };
}
