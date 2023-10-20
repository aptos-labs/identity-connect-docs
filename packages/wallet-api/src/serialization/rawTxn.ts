// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { TxnBuilderTypes } from 'aptos';
import { bcsDeserialize, bcsSerialize } from './bcsSerialization';
import { UnexpectedValueError } from './error';

export type SerializableRawTransaction =
  | TxnBuilderTypes.RawTransaction
  | TxnBuilderTypes.FeePayerRawTransaction
  | TxnBuilderTypes.MultiAgentRawTransaction;

export interface SerializedSimpleRawTransaction {
  type: 'raw_txn';
  value: string;
}

export interface SerializedFeePayerRawTransaction {
  type: 'fee_payer_raw_txn';
  value: string;
}

export interface SerializedMultiAgentRawTransaction {
  type: 'multi_agent_raw_txn';
  value: string;
}

export type SerializedRawTransaction =
  | SerializedSimpleRawTransaction
  | SerializedFeePayerRawTransaction
  | SerializedMultiAgentRawTransaction;

export function serializeRawTransaction(rawTxn: TxnBuilderTypes.RawTransaction): SerializedSimpleRawTransaction;
export function serializeRawTransaction(
  rawTxn: TxnBuilderTypes.FeePayerRawTransaction,
): SerializedFeePayerRawTransaction;
export function serializeRawTransaction(
  rawTxn: TxnBuilderTypes.MultiAgentRawTransaction,
): SerializedMultiAgentRawTransaction;
export function serializeRawTransaction(rawTxn: SerializableRawTransaction): SerializedRawTransaction;

export function serializeRawTransaction(rawTxn: SerializableRawTransaction): SerializedRawTransaction {
  const value = bcsSerialize(rawTxn);
  if ('fee_payer_address' in rawTxn) {
    return { type: 'fee_payer_raw_txn', value };
  }
  if ('secondary_signer_addresses' in rawTxn) {
    return { type: 'multi_agent_raw_txn', value };
  }
  if ('chain_id' in rawTxn) {
    return { type: 'raw_txn', value };
  }
  throw new UnexpectedValueError('Invalid raw transaction type');
}

export function deserializeRawTransaction(serialized: SerializedSimpleRawTransaction): TxnBuilderTypes.RawTransaction;
export function deserializeRawTransaction(
  serialized: SerializedFeePayerRawTransaction,
): TxnBuilderTypes.FeePayerRawTransaction;
export function deserializeRawTransaction(
  serialized: SerializedMultiAgentRawTransaction,
): TxnBuilderTypes.MultiAgentRawTransaction;
export function deserializeRawTransaction(serialized: SerializedRawTransaction): SerializableRawTransaction;

export function deserializeRawTransaction(serialized: SerializedRawTransaction): SerializableRawTransaction {
  switch (serialized.type) {
    case 'raw_txn':
      return bcsDeserialize(TxnBuilderTypes.RawTransaction, serialized.value);
    case 'fee_payer_raw_txn':
      return bcsDeserialize(
        TxnBuilderTypes.RawTransactionWithData,
        serialized.value,
      ) as TxnBuilderTypes.FeePayerRawTransaction;
    case 'multi_agent_raw_txn':
      return bcsDeserialize(
        TxnBuilderTypes.RawTransactionWithData,
        serialized.value,
      ) as TxnBuilderTypes.MultiAgentRawTransaction;
    default:
      throw new UnexpectedValueError('Invalid raw transaction type');
  }
}
