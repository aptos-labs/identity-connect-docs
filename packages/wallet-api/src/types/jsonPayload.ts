// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { Types } from 'aptos';

export type EntryFunctionJsonTransactionPayload = Types.EntryFunctionPayload & {
  type: 'entry_function_payload';
};

export type MultisigJsonTransactionPayload = Types.MultisigPayload & {
  type: 'multisig_payload';
};

export type JsonTransactionPayload = EntryFunctionJsonTransactionPayload | MultisigJsonTransactionPayload;
