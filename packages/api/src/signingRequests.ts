// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

/**
 * This file contains strong types for what's expected to be contained in the body of encrypted envelopes
 * of a signing request flow.
 * I'm keeping this separated from the schema, as they're obtained by processing requests and responses.
 * In the future we can use discriminated unions and better typing for better integration.
 */

import { TxnBuilderTypes, Types } from 'aptos';
import { JsonPayload } from './serialization';

export interface SignMessageRequestBody {
  address?: boolean;
  application?: boolean;
  chainId?: boolean;
  message: string;
  nonce: string;
}

export interface SignMessageResponseBody {
  address: string;
  application: string;
  chainId: number;
  fullMessage: string;
  message: string;
  nonce: string;
  prefix: string;
  signature: string;
}

export type SignTransactionRequestBody = JsonPayload | TxnBuilderTypes.TransactionPayload | string;
export type SignTransactionResponseBody = Types.UserTransaction;

export type SignRequestBody = SignMessageRequestBody | SignTransactionRequestBody;
export type SignResponseBody = SignMessageResponseBody | SignTransactionResponseBody;
