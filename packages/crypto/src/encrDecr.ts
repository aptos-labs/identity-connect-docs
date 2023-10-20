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
  KeyTypes,
  toKey,
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

/**
 * Converts an Ed25519 public key to an X25519 public key
 * HERE THERE BE DRAGONS. ONLY USE THIS IF YOU KNOW WHAT YOU ARE DOING.
 * @param ed25519PublicKey The Ed25519 public key to convert
 * @param errorKeyName The name of the key to use in error messages
 */
export function convertEd25519PublicKeyToX25519PublicKey(
  ed25519PublicKey: Ed25519PublicKey,
  errorKeyName: string,
): X25519PublicKey {
  const x25519PublicKey = ed2curve.convertPublicKey(ed25519PublicKey.key.slice(0, 32));
  if (!x25519PublicKey) throw new Error(`${errorKeyName} is not a valid Ed25519 public key`);
  return toKey(x25519PublicKey, KeyTypes.X25519PublicKey);
}

/**
 * Converts an Ed25519 secret key to an X25519 secret key
 * HERE THERE BE DRAGONS. ONLY USE THIS IF YOU KNOW WHAT YOU ARE DOING.
 * @param ed25519SecretKey The Ed25519 secret key to convert
 */
export function convertEd25519SecretKeyToX25519SecretKey(ed25519SecretKey: Ed25519SecretKey): X25519SecretKey {
  const x25519SecretKey = ed2curve.convertSecretKey(ed25519SecretKey.key.slice(0, 32));
  return toKey(x25519SecretKey, KeyTypes.X25519SecretKey);
}
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

/**
 * Decrypts a `SerializedEncryptionResult` to an object
 * Uses the sender's X25519 public key and receiver's Ed25519 secret key
 * The receivers Ed25519 secret key is converted to an X25519 secret key for the Diffie-Hellman key exchange
 * @param senderX25519PublicKey The sender's X25519 public key
 * @param receiverEd25519SecretKey The receiver's Ed25519 secret key
 * @param enc The serialized encryption result
 */
export function decryptSerializedEncryptionResult<T>(
  senderX25519PublicKey: X25519PublicKey,
  receiverEd25519SecretKey: Ed25519SecretKey,
  enc: SerializedEncryptionResult,
): T {
  const des = deserializeEncryptionResult(enc);
  return decryptObject<T>(senderX25519PublicKey, receiverEd25519SecretKey, des.secured, des.nonce);
}

/**
 * Decrypts a `SerializedEncryptionResult` to an object
 * Uses the sender's X25519 public key and receiver's X25519 secret key
 * @param senderX25519PublicKey The sender's X25519 public key
 * @param receiverX25519SecretKey The receiver's X25519 secret key
 * @param enc The serialized encryption result
 */
export function decryptSerializedEncryptionResultDirect<T>(
  senderX25519PublicKey: X25519PublicKey,
  receiverX25519SecretKey: X25519SecretKey,
  enc: SerializedEncryptionResult,
): T {
  const des = deserializeEncryptionResult(enc);
  return decryptObjectDirect<T>(senderX25519PublicKey, receiverX25519SecretKey, des.secured, des.nonce);
}

/**
 * Encrypts a string, by using the sender's X25519 secret key and receiver's Ed25519 public key
 * The receiver's Ed25519 public key is converted to an X25519 public key for the Diffie-Hellman key exchange
 * @param senderX25519SecretKey The sender's X25519 secret key
 * @param receiverEd25519PublicKey The receiver's Ed25519 public key
 * @param message The message to encrypt
 */
export function encryptMessage(
  senderX25519SecretKey: X25519SecretKey,
  receiverEd25519PublicKey: Ed25519PublicKey,
  message: string,
): EncryptionResult {
  // Encrypt the message with the receiver's public key and sender's secret key
  const receiverX25519PublicKey = convertEd25519PublicKeyToX25519PublicKey(
    receiverEd25519PublicKey,
    'receiver public key',
  );
  return encryptMessageDirect(senderX25519SecretKey, receiverX25519PublicKey, message);
}

/**
 * Encrypts a string, by using the sender's X25519 secret key and receiver's X25519 public key
 * @param senderX25519SecretKey The sender's X25519 secret key
 * @param receiverX25519PublicKey The receiver's X25519 public key
 * @param message The message to encrypt
 */
export function encryptMessageDirect(
  senderX25519SecretKey: X25519SecretKey,
  receiverX25519PublicKey: X25519PublicKey,
  message: string,
): EncryptionResult {
  // Generate a random nonce
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  // Convert the message to a Uint8Array
  const messageUint8 = new TextEncoder().encode(message);

  const secured = nacl.box(messageUint8, nonce, receiverX25519PublicKey.key, senderX25519SecretKey.key.slice(0, 32));

  return { nonce, secured };
}

/**
 * Encrypts an object to a string, by using the sender's X25519 secret key and receiver's Ed25519 public key
 * The receiver's Ed25519 public key is converted to an X25519 public key for the Diffie-Hellman key exchange
 * @param senderX25519SecretKey The sender's X25519 secret key
 * @param receiverEd25519PublicKey The receiver's Ed25519 public key
 * @param message The message to encrypt
 */
