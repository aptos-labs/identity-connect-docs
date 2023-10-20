// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { SigningRequestStatus } from '@identity-connect/api';

export class SignatureRequestError extends Error {
  constructor(status: SigningRequestStatus) {
    super(status);
    this.name = 'SignatureRequestError';
    Object.setPrototypeOf(this, SignatureRequestError.prototype);
  }
}

export class UnexpectedSignatureResponseError extends Error {
  constructor(missingFields: string[]) {
    const message = `Missing the following fields: ${missingFields.join(', ')}`;
    super(message);
    this.name = 'UnexpectedSignatureResponseError';
    Object.setPrototypeOf(this, UnexpectedSignatureResponseError.prototype);
  }
}

export class PairingExpiredError extends Error {
  constructor() {
    super();
    this.name = 'PairingExpiredError';
    Object.setPrototypeOf(this, PairingExpiredError.prototype);
  }
}

export class UnregisteredDappError extends Error {
  constructor() {
    super('Dapp ID is invalid or not associated with a registered Dapp.');
    this.name = 'UnregisteredDappError';
    Object.setPrototypeOf(this, UnregisteredDappError.prototype);
  }
}
