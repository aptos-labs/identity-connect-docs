// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';

export default function useAsyncAction<TParams extends any[], TResult>(
  callback: (...params: TParams) => Promise<TResult>,
) {
  const [isLoading, setIsLoading] = useState(false);

  async function trigger(...params: TParams) {
    setIsLoading(true);
    try {
      await callback(...params);
    } finally {
      setIsLoading(false);
    }
  }

  return {
    isLoading,
    trigger,
  };
}
