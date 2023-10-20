// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { TxnBuilderTypes } from 'aptos';
import { JsonTransactionPayload } from '../jsonPayload';
import { TransactionOptions } from '../transactionOptions';

export interface SignAndSubmitTransactionWithPayloadRequestArgs {
  options?: TransactionOptions;
  payload: JsonTransactionPayload | TxnBuilderTypes.TransactionPayload;
}

export interface SignAndSubmitTransactionWithRawTxnRequestArgs {
  rawTxn: TxnBuilderTypes.RawTransaction;
}

export interface SignAndSubmitTransactionWithFeePayerRawTxnRequestArgs {
  feePayerAuthenticator: TxnBuilderTypes.AccountAuthenticator;
  rawTxn: TxnBuilderTypes.FeePayerRawTransaction;
}

export type SignAndSubmitTransactionRequestArgs =
  | SignAndSubmitTransactionWithPayloadRequestArgs
  | SignAndSubmitTransactionWithRawTxnRequestArgs
  | SignAndSubmitTransactionWithFeePayerRawTxnRequestArgs;
