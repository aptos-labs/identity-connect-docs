// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest',
  testRegex: '/.*\\.(test|spec)?\\.(ts|tsx)$',
};

export default config;
