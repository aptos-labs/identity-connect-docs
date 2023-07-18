// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { HexString } from 'aptos';
import nacl from 'tweetnacl';
import { encryptAndSignEnvelope, decryptEnvelope, deserializeTransportEnvelope } from '../securedEnvelope';
import { EnvelopeMessageMismatchError } from '../errors';
import { decryptObject, encryptObject } from '../encrDecr';
import {
  createEd25519KeyPair,
  decodeBase64,
  ed25519KeypairFromSecret,
  keypairToEd25519,
  keypairToX25519,
  KeyTypes,
  toKey,
} from '../utils';

const TEST_MESSAGE_PUBLIC = {
  content: 'Hello, world!',
};

const TEST_MESSAGE_PRIVATE = {
  private: true,
};

describe('Encrypts and decrypts', () => {
  it('should encrypt and then decrypt with Ed25519 (ephemeral sender x25519)', () => {
    const k1 = createEd25519KeyPair();
    const k2 = ed25519KeypairFromSecret(k1.secretKey.key.slice(0, 32));

    expect(k1.secretKey.key).toEqual(k2.secretKey.key);
  });

  it('should encrypt and then decrypt with Ed25519 (ephemeral sender x25519)', () => {
    const receiverEd25519KeyPair = keypairToEd25519(
      nacl.sign.keyPair.fromSeed(
        HexString.ensure('0x9db6d578a3cd65c35873408d578ac7c5e5e8ae19d0441870f19f383fbbe063ff').toUint8Array(),
      ),
    );
    const senderEphemeralX25519KeyPair = keypairToX25519(
      nacl.box.keyPair.fromSecretKey(
        HexString.ensure('0x3bdb40d535c4f578055b7d7be4c45213dab6161aa239224cb6fcd7b4a8af243e').toUint8Array(),
      ),
    );

    const encryptedObject = encryptObject(
      senderEphemeralX25519KeyPair.secretKey,
      receiverEd25519KeyPair.publicKey,
      TEST_MESSAGE_PUBLIC,
    );

    const decryptedObject = decryptObject<typeof TEST_MESSAGE_PUBLIC>(
      senderEphemeralX25519KeyPair.publicKey,
      receiverEd25519KeyPair.secretKey,
      encryptedObject.secured,
      encryptedObject.nonce,
    );

    expect(decryptedObject).toEqual(TEST_MESSAGE_PUBLIC);
  });

  it('should encrypt envelope with Ed25519 (ephemeral sender x25519)', () => {
    const senderEd25519KeyPair = createEd25519KeyPair();
    const receiverEd25519KeyPair = createEd25519KeyPair();

    const secured = encryptAndSignEnvelope(
      senderEd25519KeyPair.secretKey,
      senderEd25519KeyPair.publicKey,
      receiverEd25519KeyPair.publicKey,
      0,
      TEST_MESSAGE_PUBLIC,
      TEST_MESSAGE_PRIVATE,
    );

    const { publicMessage } = deserializeTransportEnvelope(secured);
    const senderEphemeralX25519PublicKeyBytes = decodeBase64(publicMessage._metadata.senderX25519PublicKeyB64);
    const senderEphemeralX25519PublicKey = toKey(senderEphemeralX25519PublicKeyBytes, KeyTypes.X25519PublicKey);

    const decrypted = decryptObject<typeof TEST_MESSAGE_PRIVATE>(
      senderEphemeralX25519PublicKey,
      receiverEd25519KeyPair.secretKey,
      decodeBase64(secured.encryptedPrivateMessage.securedB64),
      decodeBase64(secured.encryptedPrivateMessage.nonceB64),
    );
    expect(decrypted).toStrictEqual(TEST_MESSAGE_PRIVATE);
  });

  it('should encrypt and then decrypt envelope with Ed25519 (ephemeral sender x25519)', async () => {
    const senderEd25519KeyPair = createEd25519KeyPair();
    const receiverEd25519KeyPair = createEd25519KeyPair();

    const secured = await encryptAndSignEnvelope(
      senderEd25519KeyPair.secretKey,
      senderEd25519KeyPair.publicKey,
      receiverEd25519KeyPair.publicKey,
      0,
      TEST_MESSAGE_PUBLIC,
      TEST_MESSAGE_PRIVATE,
    );

    const decrypted = decryptEnvelope<typeof TEST_MESSAGE_PUBLIC, typeof TEST_MESSAGE_PRIVATE>(
      senderEd25519KeyPair.publicKey,
      receiverEd25519KeyPair.secretKey,
      secured,
    );

    expect(decrypted.publicMessage.content).toEqual(TEST_MESSAGE_PUBLIC.content);
    expect(decrypted.privateMessage.private).toEqual(TEST_MESSAGE_PRIVATE.private);
  });

  it('should not decrypt with the wrong keyPair', () => {
    const senderEd25519KeyPair = createEd25519KeyPair();
    const receiverEd25519KeyPair = createEd25519KeyPair();
    const wrongKeyPair = createEd25519KeyPair();

    const secured = encryptAndSignEnvelope(
      senderEd25519KeyPair.secretKey,
      senderEd25519KeyPair.publicKey,
      receiverEd25519KeyPair.publicKey,
      0,
      TEST_MESSAGE_PUBLIC,
      TEST_MESSAGE_PRIVATE,
    );

    expect(() => {
      decryptEnvelope(senderEd25519KeyPair.publicKey, wrongKeyPair.secretKey, secured);
    }).toThrow('Could not decrypt message');
  });

  it('should explode if the public metadata is tampered with', () => {
    const senderEd25519KeyPair = createEd25519KeyPair();
    const receiverEd25519KeyPair = createEd25519KeyPair();

    const secured = encryptAndSignEnvelope(
      senderEd25519KeyPair.secretKey,
      senderEd25519KeyPair.publicKey,
      receiverEd25519KeyPair.publicKey,
      0,
      TEST_MESSAGE_PUBLIC,
      TEST_MESSAGE_PRIVATE,
    );
    const publicMessage = JSON.parse(secured.serializedPublicMessage);
    publicMessage._metadata.sequence = 1337;
    secured.serializedPublicMessage = JSON.stringify(publicMessage);
    expect(() => {
      decryptEnvelope(senderEd25519KeyPair.publicKey, receiverEd25519KeyPair.secretKey, secured);
    }).toThrow(EnvelopeMessageMismatchError);
  });

  it('should explode if the private/public message contains same keys', () => {
    const senderEd25519KeyPair = createEd25519KeyPair();
    const receiverEd25519KeyPair = createEd25519KeyPair();

    expect(() =>
      encryptAndSignEnvelope(
        senderEd25519KeyPair.secretKey,
        senderEd25519KeyPair.publicKey,
        receiverEd25519KeyPair.publicKey,
        0,
        // @ts-ignore - required for the test
        TEST_MESSAGE_PUBLIC,
        { ...TEST_MESSAGE_PRIVATE, content: 'Oh No!' },
      ),
    ).toThrow(EnvelopeMessageMismatchError);
  });
});
