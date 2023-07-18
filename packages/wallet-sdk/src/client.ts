// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-await-in-loop */

import {
  DEFAULT_BACKEND_URL,
  FinalizeAnonymousPairingSerializedResponse,
  FinalizeConnectionSerializedResponse,
  GetPairingSerializedResponse,
  GetSigningRequestsSerializedResponse,
  GetWalletSerializedResponse,
  PairingStatus,
  RespondToSignRequestSerializedResponse,
  SignResponseBody,
  WalletName,
  WalletOS,
  WalletPlatform,
} from '@identity-connect/api';
import {
  createEd25519KeyPair,
  decryptEnvelope,
  encryptAndSignEnvelope,
  IEnvelopeMetadata,
  KeyTypes,
  toKey,
} from '@identity-connect/crypto';
import axios, { AxiosInstance, CreateAxiosDefaults } from 'axios';
import { WalletConnectionAccount, WalletStateAccessors, windowStateAccessors } from './state';
import { SignRequest, WalletAccountConnectInfo } from './types';
import { walletAccountFromConnectInfo } from './utils';

export interface WalletInfo {
  deviceIdentifier: string;
  platform: WalletPlatform;
  platformOS: WalletOS;
  walletName: WalletName;
}

export interface ICWalletClientConfig {
  accessors?: WalletStateAccessors;
  axiosConfig?: CreateAxiosDefaults;
}

export default class ICWalletClient {
  private readonly accessors: WalletStateAccessors;
  private readonly axiosInstance: AxiosInstance;

  constructor(
    private readonly walletInfo: WalletInfo,
    { accessors = windowStateAccessors, axiosConfig }: ICWalletClientConfig = {},
  ) {
    this.accessors = accessors;
    this.axiosInstance = axios.create({ baseURL: DEFAULT_BACKEND_URL, ...axiosConfig });
  }

  // region Internals

  private async getPairing(id: string) {
    const response = await this.axiosInstance.get<GetPairingSerializedResponse>(`v1/pairing/${id}`);
    return response.data.data.pairing;
  }

  private async getConnectedAccount(address: string) {
    const connections = await this.accessors.getAll();
    for (const connection of Object.values(connections)) {
      if (address in connection.accounts) {
        return connection.accounts[address];
      }
    }
    throw new Error('Account not paired');
  }

  // endregion

  // region Connection API

