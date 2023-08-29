// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

export type SerializedDate<T> = T extends (infer S)[]
  ? SerializedDate<S>[]
  : {
      [P in keyof T]: T[P] extends Date ? string : SerializedDate<T[P]>;
    };
