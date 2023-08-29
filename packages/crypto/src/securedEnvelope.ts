// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { sha3_256 } from '@noble/hashes/sha3';
import { HexString } from 'aptos';
import {
  createX25519KeyPair,
  decodeBase64,
  Ed25519PublicKey,
  Ed25519SecretKey,
  encodeBase64,
  X25519KeyPair,
  KeyTypes,
  toKey,
  X25519PublicKey,
} from './utils';
import { EnvelopeMessageMismatchError } from './errors';
import {
  SerializedEncryptionResult,
  SignCallback,
  decryptObject,
  encryptObject,
  serializeEncryptionResult,
  deserializeEncryptionResult,
  verifySignature,
  signWithEd25519SecretKey,
} from './encrDecr';

/**
 * When sending messages back and forth, there are some things that Identity Connect must know to function and provide
 * security for users, and dApps and wallets need to know that any messages sent to one another were sent (and
 * received) by the expected parties.
 *
 * To allow for secure communication between parties, we are introducing the
 * *SecuredEnvelope*. This envelope provides a secure channel for parties to encrypt private messages, *and*
 * authenticate one another, while allowing IC to route requests and block invalid messages.
 *
 * The envelope can be thought of as a wrapper around the JSON payload of a POST/PUT request T, and has two parts:
 * `messagePrivate`: This contains some of the parameters of `T`, which will be signed by the sender and encrypted
 *                   with the recipient's public key.
 * `publicMessage`: This field is sent unencrypted, but signed so that the IC endpoint can do basic validation before
 *                  processing. The parameters in `publicMessage` are DISJOINT from `messagePrivate`, and are invalid
 *                  otherwise: there are no keys in `messagePrivate` that also appear in `publicMessage`. It must
 *                  contain a ``_metadata`` field with security features like the timestamp, public keys, sequence
 *                  number, etc.
 *
 * Both IC and dApps can verify, on chain, that the senders’ keys match their address and that they are speaking
 * with who they expect. Encryption is done with an X25519 key derived from the ED25519 PublicKey of the wallet
 * account that is connecting (this allows for seamless cross-device account access), and an ephemeral X25519 KeyPair,
 * of which the SecretKey is thrown away after encryption. Decryption uses the X25519 key derived from the receiver
 * ED25519 SecretKey.
 *
 * Account private keys Ska (and their counterpart X25519 keys) are only used to decrypt and sign:
 * THEY ARE NEVER USED TO ENCRYPT!
 *
 * Operations follow the Cryptographic Doom Principle:
 *   Always verify the signature of the message before any other cryptographic operations
 * https://moxie.org/2011/12/13/the-cryptographic-doom-principle.html
 *
 *
 * To send a `SecuredEnvelope` over the wire, it must first be turned into a `SecuredEnvelopeTransport` - this
 * involves:
 * 1. Encrypting and serializing the `privateMessage` field to an `encryptedPrivateMessage`field.
 *     a. Generate ephemeral X25519 sender keypair `xPkse/xSkse`. The `xPkse` becomes the `senderX25519PublicKeyB64` in
 *      the `EnvelopeMetadata`.
 *     b. Convert the `receiverEd25519PublicKey` to a `receiverX25519PublicKey` - `xPkr`
 *     c. Generate a random `nonce` for the `[nacl.box](http://nacl.box)` encryption
 *     d. Encrypt the `privateMessage` using `[nacl.box](http://nacl.box)` with the `xSkse` and `xPkr`
 *     e. Package this encrypted data, and the `nonce`, into a `SerializedEncryptionResult`
 * 2. JSON serializing the `publicMessage` field into a `serializedPublicMessage`. We don’t care about canonical
 *    serialization/ordering as the sender signs over this serialized string.
 * 3.  Now that we have the private `encryptedPrivateMessage` and public `serializedPublicMessage` we can generate the
 *    `messageSignature`:
 *     a. Hash the `SHA3-256(encryptedPublicMessage)` to get `publicMessageHash`
 *     b. Hash the `SHA3-256(encryptedPrivateMessage)` to get `privateMessageHash`
 *     c. Hash `SHA3-256(publicMessageHash | privateMessageHash)` to get `combinedMessageHash`
 *     d. Get the `domainSeparatedMessageHash` by hashing the `combinedMessageHash` with a domain separator:
 *        `SHA3-256(SHA3-256('APTOS::IDENTITY_CONNECT::') | combinedMessageHash)`
 *     e. To obtain the final `messageSignature`, we sign the `domainSeparatedMessageHash` with the Ed25519 private
 *        key of the sender, and hex encode it.
 * 4. This creates the final `SecuredEnvelopeTransport` object, ready to be JSON serialized and sent in an HTTP
 *    request
 */

