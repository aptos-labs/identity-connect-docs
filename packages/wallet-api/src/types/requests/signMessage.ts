// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { FullMessageFlags } from '../message';

export type SignMessageRequestArgs = FullMessageFlags & {
  message: string;
  nonce: string;
};
