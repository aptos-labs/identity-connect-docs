// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { SignMessageResponseBody, SignTransactionResponseBody } from '@identity-connect/api';
import { UnexpectedSignResponseError } from './errors';

const SIGN_MESSAGE_RESPONSE_REQUIRED_FIELDS: (keyof SignMessageResponseBody)[] = [
  'address',
  'application',
  'chainId',
  'fullMessage',
  'message',
  'nonce',
  'prefix',
  'signature',
];

export function validateSignMessageResponse(response: SignMessageResponseBody) {
  const providedFields = new Set(Object.keys(response));
  const missingFields = SIGN_MESSAGE_RESPONSE_REQUIRED_FIELDS.filter((field) => !providedFields.has(field));
  if (missingFields.length > 0) {
    throw new UnexpectedSignResponseError(missingFields);
  }
}

const SIGN_TRANSACTION_RESPONSE_REQUIRED_FIELDS: (keyof SignTransactionResponseBody)[] = [
  'hash',
  'signature',
  'version',
  'sender',
  'sequence_number',
];

export function validateSignAndSubmitTransactionResponse(response: SignTransactionResponseBody) {
  const providedFields = new Set(Object.keys(response));
  const missingFields = SIGN_TRANSACTION_RESPONSE_REQUIRED_FIELDS.filter((field) => !providedFields.has(field));
  if (missingFields.length > 0) {
    throw new UnexpectedSignResponseError(missingFields);
  }
}