export const REQUIRED_FIELDS: (keyof EnvelopeMetadata)[] = [
  'receiverEd25519PublicKeyB64',
  'senderEd25519PublicKeyB64',
  'senderX25519PublicKeyB64',
  'sequence',
  'timestampMillis',
].sort() as (keyof EnvelopeMetadata)[];

// The publicMessage._metadata field looks like this:
export type EnvelopeMetadata = {
  // The receiver's public key, base64
  receiverEd25519PublicKeyB64: string;
  // The sender public key, base64
  senderEd25519PublicKeyB64: string;
  // The senders X25519 public key, base64
  senderX25519PublicKeyB64: string;
  // The sequence of the sender.
  // This number only goes up, to prevent relay attacks
  // This exists per pairing
  // dApps, wallets, accounts, etc are expected to keep track of them
  // IC will reject out-of-order sequence numbers
  sequence: number;
  // The timestamp this message was sent at
  // IC will reject if it's in the future or older than 5 minutes
  timestampMillis: number;
};

export interface IEnvelopeMetadata extends Message {
  _metadata: EnvelopeMetadata;
}

// A message- whether the `Public` or `Private` component- is a JSON object.
// As such, we know that the keys are strings, and the values are any JSON-serializable type ('unknown')
export type Message = Record<string, unknown>;

export type SecuredEnvelope<Public extends Message> = {
  encryptedPrivateMessage: SerializedEncryptionResult;
  messageSignature: string;
  publicMessage: Public & IEnvelopeMetadata;
};

export type SecuredEnvelopeTransport = {
  encryptedPrivateMessage: SerializedEncryptionResult;
  messageSignature: string;
  serializedPublicMessage: string;
};

export type DecryptedEnvelope<
  Public extends Message & { [K in keyof Private]?: never },
  Private extends Message & { [K in keyof Public]?: never },
> = {
  messageSignature: string;
  privateMessage: Private;
  publicMessage: Public & IEnvelopeMetadata;
};

export type DeserializedTransportEnvelope<Public extends Message> = SecuredEnvelopeTransport & SecuredEnvelope<Public>;

export type SignCallbackOrEd25519SecretKey = SignCallback | Ed25519SecretKey;

export function ensurePrivatePublicFieldsDisjoint<
  Public extends Message & { [K in keyof Private]?: never },
  Private extends Message & { [K in keyof Public]?: never },
>(privateMessage: Private, publicMessage: Public) {
  // gets all fields in privateMessage that are also in publicMessage
  const intersection = Object.keys(privateMessage).filter((x) => Object.keys(publicMessage).includes(x));
  if (intersection.length > 0) {
    const field = intersection[0];
    throw new EnvelopeMessageMismatchError(`Field ${field} appears in both private and public message fields`, field);
  }
}

export function ensureMetadataFields(message: EnvelopeMetadata) {
  // ensure ONLY the fields in REQUIRED_FIELDS are present in message. Sort asc.
  const messageKeys = Object.keys(message).sort();
  const extraFields = messageKeys.filter((key) => !REQUIRED_FIELDS.includes(key as any));
  const missingFields = REQUIRED_FIELDS.filter((key) => !messageKeys.includes(key as any));
  if (extraFields.length > 0 || missingFields.length > 0) {
    let extraFieldsStr = extraFields.length > 0 ? `extra(${extraFields.join(', ')})` : '';
    const missingFieldsStr = missingFields.length > 0 ? `missing(${missingFields.join(', ')})` : '';
    extraFieldsStr = extraFieldsStr.length > 0 && missingFieldsStr.length > 0 ? `${extraFieldsStr}, ` : extraFieldsStr;
    throw new EnvelopeMessageMismatchError(
      `PublicMessage metadata fields do not conform to spec: ${extraFieldsStr}${missingFieldsStr}`,
      '_metadata',
    );
  }
}

