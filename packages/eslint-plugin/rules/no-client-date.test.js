// Copyright (c) Aptos
// SPDX-License-Identifier: Apache-2.0

const { RuleTester } = require('eslint');
const noClientDateRule = require('./no-client-date');

const ruleTester = new RuleTester();
ruleTester.run('no-client-date', noClientDateRule, {
  valid: [
    {
      code: 'getServerDate()',
    },
    {
      code: 'getServerTime()',
    },
    {
      code: 'new Date(timestamp)',
    },
  ],
  invalid: [
    {
      code: 'Date.now()',
      errors: [{ messageId: 'dateNow' }],
      output: 'getServerTime()',
    },
    {
      code: 'new Date()',
      errors: [{ messageId: 'newDate' }],
      output: 'getServerDate()',
    },
  ],
});
