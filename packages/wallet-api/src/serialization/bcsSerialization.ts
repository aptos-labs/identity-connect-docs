// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { BCS, HexString } from 'aptos';

export interface BcsSerializable {
  serialize: (serializer: BCS.Serializer) => void;
}

export interface BcsDeserializable<T> {
  deserialize: (deserializer: BCS.Deserializer) => T;
}

/**
 * Check if a value is BCS serializable
 */
export function isBcsSerializable(value: any): value is BcsSerializable {
  return (value as BcsSerializable)?.serialize !== undefined;
}

export function bcsSerialize(serializable: BcsSerializable) {
  const serializedValueBytes = BCS.bcsToBytes(serializable);
  return HexString.fromUint8Array(serializedValueBytes).toString();
}

export function bcsDeserialize<T>(deserializable: BcsDeserializable<T>, serializedValue: string) {
  const serializedValueBytes = new HexString(serializedValue).toUint8Array();
  const deserializer = new BCS.Deserializer(serializedValueBytes);
  return deserializable.deserialize(deserializer);
}
