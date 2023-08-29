// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

// Adding or removing an account? This will be idempotent, but racy
import { sha3_256 } from '@noble/hashes/sha3';
import { AptosAccount, HexString, TxnBuilderTypes } from 'aptos';
import {
  aptosAccountToEd25519Keypair,
  ed25519KeypairFromSecret,
  encodeBase64,
  Ed25519KeyPair,
  Ed25519PublicKey,
  Ed25519SecretKey,
} from './utils';
import {
  makeEd25519SecretKeySignCallbackNoDomainSeparation,
  messageHash,
  SignCallback,
  signWithEd25519SecretKey,
} from './encrDecr';

const { AuthenticationKey, Ed25519PublicKey: AptosEd25519PublicKey } = TxnBuilderTypes;

// ADD/REMOVE is used for account connections
export enum AccountConnectionAction {
  ADD = 'add',
  REMOVE = 'remove',
}

/**
 * When a wallet wants to create a pairing, or add/remove an account from a wallet connection, it must prove that it
 * has the secret key for a given account. To do so it uses an `AccountConnectInfo` object.
 *  1. Once the `AccountConnectInfo` is assembled, it’s JSON serialized to get a `accountInfoSerialized` string.
 *  2. We then domain separate and hash the `accountInfoSerialized` to get the `accountInfoHash`:
 *    `SHA3-256(SHA3-256('APTOS::IDENTITY_CONNECT::') | SHA3-256(accountInfoSerialized))`
 *  3. To obtain the `signature`, we sign the `accountInfoHash` with the Ed25519 private key of the sender, and hex
 *     encode it.
 *  4. These are assembled into an `AccountConnectInfoSerialized`, ready to be sent in an HTTP request.
 */

export type AccountConnectInfo = {
  // The account address
  accountAddress: string;
  // either 'add' or 'remove'
  action: AccountConnectionAction;
  // The account public key, base64
  ed25519PublicKeyB64: string;
  // A unique identifier for this connection: it is either the walletId or the pairingId
  // Prevents replay attacks across wallets
  intentId: string;
  // Prevents replay attacks across time- these are only valid for 5 minutes
  timestampMillis: number;
  // The public key for the encrypted e2e channel, base64
  transportEd25519PublicKeyB64: string;
};

export type AccountConnectInfoSerialized = {
  accountInfoSerialized: string;
  signature: string;
};

export function deriveAccountTransportEd25519Keypair(
  ed25519SecretKey: Ed25519SecretKey,
  ed25519PublicKey: Ed25519PublicKey,
): Ed25519KeyPair;

export async function deriveAccountTransportEd25519Keypair(
  signCallback: SignCallback,
  ed25519PublicKey: Ed25519PublicKey,
): Promise<Ed25519KeyPair>;

export function deriveAccountTransportEd25519Keypair(
  ed25519SecretKeyOrSignCallback: Ed25519SecretKey | SignCallback,
  ed25519PublicKey: Ed25519PublicKey,
) {
  if (ed25519SecretKeyOrSignCallback instanceof Function) {
    const seedGeneratorBytes = messageHash(ed25519PublicKey.key, 'TRANSPORT_KEYPAIR');
    return ed25519SecretKeyOrSignCallback(seedGeneratorBytes).then(ed25519KeypairFromSecret);
  }

  const seedBytes = signWithEd25519SecretKey(ed25519PublicKey.key, ed25519SecretKeyOrSignCallback, 'TRANSPORT_KEYPAIR');
  return ed25519KeypairFromSecret(seedBytes);
}

export async function createSerializedAccountInfo(
  signCallback: SignCallback,
  ed25519PublicKey: Ed25519PublicKey,
  transportEd25519PublicKey: Ed25519PublicKey,
  action: AccountConnectionAction,
  intentId: string,
  accountAddress?: string,
): Promise<AccountConnectInfoSerialized> {
  // TODO: WRITE TESTS FOR THIS!

  // Either the passed in Pk, or the Pk derived from the Sk
  const authKey = AuthenticationKey.fromEd25519PublicKey(new AptosEd25519PublicKey(ed25519PublicKey.key));

  // Either the passed in account address, or the one derived from the authKey: (either Pk, or derived from Sk)
  const finalAccountAddress = accountAddress || authKey?.derivedAddress().hex();

  const accountInfo: AccountConnectInfo = {
    accountAddress: finalAccountAddress,
    action,
    ed25519PublicKeyB64: encodeBase64(ed25519PublicKey.key),
    intentId,
    timestampMillis: Date.now(),
    transportEd25519PublicKeyB64: encodeBase64(transportEd25519PublicKey.key),
  };
  const accountInfoSerialized = JSON.stringify(accountInfo);
  const accountInfoBytes = new TextEncoder().encode(accountInfoSerialized);
  const accountInfoHash = sha3_256(accountInfoBytes);

  const signatureBytes = await signCallback(messageHash(accountInfoHash, 'ACCOUNT_INFO'));
  const signature = HexString.fromUint8Array(signatureBytes).hex();
  return {
    accountInfoSerialized,
    signature,
  };
}

export async function aptosAccountToSerializedInfo(
  account: AptosAccount,
  intentId: string,
): Promise<AccountConnectInfoSerialized> {
  const key = aptosAccountToEd25519Keypair(account);
  const signCallback = makeEd25519SecretKeySignCallbackNoDomainSeparation(key.secretKey);
  const transportKey = await deriveAccountTransportEd25519Keypair(signCallback, key.publicKey);
  return createSerializedAccountInfo(
    signCallback,
    key.publicKey,
    transportKey.publicKey,
    AccountConnectionAction.ADD,
    intentId,
  );
}
