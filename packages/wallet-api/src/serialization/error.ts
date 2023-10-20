// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export class UnexpectedValueError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'UnexpectedValueError';
    Object.setPrototypeOf(this, UnexpectedValueError.prototype);
  }
}
