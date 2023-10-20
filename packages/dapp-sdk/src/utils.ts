// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { SignAndSubmitTransactionResponseArgs, SignMessageResponseArgs } from '@identity-connect/wallet-api';
import { UnexpectedSignatureResponseError } from './errors';

const SIGN_MESSAGE_RESPONSE_REQUIRED_FIELDS: (keyof SignMessageResponseArgs)[] = [
  'address',
  'application',
  'chainId',
  'fullMessage',
  'message',
  'nonce',
  'prefix',
  'signature',
];

export function validateSignMessageResponse(response: SignMessageResponseArgs) {
  const providedFields = new Set(Object.keys(response));
  const missingFields = SIGN_MESSAGE_RESPONSE_REQUIRED_FIELDS.filter((field) => !providedFields.has(field));
  if (missingFields.length > 0) {
    throw new UnexpectedSignatureResponseError(missingFields);
  }
}

const SIGN_AND_SUBMIT_TRANSACTION_RESPONSE_REQUIRED_FIELDS: (keyof SignAndSubmitTransactionResponseArgs)[] = ['hash'];

export function validateSignAndSubmitTransactionResponse(response: SignAndSubmitTransactionResponseArgs) {
  const providedFields = new Set(Object.keys(response));
  const missingFields = SIGN_AND_SUBMIT_TRANSACTION_RESPONSE_REQUIRED_FIELDS.filter(
    (field) => !providedFields.has(field),
  );
  if (missingFields.length > 0) {
    throw new UnexpectedSignatureResponseError(missingFields);
  }
}
