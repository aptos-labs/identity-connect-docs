// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable react/function-component-definition */

import React, { PropsWithChildren, createContext, useContext } from 'react';

function makeContext<TContext>(name: string): [React.Context<TContext | undefined>, () => TContext];

function makeContext<TContext, TProps = {}>(
  name: string,
  valueProvider: (props: TProps) => TContext,
): [(props: PropsWithChildren<TProps>) => JSX.Element, () => TContext, React.Context<TContext | undefined>];

function makeContext<TContext, TProps = {}>(name: string, valueProvider?: (props: TProps) => TContext) {
  const Context = createContext<TContext | undefined>(undefined);
  Context.displayName = name;

  function useContextHook() {
    const context = useContext(Context);
    if (context === undefined) {
      throw new Error(`No provider for ${name}`);
    }
    return context;
  }

  if (!valueProvider) {
    return [Context, useContextHook] as const;
  }

  const ContextProvider = ({ children, ...props }: PropsWithChildren<TProps>) => {
    const value = valueProvider(props as TProps);
    return <Context.Provider value={value}>{children}</Context.Provider>;
  };

  return [ContextProvider, useContextHook, Context] as const;
}

export default makeContext;
