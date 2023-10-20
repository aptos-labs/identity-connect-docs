// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { TxnBuilderTypes } from 'aptos';
import type {
  SignAndSubmitTransactionRequestArgs,
  SignAndSubmitTransactionWithFeePayerRawTxnRequestArgs,
  SignAndSubmitTransactionWithPayloadRequestArgs,
  SignAndSubmitTransactionWithRawTxnRequestArgs,
} from '../types';
import { JsonTransactionPayload, TransactionOptions } from '../types';
import { bcsDeserialize, bcsSerialize, isBcsSerializable } from './bcsSerialization';

import { UnexpectedValueError } from './error';
import { ensureJsonTransactionPayloadSerializable } from './jsonPayload';
import {
  deserializeRawTransaction,
  type SerializedFeePayerRawTransaction,
  type SerializedSimpleRawTransaction,
  serializeRawTransaction,
} from './rawTxn';

export interface SerializedSignAndSubmitTransactionWithPayloadRequestArgs {
  options?: TransactionOptions;
  payload: JsonTransactionPayload | string;
}

export interface SerializedSignAndSubmitTransactionWithRawTxnRequestArgs {
  rawTxn: SerializedSimpleRawTransaction;
}

export interface SerializedSignAndSubmitTransactionWithFeePayerRawTxnRequestArgs {
  feePayerAuthenticator: string;
  rawTxn: SerializedFeePayerRawTransaction;
}

export type SerializedSignAndSubmitTransactionRequestArgs =
  | SerializedSignAndSubmitTransactionWithPayloadRequestArgs
  | SerializedSignAndSubmitTransactionWithRawTxnRequestArgs
  | SerializedSignAndSubmitTransactionWithFeePayerRawTxnRequestArgs;

export function serializeSignAndSubmitTransactionRequestArgs(
  args: SignAndSubmitTransactionRequestArgs,
): SerializedSignAndSubmitTransactionRequestArgs {
  if ('payload' in args) {
    const serializedPayload = isBcsSerializable(args.payload)
      ? bcsSerialize(args.payload)
      : ensureJsonTransactionPayloadSerializable(args.payload);
    return { options: args.options, payload: serializedPayload };
  }
  if ('feePayerAuthenticator' in args) {
    return {
      feePayerAuthenticator: bcsSerialize(args.feePayerAuthenticator),
      rawTxn: serializeRawTransaction(args.rawTxn),
    };
  }
  if ('rawTxn' in args) {
    return { rawTxn: serializeRawTransaction(args.rawTxn) };
  }
  throw new UnexpectedValueError();
}

export function deserializeSignAndSubmitTransactionRequestArgs(
  args: SerializedSignAndSubmitTransactionWithPayloadRequestArgs,
): SignAndSubmitTransactionWithPayloadRequestArgs;
export function deserializeSignAndSubmitTransactionRequestArgs(
  args: SerializedSignAndSubmitTransactionWithRawTxnRequestArgs,
): SignAndSubmitTransactionWithRawTxnRequestArgs;
export function deserializeSignAndSubmitTransactionRequestArgs(
  args: SerializedSignAndSubmitTransactionWithFeePayerRawTxnRequestArgs,
): SignAndSubmitTransactionWithFeePayerRawTxnRequestArgs;
export function deserializeSignAndSubmitTransactionRequestArgs(
  args: SerializedSignAndSubmitTransactionRequestArgs,
): SignAndSubmitTransactionRequestArgs;

export function deserializeSignAndSubmitTransactionRequestArgs(
  args: SerializedSignAndSubmitTransactionRequestArgs,
): SignAndSubmitTransactionRequestArgs {
  if ('payload' in args) {
    const payload =
      typeof args.payload === 'string'
        ? bcsDeserialize(TxnBuilderTypes.TransactionPayload, args.payload)
        : args.payload;
    return { options: args.options, payload };
  }
  if ('feePayerAuthenticator' in args) {
    const deserializedRawTxn = deserializeRawTransaction(args.rawTxn);
    const feePayerAuthenticator = bcsDeserialize(TxnBuilderTypes.AccountAuthenticator, args.feePayerAuthenticator);
    return { feePayerAuthenticator, rawTxn: deserializedRawTxn };
  }
  if ('rawTxn' in args) {
    const deserializedRawTxn = deserializeRawTransaction(args.rawTxn);
    return { rawTxn: deserializedRawTxn };
  }
  throw new UnexpectedValueError();
}
