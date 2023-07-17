// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import makeContext from './makeContext.tsx';

/**
 * Utility function to define the app state and implement accessors with `window.localStorage`.
 * It allows atomically getting and setting the individual properties of the state, as well as
 * watching for changes and trigger re-renders.
 */
export default function makeLocalStorageAppStateContext<TState>(storageKeyPrefix: string, initialValue: TState) {
  return makeContext('AppStateContext', () => {
    type StateChangeCallback = (key: keyof TState, newValue: TState[keyof TState]) => void;
    const changeCallbacks = useRef(new Set<StateChangeCallback>());

    function get<TKey extends keyof TState>(key: TKey): TState[TKey] {
      const strKey = key.toString();
      const serialized = window.localStorage.getItem(`${storageKeyPrefix}.${strKey}`) ?? undefined;
      return serialized !== undefined ? JSON.parse(serialized) : initialValue[key];
    }

    function set<TKey extends keyof TState>(key: TKey, value: TState[TKey]) {
      const strKey = key.toString();
      if (value !== undefined) {
        const serialized = JSON.stringify(value);
        window.localStorage.setItem(`${storageKeyPrefix}.${strKey}`, serialized);
      } else {
        window.localStorage.removeItem(`${storageKeyPrefix}.${strKey}`);
      }
      for (const callback of changeCallbacks.current) {
        callback(key, value);
      }
    }

    /**
     * Watch for changes to a specific key in the state.
     * When the value is updated, a re-render is triggered for the watching component
     */
    function watch<TKey extends keyof TState>(key: TKey) {
      /* eslint-disable react-hooks/rules-of-hooks */
      const [value, setValue] = useState<TState[TKey]>(get(key));

      useEffect(() => {
        const onStateChange = (changedKey: keyof TState, newValue: TState[keyof TState]) => {
          if (changedKey === key) {
            setValue(newValue as TState[TKey]);
          }
        };

        changeCallbacks.current.add(onStateChange);
        return () => {
          changeCallbacks.current.delete(onStateChange);
        };
      }, [key]);

      return value;
      /* eslint-enable react-hooks/rules-of-hooks */
    }

    return {
      get,
      set,
      watch,
    };
  });
}
