// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export type SerializedDate<T> = {
  [P in keyof T]: T[P] extends Date ? string : SerializedDate<T[P]>;
};
