// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export class EncryptionEnvelopeError extends Error {}

export class EnvelopeMessageMismatchError extends EncryptionEnvelopeError {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'EnvelopeMessageMismatchError';
    Object.setPrototypeOf(this, EnvelopeMessageMismatchError.prototype);
  }
}

export class DecryptionError extends EncryptionEnvelopeError {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
    Object.setPrototypeOf(this, DecryptionError.prototype);
  }
}
