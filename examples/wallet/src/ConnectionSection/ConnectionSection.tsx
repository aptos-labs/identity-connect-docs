// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable jsx-a11y/label-has-associated-control */

import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../AppStateContext.ts';
import './index.css';
import { useWalletClient } from '../WalletClientContext.ts';
import NewConnection from './NewConnection.tsx';
import UpdateConnection from './UpdateConnection.tsx';

export default function ConnectionSection() {
  const appState = useAppState();
  const walletClient = useWalletClient();

  const walletIdInputRef = useRef<HTMLInputElement>(null);

  const connections = appState.watch('icWalletConnections');
  const connection = Object.values(connections)[0];
  const connectedWalletId = connection?.walletId;

  // Make sure to reset state on connection change
  useEffect(() => {
    if (walletIdInputRef.current) {
      walletIdInputRef.current.value = connectedWalletId ?? '';
    }
    setNewWalletId(undefined);
  }, [connectedWalletId]);

  const [newWalletId, setNewWalletId] = useState<string>();

  const onScan = () => {
    const walletId = walletIdInputRef.current?.value || undefined;
    setNewWalletId(walletId);
  };

  const onCancel = async () => {
    setNewWalletId(undefined);
  };

  const onDisconnect = async () => {
    if (connectedWalletId !== undefined) {
      await walletClient.removeConnection(connectedWalletId);
    }
  };

  const isConnected = connectedWalletId !== undefined;
  const isConnecting = !isConnected && newWalletId !== undefined;

  function renderButton() {
    if (isConnected) {
      return (
        <button type="button" onClick={onDisconnect}>
          Disconnect
        </button>
      );
    }
    if (isConnecting) {
      return (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      );
    }
    return (
      <button type="button" onClick={onScan}>
        Scan
      </button>
    );
  }

  function renderContent() {
    if (isConnected) {
      return <UpdateConnection connection={connection} />;
    }
    if (isConnecting) {
      return <NewConnection walletId={newWalletId} />;
    }
    return null;
  }

  return (
    <div>
      <h2>Connection</h2>
      <div className="header">
        <label htmlFor="walletId">Wallet ID</label>
        <input ref={walletIdInputRef} id="walletId" type="text" disabled={isConnected || isConnecting} />
        {renderButton()}
      </div>
      {renderContent()}
    </div>
  );
}
