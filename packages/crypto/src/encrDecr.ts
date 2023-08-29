// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { sha3_256 } from '@noble/hashes/sha3';
import nacl from 'tweetnacl';
import ed2curve from 'ed2curve';
import { DecryptionError } from './errors';
import {
  concatUint8array,
  decodeBase64,
  Ed25519PublicKey,
  Ed25519SecretKey,
  encodeBase64,
  X25519PublicKey,
  X25519SecretKey,
} from './utils';

// This callback takes in a message bytes, and signs it.
// THIS DOES NOT PERFORM DOMAIN SEPARATION: IT IS ASSUMED OUR LIBRARY ALREADY DID IT.
// This is to support hardware wallets.
export type SignCallback = (message: Uint8Array) => Promise<Uint8Array>;

export type SignaturePurpose = 'TRANSPORT_KEYPAIR' | 'ACCOUNT_INFO' | 'SECURED_ENVELOPE';

export const SIGNATURE_PREFIX = 'APTOS::IDENTITY_CONNECT';

export type EncryptionResult = {
  nonce: Uint8Array;
  secured: Uint8Array;
};

export type SerializedEncryptionResult = {
  nonceB64: string;
  securedB64: string;
};

export function serializeEncryptionResult(enc: EncryptionResult): SerializedEncryptionResult {
  return {
    nonceB64: encodeBase64(enc.nonce),
    securedB64: encodeBase64(enc.secured),
  };
}

export function deserializeEncryptionResult(enc: SerializedEncryptionResult): EncryptionResult {
  return {
    nonce: decodeBase64(enc.nonceB64),
    secured: decodeBase64(enc.securedB64),
  };
}

export function encryptMessage(
  senderX25519SecretKey: X25519SecretKey,
  receiverEd25519PublicKey: Ed25519PublicKey,
  message: string,
): EncryptionResult {
  // Generate a random nonce
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  // Convert the message to a Uint8Array
  const messageUint8 = new TextEncoder().encode(message);

  // Encrypt the message with the receiver's public key and sender's secret key
  const receiverX25519PublicKey = ed2curve.convertPublicKey(receiverEd25519PublicKey.key.slice(0, 32));
  if (!receiverX25519PublicKey) throw new Error('receiver public key is not a valid Ed25519 public key');
  const secured = nacl.box(messageUint8, nonce, receiverX25519PublicKey, senderX25519SecretKey.key.slice(0, 32));

  return { nonce, secured };
}

export function encryptObject<T>(
  senderX25519SecretKey: X25519SecretKey,
  receiverEd25519PublicKey: Ed25519PublicKey,
  message: T,
): EncryptionResult {
  return encryptMessage(senderX25519SecretKey, receiverEd25519PublicKey, JSON.stringify(message));
}

export function decryptMessage(
  senderX25519PublicKey: X25519PublicKey,
  receiverEd25519SecretKey: Ed25519SecretKey,
  securedMessage: Uint8Array,
  nonce: Uint8Array,
): string {
  // Decrypt the message with the receiver's secret key and sender's public key
  const receiverX25519SecretKey = ed2curve.convertSecretKey(receiverEd25519SecretKey.key.slice(0, 32));

  let decryptedUint8;
  try {
    decryptedUint8 = nacl.box.open(
      securedMessage,
      nonce,
      senderX25519PublicKey.key.slice(0, 32),
      receiverX25519SecretKey.slice(0, 32),
    );
  } catch (e: any) {
    throw new DecryptionError(`Could not decrypt message: ${e.message}`);
  }
  if (!decryptedUint8) throw new DecryptionError('Could not decrypt message');

  // Convert the decrypted Uint8Array back to a string
  return new TextDecoder().decode(decryptedUint8);
}

export function decryptObject<T>(
  senderX25519PublicKey: X25519PublicKey,
  receiverEd25519SecretKey: Ed25519SecretKey,
  securedMessage: Uint8Array,
  nonce: Uint8Array,
): T {
  const decryptedStr = decryptMessage(senderX25519PublicKey, receiverEd25519SecretKey, securedMessage, nonce);
  return JSON.parse(decryptedStr) as T;
}

export function messageHash(message: Uint8Array, purpose: SignaturePurpose) {
  const signaturePrefixHash = new Uint8Array(sha3_256(`${SIGNATURE_PREFIX}::${purpose}::`));
  return new Uint8Array(sha3_256(concatUint8array(signaturePrefixHash, message)));
}

export function signWithEd25519SecretKey(
  message: Uint8Array,
  signingEd25519SecretKey: Ed25519SecretKey,
  purpose: SignaturePurpose,
) {
  return nacl.sign.detached(messageHash(message, purpose), signingEd25519SecretKey.key);
}

// This assumes that domain separation has already happened: this emulates the behavior of a hardware device
export function makeEd25519SecretKeySignCallbackNoDomainSeparation(
  signingEd25519SecretKey: Ed25519SecretKey,
): SignCallback {
  return async (message: Uint8Array) => nacl.sign.detached(message, signingEd25519SecretKey.key);
}

export function verifySignature(
  message: Uint8Array,
  signature: Uint8Array,
  signingEd25519PublicKey: Ed25519PublicKey,
  purpose: SignaturePurpose,
): boolean {
  return nacl.sign.detached.verify(messageHash(message, purpose), signature, signingEd25519PublicKey.key);
}

export function hashAndVerifySignature(
  message: string | Uint8Array,
  signature: Uint8Array,
  signingEd25519PublicKey: Ed25519PublicKey,
  purpose: SignaturePurpose,
): boolean {
  const messageUint8 = message instanceof Uint8Array ? message : new TextEncoder().encode(message);
  const messageUint8Hash = sha3_256(messageUint8);
  return verifySignature(messageUint8Hash, signature, signingEd25519PublicKey, purpose);
}
