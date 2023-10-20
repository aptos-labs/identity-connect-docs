// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export interface FullMessageFlags {
  address?: boolean;
  application?: boolean;
  chainId?: boolean;
}

export interface FullMessageParams {
  address: string;
  application: string;
  chainId: number;
  message: string;
  nonce: string;
}

export interface FullMessageResult {
  fullMessage: string;
  prefix: string;
}
