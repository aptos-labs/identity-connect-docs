// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import type { FullMessageFlags, FullMessageParams, FullMessageResult } from '../types';

const prefix = 'APTOS';

export function makeFullMessage(params: FullMessageParams, flags: FullMessageFlags): FullMessageResult {
  let fullMessage = prefix;
  if (flags.address) {
    fullMessage += `\naddress: ${params.address}`;
  }
  if (flags.application) {
    fullMessage += `\napplication: ${params.application}`;
  }
  if (flags.chainId) {
    fullMessage += `\nchainId: ${params.chainId}`;
  }

  fullMessage += `\nmessage: ${params.message}`;
  fullMessage += `\nnonce: ${params.nonce}`;

  return {
    fullMessage,
    prefix,
  };
}
