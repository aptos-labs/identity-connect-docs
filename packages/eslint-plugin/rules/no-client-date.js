// Copyright (c) Aptos
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use server time instead of client time',
    },
    fixable: 'code',
    messages: {
      dateNow: 'Use getServerTime() instead of Date.now().',
      newDate: 'Use getServerDate() instead of new Date().',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { object, property } = node.callee;
        if (object?.name === 'Date' && property?.name === 'now') {
          context.report({
            node,
            messageId: 'dateNow',
            fix: (fixer) => {
              return fixer.replaceText(node, 'getServerTime()');
            },
          });
        }
      },
      NewExpression(node) {
        if (node.callee.name === 'Date' && node.arguments.length === 0) {
          context.report({
            node,
            messageId: 'newDate',
            fix: (fixer) => {
              return fixer.replaceText(node, 'getServerDate()');
            },
          });
        }
      },
    };
  },
};
