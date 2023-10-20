// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { FullMessageParams, FullMessageResult } from '../message';

export type SignMessageResponseArgs = FullMessageParams &
  FullMessageResult & {
    signature: string;
  };