export function encryptObject<T>(
  senderX25519SecretKey: X25519SecretKey,
  receiverEd25519PublicKey: Ed25519PublicKey,
  message: T,
): EncryptionResult {
  const receiverX25519PublicKey = convertEd25519PublicKeyToX25519PublicKey(
    receiverEd25519PublicKey,
    'receiver public key',
  );
  return encryptObjectDirect(senderX25519SecretKey, receiverX25519PublicKey, message);
}

/**
 * Encrypts an object to a string, by using the sender's X25519 secret key and receiver's X25519 public key
 * @param senderX25519SecretKey The sender's X25519 secret key
 * @param receiverX25519PublicKey The receiver's X25519 public key
 * @param message The message to encrypt
 */
export function encryptObjectDirect<T>(
  senderX25519SecretKey: X25519SecretKey,
  receiverX25519PublicKey: X25519PublicKey,
  message: T,
): EncryptionResult {
  return encryptMessageDirect(senderX25519SecretKey, receiverX25519PublicKey, JSON.stringify(message));
}

/**
 * Decrypts a string, by using the sender's X25519 public key and receiver's Ed25519 secret key
 * The receivers Ed25519 secret key is converted to an X25519 secret key for the Diffie-Hellman key exchange
 * @param senderX25519PublicKey The sender's X25519 public key
 * @param receiverEd25519SecretKey The receiver's Ed25519 secret key
 * @param securedMessage The message to decrypt
 * @param nonce The nonce used to encrypt the message
 */
export function decryptMessage(
  senderX25519PublicKey: X25519PublicKey,
  receiverEd25519SecretKey: Ed25519SecretKey,
  securedMessage: Uint8Array,
  nonce: Uint8Array,
): string {
  // Decrypt the message with the receiver's secret key and sender's public key
  const receiverX25519SecretKey = convertEd25519SecretKeyToX25519SecretKey(receiverEd25519SecretKey);
  return decryptMessageDirect(senderX25519PublicKey, receiverX25519SecretKey, securedMessage, nonce);
}

/**
 * Decrypts a string, by using the sender's X25519 public key and receiver's X25519 secret key
 * @param senderX25519PublicKey The sender's X25519 public key
 * @param receiverX25519SecretKey The receiver's X25519 secret key
 * @param securedMessage The message to decrypt
 * @param nonce The nonce used to encrypt the message
 */
export function decryptMessageDirect(
  senderX25519PublicKey: X25519PublicKey,
  receiverX25519SecretKey: X25519SecretKey,
  securedMessage: Uint8Array,
  nonce: Uint8Array,
): string {
  let decryptedUint8;
  try {
    decryptedUint8 = nacl.box.open(
      securedMessage,
      nonce,
      senderX25519PublicKey.key.slice(0, 32),
      receiverX25519SecretKey.key.slice(0, 32),
    );
  } catch (e: any) {
    throw new DecryptionError(`Could not decrypt message: ${e.message}`);
  }
  if (!decryptedUint8) throw new DecryptionError('Could not decrypt message');

  // Convert the decrypted Uint8Array back to a string
  return new TextDecoder().decode(decryptedUint8);
}

/**
 * Decrypts an object, by using the sender's X25519 public key and receiver's Ed25519 secret key
 * The receivers Ed25519 secret key is converted to an X25519 secret key for the Diffie-Hellman key exchange
 * @param senderX25519PublicKey The sender's X25519 public key
 * @param receiverEd25519SecretKey The receiver's Ed25519 secret key
 * @param securedMessage The message to decrypt
 * @param nonce The nonce used to encrypt the message
 */
export function decryptObject<T>(
  senderX25519PublicKey: X25519PublicKey,
  receiverEd25519SecretKey: Ed25519SecretKey,
  securedMessage: Uint8Array,
  nonce: Uint8Array,
): T {
  const receiverX25519SecretKey = convertEd25519SecretKeyToX25519SecretKey(receiverEd25519SecretKey);
  return decryptObjectDirect<T>(senderX25519PublicKey, receiverX25519SecretKey, securedMessage, nonce);
}

/**
 * Decrypts an object, by using the sender's X25519 public key and receiver's X25519 secret key
 * @param senderX25519PublicKey The sender's X25519 public key
 * @param receiverX25519SecretKey The receiver's X25519 secret key
 * @param securedMessage The message to decrypt
 * @param nonce The nonce used to encrypt the message
 */
export function decryptObjectDirect<T>(
  senderX25519PublicKey: X25519PublicKey,
  receiverX25519SecretKey: X25519SecretKey,
  securedMessage: Uint8Array,
  nonce: Uint8Array,
): T {
  const decryptedStr = decryptMessageDirect(senderX25519PublicKey, receiverX25519SecretKey, securedMessage, nonce);
  return JSON.parse(decryptedStr) as T;
}

/**
 * Hashes a message with a purpose-specific prefix using SHA-3 256-bit algorithm.
 * The purpose prefix is constructed as `'APTOS::IDENTITY_CONNECT' + '::' + purpose + '::'`
 * This is to prevent hash collisions with other services, uses, and purposes
 * @param message The message to hash as a Uint8Array.
 * @param purpose The purpose of the signature.
 * @returns Uint8Array The hashed message as a Uint8Array
 */
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
