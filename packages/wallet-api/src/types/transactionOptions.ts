// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export interface TransactionOptions {
  expirationSecondsFromNow?: number;
  expirationTimestamp?: number;
  gasUnitPrice?: number;
  maxGasAmount?: number;
  sender?: string;
}
