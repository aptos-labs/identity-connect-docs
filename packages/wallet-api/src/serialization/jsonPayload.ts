// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { HexString, Types } from 'aptos';
import type { EntryFunctionJsonTransactionPayload, JsonTransactionPayload } from '../types';
import { UnexpectedValueError } from './error';

function normalizeEntryFunctionArg(arg: any): any {
  if (arg instanceof Uint8Array) {
    return HexString.fromUint8Array(arg).toString();
  }
  if (Array.isArray(arg)) {
    return arg.map(normalizeEntryFunctionArg);
  }
  return arg;
}

function ensureEntryFunctionPayloadSerializable(
  payload: Types.EntryFunctionPayload,
): EntryFunctionJsonTransactionPayload {
  const normalizedArgs = payload.arguments.map(normalizeEntryFunctionArg);
  return {
    type: 'entry_function_payload',
    ...payload,
    arguments: normalizedArgs,
  };
}

export function ensureJsonTransactionPayloadSerializable(payload: JsonTransactionPayload): JsonTransactionPayload {
  if (payload.type === 'entry_function_payload') {
    return ensureEntryFunctionPayloadSerializable(payload);
  }
  if (payload.type === 'multisig_payload') {
    const innerPayload =
      payload.transaction_payload !== undefined
        ? ensureEntryFunctionPayloadSerializable(payload.transaction_payload)
        : undefined;
    return { ...payload, transaction_payload: innerPayload };
  }
  throw new UnexpectedValueError();
}
