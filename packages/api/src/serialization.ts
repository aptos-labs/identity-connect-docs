// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { BCS, HexString, TxnBuilderTypes, Types } from 'aptos';

export type JsonEntryFunctionPayload = Types.EntryFunctionPayload & {
  // Note: when the type is not specified, we default to entry function
  type?: 'entry_function_payload';
};
export type JsonMultisigPayload = Types.MultisigPayload & {
  type: 'multisig_payload';
};
export type JsonPayload = JsonEntryFunctionPayload | JsonMultisigPayload;

export type SerializedPayload = JsonPayload | string;
export type DeserializedTransactionPayload = JsonPayload | TxnBuilderTypes.TransactionPayload;

// region Payload arg

interface SerializedUint8ArrayArg {
  stringValue: string;
  type: 'Uint8Array';
}

type SerializedArg = SerializedUint8ArrayArg;

function isSerializedArg(argument: any): argument is SerializedArg {
  return (
    argument !== undefined &&
    argument?.stringValue !== undefined &&
    typeof argument?.stringValue === 'string' &&
    argument?.type !== undefined
  );
}

function serializePayloadArg<TArg>(argument: TArg): SerializedArg | TArg {
  if (argument instanceof Uint8Array) {
    return {
      stringValue: HexString.fromUint8Array(argument).hex(),
      type: 'Uint8Array',
    };
  }

  // Everything else is already serializable
  return argument;
}

export function deserializePayloadArg(argument: any) {
  if (!isSerializedArg(argument)) {
    return argument;
  }

  if (argument.type === 'Uint8Array') {
    return new HexString(argument.stringValue).toUint8Array();
  }

  // Everything else is already deserializable
  return argument;
}

// endregion

// region Payload

function isBcsSerializable(payload: any): payload is TxnBuilderTypes.TransactionPayload {
  // Note: Just using `instanceof` won't work, since the dapp has its own Aptos bundle
  // which is distinct from the bundle used by Petra, and `instanceof` fails
  return (
    payload instanceof TxnBuilderTypes.TransactionPayload ||
    (payload as TxnBuilderTypes.TransactionPayload)?.serialize !== undefined
  );
}

export function serializeEntryFunctionPayload(payload: Types.EntryFunctionPayload): Types.EntryFunctionPayload {
  // Replace arguments with serialized ones
  const serializedArgs = payload.arguments.map((arg) => serializePayloadArg(arg));
  return { ...payload, arguments: serializedArgs };
}

export function ensurePayloadSerialized(
  payload: SerializedPayload | DeserializedTransactionPayload,
): SerializedPayload {
  if (typeof payload === 'string') {
    return payload;
  }

  // If the payload is serializable to BCS, serialize it to bytes string
  if (isBcsSerializable(payload)) {
    const payloadBytes = BCS.bcsToBytes(payload);
    return HexString.fromUint8Array(payloadBytes).hex();
  }

  if (payload.type === 'multisig_payload') {
    const txnPayload =
      payload.transaction_payload !== undefined
        ? serializeEntryFunctionPayload(payload.transaction_payload)
        : undefined;
    return { ...payload, transaction_payload: txnPayload };
  }

  return serializeEntryFunctionPayload(payload);
}

export function deserializeEntryFunctionPayload(payload: Types.EntryFunctionPayload): Types.EntryFunctionPayload {
  // Replace arguments with deserialized ones
  const deserializedArgs = payload.arguments.map((arg) => deserializePayloadArg(arg));
  return { ...payload, arguments: deserializedArgs };
}

export function ensurePayloadDeserialized(payload: SerializedPayload): DeserializedTransactionPayload {
  // If the payload is a BCS bytes string, deserialize it into a payload object
  if (typeof payload === 'string') {
    const encodedPayload = new HexString(payload).toUint8Array();
    const deserializer = new BCS.Deserializer(encodedPayload);
    return TxnBuilderTypes.TransactionPayload.deserialize(deserializer);
  }

  if (payload.type === 'multisig_payload') {
    const txnPayload =
      payload.transaction_payload !== undefined
        ? deserializeEntryFunctionPayload(payload.transaction_payload)
        : undefined;
    return { ...payload, transaction_payload: txnPayload };
  }

  return deserializeEntryFunctionPayload(payload);
}

// endregion