export function deserializeTransportEnvelope<Public extends Message>(
  transportEnvelope: SecuredEnvelopeTransport,
): DeserializedTransportEnvelope<Public> {
  const publicMessage = JSON.parse(transportEnvelope.serializedPublicMessage) as Public & IEnvelopeMetadata;
  return {
    ...transportEnvelope,
    publicMessage,
  };
}

// This signs with the senders ed25519 private key,
// but encrypts with an ephemeral X25519 keyPair + the receivers x25519 public key (converted from their ed25519 key)
// This is so that the private key IS ONLY EVER USED FOR DECRYPTION, NEVER FOR ENCRYPTION
export function encryptAndSignEnvelope<
  Public extends Message & { [K in keyof Private]?: never },
  Private extends Message & { [K in keyof Public]?: never },
>(
  senderEd25519SecretKey: Ed25519SecretKey,
  senderEd25519PublicKey: Ed25519PublicKey,
  receiverEd25519PublicKey: Ed25519PublicKey,
  sequence: number,
  publicMessage: Public,
  privateMessage: Private,
): SecuredEnvelopeTransport {
  const senderEphemeralX25519KeyPair = createX25519KeyPair();
  const metadata = constructMetadata(
    senderEd25519PublicKey,
    receiverEd25519PublicKey,
    sequence,
    senderEphemeralX25519KeyPair.publicKey,
  );

  ensureMetadataFields(metadata);
  ensurePrivatePublicFieldsDisjoint<Public, Private>(privateMessage, publicMessage);

  return dangerouslyEncryptAndSignEnvelopeUnvalidated(
    senderEd25519SecretKey,
    receiverEd25519PublicKey,
    metadata,
    privateMessage,
    publicMessage,
    senderEphemeralX25519KeyPair,
  );
}

export function constructMetadata(
  senderEd25519PublicKey: Ed25519PublicKey,
  receiverEd25519PublicKey: Ed25519PublicKey,
  sequence: number,
  senderEphemeralX25519PublicKey: X25519PublicKey,
): EnvelopeMetadata {
  // This is used for SIGNING ONLY!
  return {
    receiverEd25519PublicKeyB64: encodeBase64(receiverEd25519PublicKey.key),
    senderEd25519PublicKeyB64: encodeBase64(senderEd25519PublicKey.key),
    senderX25519PublicKeyB64: encodeBase64(senderEphemeralX25519PublicKey.key),
    sequence,
    timestampMillis: Date.now(),
  };
}

export function dangerouslyEncryptAndSignEnvelopeUnvalidated<
  Public extends Message & { [K in keyof Private]?: never },
  Private extends Message & { [K in keyof Public]?: never },
>(
  senderEd25519SecretKey: Ed25519SecretKey,
  receiverEd25519PublicKey: Ed25519PublicKey,
  metadata: EnvelopeMetadata,
  privateMessage: Private,
  publicMessage: Public,
  senderEphemeralX25519KeyPair: X25519KeyPair,
): SecuredEnvelopeTransport {
  const encryptionResult = encryptObject(
    senderEphemeralX25519KeyPair.secretKey,
    receiverEd25519PublicKey,
    privateMessage,
  );
  const encryptedPrivateMessage = serializeEncryptionResult(encryptionResult);
  const encryptedPrivateMessageBytes = decodeBase64(encryptedPrivateMessage.securedB64);
  const serializedPublicMessage = JSON.stringify({ ...publicMessage, _metadata: metadata });
  const publicMessageBytes = new TextEncoder().encode(serializedPublicMessage);
  const messageSignature = signEnvelope(publicMessageBytes, encryptedPrivateMessageBytes, senderEd25519SecretKey);
  return {
    encryptedPrivateMessage,
    messageSignature,
    serializedPublicMessage,
  };
}

