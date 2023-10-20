// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { TxnBuilderTypes } from 'aptos';
import { JsonTransactionPayload } from '../jsonPayload';
import { TransactionOptions } from '../transactionOptions';

export interface SignTransactionWithPayloadRequestArgs {
  options?: TransactionOptions;
  payload: JsonTransactionPayload | TxnBuilderTypes.TransactionPayload;
}

export interface SignTransactionWithRawTxnRequestArgs {
  rawTxn:
    | TxnBuilderTypes.RawTransaction
    | TxnBuilderTypes.FeePayerRawTransaction
    | TxnBuilderTypes.MultiAgentRawTransaction;
}

export type SignTransactionRequestArgs = SignTransactionWithPayloadRequestArgs | SignTransactionWithRawTxnRequestArgs;
