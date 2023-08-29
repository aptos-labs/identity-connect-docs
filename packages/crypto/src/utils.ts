// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import nacl from 'tweetnacl';

export enum KeyTypes {
  'Ed25519PublicKey' = 'Ed25519PublicKey',
  'Ed25519SecretKey' = 'Ed25519SecretKey',
  'X25519PublicKey' = 'X25519PublicKey',
  'X25519SecretKey' = 'X25519SecretKey',
}

export interface IKey<Type extends KeyTypes> {
  key: Uint8Array;
  type: Type;
}

export type X25519PublicKey = IKey<KeyTypes.X25519PublicKey>;
export type X25519SecretKey = IKey<KeyTypes.X25519SecretKey>;
export type X25519KeyPair = {
  publicKey: X25519PublicKey;
  secretKey: X25519SecretKey;
};

export type Ed25519PublicKey = IKey<KeyTypes.Ed25519PublicKey>;
export type Ed25519SecretKey = IKey<KeyTypes.Ed25519SecretKey>;
export type Ed25519KeyPair = {
  publicKey: Ed25519PublicKey;
  secretKey: Ed25519SecretKey;
};

export type RawKeyPair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

export function createX25519KeyPair(): X25519KeyPair {
  return keypairToX25519(nacl.box.keyPair());
}

export function createEd25519KeyPair(): Ed25519KeyPair {
  return keypairToEd25519(nacl.sign.keyPair());
}

export function toKey<Type extends KeyTypes = KeyTypes>(
  rawKey: Uint8Array,
  type: Type,
): Type extends KeyTypes.Ed25519PublicKey
  ? Ed25519PublicKey
  : Type extends KeyTypes.Ed25519SecretKey
  ? Ed25519SecretKey
  : Type extends KeyTypes.X25519PublicKey
  ? X25519PublicKey
  : Type extends KeyTypes.X25519SecretKey
  ? X25519SecretKey
  : never {
  return {
    key: rawKey,
    type,
  } as any;
}

export function keypairToEd25519(keyPair: RawKeyPair): Ed25519KeyPair {
  return {
    publicKey: toKey(keyPair.publicKey, KeyTypes.Ed25519PublicKey),
    secretKey: toKey(keyPair.secretKey, KeyTypes.Ed25519SecretKey),
  };
}

export function keypairToX25519(keyPair: RawKeyPair): X25519KeyPair {
  return {
    publicKey: toKey(keyPair.publicKey, KeyTypes.X25519PublicKey),
    secretKey: toKey(keyPair.secretKey, KeyTypes.X25519SecretKey),
  };
}

export function aptosAccountToEd25519Keypair(account: { signingKey: nacl.SignKeyPair }) {
  return ed25519KeypairFromSecret(account.signingKey.secretKey);
}

export function ed25519KeypairFromSecret(ed25519SecretKeyBytes: Uint8Array): Ed25519KeyPair {
  return keypairToEd25519(nacl.sign.keyPair.fromSeed(ed25519SecretKeyBytes.slice(0, 32)));
}

export function decodeBase64(base64Str: string): Uint8Array {
  if (globalThis.Buffer) {
    return new Uint8Array(Buffer.from(base64Str, 'base64'));
  }
  return Uint8Array.from(atob(base64Str), (m) => m.codePointAt(0)!);
}

export function encodeBase64(bytes: Uint8Array): string {
  if (globalThis.Buffer) {
    return Buffer.from(bytes).toString('base64');
  }
  return btoa(Array.from(bytes, (x) => String.fromCodePoint(x)).join(''));
}

export function concatUint8array(arrayOne: Uint8Array, arrayTwo: Uint8Array): Uint8Array {
  const mergedArray = new Uint8Array(arrayOne.length + arrayTwo.length);
  mergedArray.set(arrayOne);
  mergedArray.set(arrayTwo, arrayOne.length);
  return mergedArray;
}