function combineHashedEnvelopeMessageBytes(
  publicMessageBytes: Uint8Array,
  privateMessageBytes: Uint8Array,
): Uint8Array {
  const publicMessageBytesHash = sha3_256(publicMessageBytes);
  const privateMessageBytesHash = sha3_256(privateMessageBytes);
  // Concatenate the two hashes
  const combinedHash = new Uint8Array(publicMessageBytesHash.length + privateMessageBytesHash.length);
  combinedHash.set(publicMessageBytesHash);
  combinedHash.set(privateMessageBytesHash, publicMessageBytesHash.length);
  // Hash and return
  return sha3_256(combinedHash);
}

function signEnvelope(
  publicMessageBytes: Uint8Array,
  privateMessageBytes: Uint8Array,
  senderEd25519SecretKey: Ed25519SecretKey,
) {
  const messageHashBytes = combineHashedEnvelopeMessageBytes(publicMessageBytes, privateMessageBytes);
  const signatureBytes = signWithEd25519SecretKey(messageHashBytes, senderEd25519SecretKey, 'SECURED_ENVELOPE');
  return HexString.fromUint8Array(signatureBytes).hex();
}

export function verifyEnvelopeSignature(
  publicMessageBytes: Uint8Array,
  privateMessageBytes: Uint8Array,
  messageSignature: string,
  senderEd25519PublicKey: Ed25519PublicKey,
) {
  const messageSignatureBytes = HexString.ensure(messageSignature).toUint8Array();
  const messageHashBytes = combineHashedEnvelopeMessageBytes(publicMessageBytes, privateMessageBytes);
  const messageVerified = verifySignature(
    messageHashBytes,
    messageSignatureBytes,
    senderEd25519PublicKey,
    'SECURED_ENVELOPE',
  );
  if (!messageVerified) {
    throw new EnvelopeMessageMismatchError('Could not verify SecuredEnvelope signature', 'messageSignature');
  }
}

export function decryptEnvelope<
  Public extends Message & { [K in keyof Private]?: never },
  Private extends Message & { [K in keyof Public]?: never },
>(
  senderEd25519PublicKey: Ed25519PublicKey,
  receiverEd25519SecretKey: Ed25519SecretKey,
  message: SecuredEnvelopeTransport,
): DecryptedEnvelope<Public, Private> {
  const { encryptedPrivateMessage, messageSignature, serializedPublicMessage } = message;
  const publicMessage = JSON.parse(serializedPublicMessage) as Public & IEnvelopeMetadata;

  // Ensure the private/public message signature matches the expected signature
  const rawPrivateMessage = decodeBase64(encryptedPrivateMessage.securedB64);
  const rawPublicMessage = new TextEncoder().encode(serializedPublicMessage);
  verifyEnvelopeSignature(rawPublicMessage, rawPrivateMessage, messageSignature, senderEd25519PublicKey);

  // Ensure the public key matches the expected public key
  const senderEd25519PublicKeyB64 = encodeBase64(senderEd25519PublicKey.key);
  const expectedPublicKeyB64 = publicMessage._metadata.senderEd25519PublicKeyB64;
  if (senderEd25519PublicKeyB64 !== expectedPublicKeyB64) {
    throw new EnvelopeMessageMismatchError(
      'senderEd25519PublicKey in envelope does not match provided receiverEd25519SecretKey',
      'senderPublicKey',
    );
  }

  const senderX25519PublicKeyBytes = decodeBase64(publicMessage._metadata.senderX25519PublicKeyB64);
  const senderX25519PublicKey = toKey(senderX25519PublicKeyBytes, KeyTypes.X25519PublicKey);
  const encryptionResult = deserializeEncryptionResult(encryptedPrivateMessage);
  const privateMessage = decryptObject<Private>(
    senderX25519PublicKey,
    receiverEd25519SecretKey,
    encryptionResult.secured,
    encryptionResult.nonce,
  );

  ensureMetadataFields(publicMessage._metadata);
  ensurePrivatePublicFieldsDisjoint(privateMessage, publicMessage);

  return {
    messageSignature,
    privateMessage,
    publicMessage,
  };
}
