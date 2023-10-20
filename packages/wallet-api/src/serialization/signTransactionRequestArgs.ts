// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { TxnBuilderTypes } from 'aptos';
import type {
  JsonTransactionPayload,
  SignTransactionRequestArgs,
  SignTransactionWithPayloadRequestArgs,
  SignTransactionWithRawTxnRequestArgs,
  TransactionOptions,
} from '../types';
import { bcsDeserialize, bcsSerialize, isBcsSerializable } from './bcsSerialization';
import { UnexpectedValueError } from './error';
import { ensureJsonTransactionPayloadSerializable } from './jsonPayload';
import type { SerializedRawTransaction } from './rawTxn';
import { deserializeRawTransaction, serializeRawTransaction } from './rawTxn';

export interface SerializedSignTransactionWithPayloadRequestArgs {
  options?: TransactionOptions;
  payload: JsonTransactionPayload | string;
}

export interface SerializedSignTransactionWithRawTxnRequestArgs {
  rawTxn: SerializedRawTransaction;
}

export type SerializedSignTransactionRequestArgs =
  | SerializedSignTransactionWithPayloadRequestArgs
  | SerializedSignTransactionWithRawTxnRequestArgs;

export function serializeSignTransactionRequestArgs(
  args: SignTransactionRequestArgs,
): SerializedSignTransactionRequestArgs {
  if ('payload' in args) {
    const serializedPayload = isBcsSerializable(args.payload)
      ? bcsSerialize(args.payload)
      : ensureJsonTransactionPayloadSerializable(args.payload);
    return { options: args.options, payload: serializedPayload };
  }
  if ('rawTxn' in args) {
    const serializedRawTxn = serializeRawTransaction(args.rawTxn);
    return { rawTxn: serializedRawTxn };
  }
  throw new UnexpectedValueError();
}

export function deserializeSignTransactionRequestArgs(
  args: SerializedSignTransactionWithPayloadRequestArgs,
): SignTransactionWithPayloadRequestArgs;
export function deserializeSignTransactionRequestArgs(
  args: SerializedSignTransactionWithRawTxnRequestArgs,
): SignTransactionWithRawTxnRequestArgs;
export function deserializeSignTransactionRequestArgs(
  args: SerializedSignTransactionRequestArgs,
): SignTransactionRequestArgs;

export function deserializeSignTransactionRequestArgs(
  args: SerializedSignTransactionRequestArgs,
): SignTransactionRequestArgs {
  if ('payload' in args) {
    const payload =
      typeof args.payload === 'string'
        ? bcsDeserialize(TxnBuilderTypes.TransactionPayload, args.payload)
        : args.payload;
    return { options: args.options, payload };
  }
  if ('rawTxn' in args) {
    const deserializedRawTxn = deserializeRawTransaction(args.rawTxn);
    return { rawTxn: deserializedRawTxn };
  }
  throw new UnexpectedValueError();
}
