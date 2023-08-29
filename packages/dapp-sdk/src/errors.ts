// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { SigningRequestStatus } from '@identity-connect/api';

export class SignRequestError extends Error {
  constructor(status: SigningRequestStatus) {
    super(status);
    this.name = 'SignRequestError';
    Object.setPrototypeOf(this, SignRequestError.prototype);
  }
}

export class UnexpectedSignResponseError extends Error {
  constructor(missingFields: string[]) {
    const message = `Missing the following fields: ${missingFields.join(', ')}`;
    super(message);
    this.name = 'UnexpectedSignResponseError';
    Object.setPrototypeOf(this, UnexpectedSignResponseError.prototype);
  }
}

export class PairingExpiredError extends Error {
  constructor() {
    super();
    this.name = 'PairingExpiredError';
    Object.setPrototypeOf(this, PairingExpiredError.prototype);
  }
}
