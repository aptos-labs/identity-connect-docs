// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { TxnBuilderTypes } from 'aptos';

export interface SignTransactionWithPayloadResponseArgs {
  accountAuthenticator: TxnBuilderTypes.AccountAuthenticator;
  rawTxn: TxnBuilderTypes.RawTransaction;
}

export interface SignTransactionWithRawTxnResponseArgs {
  accountAuthenticator: TxnBuilderTypes.AccountAuthenticator;
}

export type SignTransactionResponseArgs =
  | SignTransactionWithPayloadResponseArgs
  | SignTransactionWithRawTxnResponseArgs;