  async finalizeConnection(walletId: string, accountsConnectInfo: WalletAccountConnectInfo[]) {
    const getWalletResp = await this.axiosInstance.get<GetWalletSerializedResponse>(`v1/wallet/${walletId}`);
    const { icEd25519PublicKeyB64 } = getWalletResp.data.data.wallet;

    const { publicKey: walletEd25519PublicKey, secretKey: walletEd25519SecretKey } = createEd25519KeyPair();
    const icEd25519PublicKey = Buffer.from(icEd25519PublicKeyB64, 'base64');
    const walletEd25519SecretKeyB64 = Buffer.from(walletEd25519SecretKey.key).toString('base64');
    const walletEd25519PublicKeyB64 = Buffer.from(walletEd25519PublicKey.key).toString('base64');

    const requestEnvelope = await encryptAndSignEnvelope<any, any>(
      walletEd25519SecretKey,
      walletEd25519PublicKey,
      toKey(icEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      0, // ignored
      {
        ...this.walletInfo,
        accounts: accountsConnectInfo.map(({ info }) => info),
        walletEd25519PublicKeyB64,
      },
      {},
    );

    const { data } = await this.axiosInstance.patch<FinalizeConnectionSerializedResponse>(
      `v1/wallet/connect/${walletId}/finish-authed-connect`,
      requestEnvelope,
    );

    const accounts: { [address: string]: WalletConnectionAccount } = {};
    for (const accountConnectInfo of accountsConnectInfo) {
      const { account } = walletAccountFromConnectInfo(accountConnectInfo);
      accounts[account.address] = account;
    }

    await this.accessors.update(walletId, {
      accounts,
      icEd25519PublicKeyB64,
      walletEd25519PublicKeyB64,
      walletEd25519SecretKeyB64,
      walletId,
    });

    return data.data.wallet;
  }

  async updateAccounts(walletId: string, accountsConnectInfo: WalletAccountConnectInfo[]) {
    const connection = await this.accessors.get(walletId);
    if (connection === undefined) {
      throw new Error('Wallet connection not found');
    }

    const { icEd25519PublicKeyB64, walletEd25519PublicKeyB64, walletEd25519SecretKeyB64 } = connection;
    const walletEd25519SecretKey = Buffer.from(walletEd25519SecretKeyB64, 'base64');
    const walletEd25519PublicKey = Buffer.from(walletEd25519PublicKeyB64, 'base64');
    const icEd25519PublicKey = Buffer.from(icEd25519PublicKeyB64, 'base64');

    const requestEnvelope = await encryptAndSignEnvelope<any, any>(
      toKey(walletEd25519SecretKey, KeyTypes.Ed25519SecretKey),
      toKey(walletEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      toKey(icEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      0, // ignored
      {
        accounts: accountsConnectInfo.map(({ info }) => info),
        walletEd25519PublicKeyB64,
      },
      {},
    );

    const { data } = await this.axiosInstance.patch<FinalizeConnectionSerializedResponse>(
      `v1/wallet/${walletId}/accounts`,
      requestEnvelope,
    );

    const newAccounts = { ...connection.accounts };
    for (const accountConnectInfo of accountsConnectInfo) {
      const { account, action } = walletAccountFromConnectInfo(accountConnectInfo);
      if (action === 'add') {
        newAccounts[account.address] = account;
      } else if (action === 'remove') {
        delete newAccounts[account.address];
      }
    }

    await this.accessors.update(walletId, {
      accounts: newAccounts,
      icEd25519PublicKeyB64,
      walletEd25519PublicKeyB64,
      walletEd25519SecretKeyB64,
      walletId,
    });

    return data.data.wallet;
  }

  async finalizeAnonymousPairingRequest(pairingId: string, accountConnectInfo: WalletAccountConnectInfo) {
    const pairing = await this.getPairing(pairingId);
    const dappEd25519PublicKey = Buffer.from(pairing.dappEd25519PublicKeyB64, 'base64');
    const { publicKey: walletEd25519PublicKey, secretKey: walletEd25519SecretKey } = createEd25519KeyPair();
    const walletEd25519SecretKeyB64 = Buffer.from(walletEd25519SecretKey.key).toString('base64');
    const walletEd25519PublicKeyB64 = Buffer.from(walletEd25519PublicKey.key).toString('base64');

    const requestEnvelope = await encryptAndSignEnvelope<any, any>(
      walletEd25519SecretKey,
      walletEd25519PublicKey,
      toKey(dappEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      pairing.maxWalletSequenceNumber + 1,
      {
        ...this.walletInfo,
        accounts: [accountConnectInfo.info],
        walletEd25519PublicKeyB64,
      },
      {},
    );

    const { data } = await this.axiosInstance.patch<FinalizeAnonymousPairingSerializedResponse>(
      `v1/pairing/${pairingId}/anonymous-wallet`,
      requestEnvelope,
    );

    const { account } = walletAccountFromConnectInfo(accountConnectInfo);
    const accounts = { [account.address]: account };

    const { icEd25519PublicKeyB64, id: walletId } = data.data.pairing.anonymousWallet;
    await this.accessors.update(walletId, {
      accounts,
      icEd25519PublicKeyB64,
      walletEd25519PublicKeyB64,
      walletEd25519SecretKeyB64,
      walletId,
    });

    return data.data.pairing;
  }

  async removeConnection(walletId: string) {
    await this.accessors.update(walletId, undefined);
  }

  // endregion

  // region Signing API

  async getSigningRequests(walletId: string) {
    const connection = await this.accessors.get(walletId);
    if (connection === undefined) {
      throw new Error('Wallet is not connected');
    }

    const walletEd25519SecretKey = toKey(
      Buffer.from(connection.walletEd25519SecretKeyB64, 'base64'),
      KeyTypes.Ed25519SecretKey,
    );
    const walletEd25519PublicKey = toKey(
      Buffer.from(connection.walletEd25519PublicKeyB64, 'base64'),
      KeyTypes.Ed25519PublicKey,
    );
    const icEd25519PublicKey = toKey(
      Buffer.from(connection.icEd25519PublicKeyB64, 'base64'),
      KeyTypes.Ed25519PublicKey,
    );

    const requestEnvelope = await encryptAndSignEnvelope<any, any>(
      walletEd25519SecretKey,
      walletEd25519PublicKey,
      icEd25519PublicKey,
      0, // ignored
      {},
      {},
    );

    const response = await this.axiosInstance.post<GetSigningRequestsSerializedResponse>(
      `v1/wallet/${walletId}/pending-signing-requests`,
      requestEnvelope,
    );
    const { signingRequests } = response.data.data;
    return signingRequests.map((signingRequest) => {
      const publicMessage = JSON.parse(signingRequest.requestEnvelope.serializedPublicMessage) as IEnvelopeMetadata;
      const dappEd25519PublicKeyB64 = publicMessage._metadata.senderEd25519PublicKeyB64;
      const accountTransportEd25519PublicKeyB64 = publicMessage._metadata.receiverEd25519PublicKeyB64;

      const account = Object.values(connection.accounts).find(
        (a) => a.transportEd25519PublicKeyB64 === accountTransportEd25519PublicKeyB64,
      );

      if (account === undefined) {
        throw new Error('Account not paired');
      }

      const dappEd25519PublicKey = toKey(Buffer.from(dappEd25519PublicKeyB64, 'base64'), KeyTypes.Ed25519PublicKey);

      const accountTransportEd25519SecretKey = toKey(
        Buffer.from(account.transportEd25519SecretKeyB64, 'base64'),
        KeyTypes.Ed25519SecretKey,
      );

      const decryptedEnvelope = decryptEnvelope<any, any>(
        dappEd25519PublicKey,
        accountTransportEd25519SecretKey,
        signingRequest.requestEnvelope,
      );
      const decryptedSigningRequest: SignRequest = {
        accountAddress: account.address,
        body: decryptedEnvelope.privateMessage,
        id: signingRequest.id,
        pairingId: signingRequest.pairingId,
        type: signingRequest.requestType,
      };
      return decryptedSigningRequest;
    });
  }

  async getAllSigningRequests() {
    const walletIds = Object.keys(await this.accessors.getAll());
    const allSigningRequests = await Promise.all(walletIds.map((walletId) => this.getSigningRequests(walletId)));
    return allSigningRequests.flat();
  }

  async respondToSigningRequest(
    signingRequestId: string,
    pairingId: string,
    action: string,
    responseBody?: SignResponseBody,
  ) {
    const pairing = await this.getPairing(pairingId);
    if (pairing.status !== PairingStatus.Finalized) {
      throw new Error('Pairing is not finalized');
    }
    const dappEd25519PublicKey = Buffer.from(pairing.dappEd25519PublicKeyB64, 'base64');

    const account = await this.getConnectedAccount(pairing.account.accountAddress);
    const accountTransportEd25519SecretKey = Buffer.from(account.transportEd25519SecretKeyB64, 'base64');
    const accountTransportEd25519PublicKey = Buffer.from(account.transportEd25519PublicKeyB64, 'base64');

    const responseEnvelope = await encryptAndSignEnvelope<any, any>(
      toKey(accountTransportEd25519SecretKey, KeyTypes.Ed25519SecretKey),
      toKey(accountTransportEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      toKey(dappEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      pairing.maxWalletSequenceNumber + 1,
      {
        action,
        signingRequestId,
      },
      responseBody ?? {},
    );

    const response = await this.axiosInstance.patch<RespondToSignRequestSerializedResponse>(
      `v1/signing-request/${signingRequestId}/${action}`,
      responseEnvelope,
    );

    return response.data;
  }

  async approveSigningRequest(signingRequestId: string, pairingId: string, responseBody: SignResponseBody) {
    return this.respondToSigningRequest(signingRequestId, pairingId, 'approve', responseBody);
  }

  async rejectSigningRequest(signingRequestId: string, pairingId: string) {
    return this.respondToSigningRequest(signingRequestId, pairingId, 'reject');
  }

  // endregion
}
