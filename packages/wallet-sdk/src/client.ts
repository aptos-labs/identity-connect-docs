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
  NetworkName,
  PairingStatus,
  RespondToSignRequestSerializedResponse,
  WalletName,
  WalletOS,
  WalletPlatform,
} from '@identity-connect/api';
import {
  createEd25519KeyPair,
  decodeBase64,
  decryptEnvelope,
  encodeBase64,
  encryptAndSignEnvelope,
  IEnvelopeMetadata,
  KeyTypes,
  toKey,
} from '@identity-connect/crypto';
import axios, { AxiosInstance, CreateAxiosDefaults } from 'axios';
import { WalletConnectionAccount, WalletStateAccessors } from './state';
import { SerializedSignatureResponseArgs, SignatureRequest, WalletAccountConnectInfo } from './types';
import { walletAccountFromConnectInfo } from './utils';

const API_VERSION = '0.2.0' as const;

export interface WalletInfo {
  deviceIdentifier: string;
  platform: WalletPlatform;
  platformOS: WalletOS;
  walletName: WalletName;
}

export interface ICWalletClientConfig {
  axiosConfig?: CreateAxiosDefaults;
  defaultNetworkName?: NetworkName;
}

export class ICWalletClient {
  private readonly defaultNetworkName?: NetworkName;
  private readonly axiosInstance: AxiosInstance;

  constructor(
    readonly walletInfo: WalletInfo,
    readonly accessors: WalletStateAccessors,
    { axiosConfig, defaultNetworkName }: ICWalletClientConfig = {},
  ) {
    this.accessors = accessors;
    this.defaultNetworkName = defaultNetworkName;
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
    const icEd25519PublicKey = decodeBase64(icEd25519PublicKeyB64);
    const walletEd25519SecretKeyB64 = encodeBase64(walletEd25519SecretKey.key);
    const walletEd25519PublicKeyB64 = encodeBase64(walletEd25519PublicKey.key);

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
    const walletEd25519SecretKey = decodeBase64(walletEd25519SecretKeyB64);
    const walletEd25519PublicKey = decodeBase64(walletEd25519PublicKeyB64);
    const icEd25519PublicKey = decodeBase64(icEd25519PublicKeyB64);

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
    const dappEd25519PublicKey = decodeBase64(pairing.dappEd25519PublicKeyB64);
    const { publicKey: walletEd25519PublicKey, secretKey: walletEd25519SecretKey } = createEd25519KeyPair();
    const walletEd25519SecretKeyB64 = encodeBase64(walletEd25519SecretKey.key);
    const walletEd25519PublicKeyB64 = encodeBase64(walletEd25519PublicKey.key);

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

  async setNotificationToken(walletId: string, firebaseProjectId: string, notificationToken: string) {
    const connection = await this.accessors.get(walletId);
    if (connection === undefined) {
      throw new Error('Wallet connection not found');
    }

    const { icEd25519PublicKeyB64, walletEd25519PublicKeyB64, walletEd25519SecretKeyB64 } = connection;
    const walletEd25519SecretKey = decodeBase64(walletEd25519SecretKeyB64);
    const walletEd25519PublicKey = decodeBase64(walletEd25519PublicKeyB64);
    const icEd25519PublicKey = decodeBase64(icEd25519PublicKeyB64);

    const requestEnvelope = await encryptAndSignEnvelope<any, any>(
      toKey(walletEd25519SecretKey, KeyTypes.Ed25519SecretKey),
      toKey(walletEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      toKey(icEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      0, // ignored
      {
        firebaseProjectId,
        notificationToken,
      },
      {},
    );

    await this.axiosInstance.patch(`v1/wallets/${walletId}/notification-token`, requestEnvelope);
  }

  async removeConnection(walletId: string) {
    const connection = await this.accessors.get(walletId);
    if (connection === undefined) {
      throw new Error('Wallet connection not found');
    }

    const { icEd25519PublicKeyB64, walletEd25519PublicKeyB64, walletEd25519SecretKeyB64 } = connection;
    const walletEd25519SecretKey = decodeBase64(walletEd25519SecretKeyB64);
    const walletEd25519PublicKey = decodeBase64(walletEd25519PublicKeyB64);
    const icEd25519PublicKey = decodeBase64(icEd25519PublicKeyB64);

    const requestEnvelope = await encryptAndSignEnvelope<any, any>(
      toKey(walletEd25519SecretKey, KeyTypes.Ed25519SecretKey),
      toKey(walletEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      toKey(icEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      0, // ignored
      {},
      {},
    );

    await this.axiosInstance.patch(`v1/wallets/${walletId}/disconnect`, requestEnvelope);

    await this.accessors.update(walletId, undefined);
  }

  // endregion

  // region Signing API

  async getSigningRequests(walletId: string, networkName?: NetworkName) {
    const connection = await this.accessors.get(walletId);
    if (connection === undefined) {
      throw new Error('Wallet is not connected');
    }

    const walletEd25519SecretKey = toKey(decodeBase64(connection.walletEd25519SecretKeyB64), KeyTypes.Ed25519SecretKey);
    const walletEd25519PublicKey = toKey(decodeBase64(connection.walletEd25519PublicKeyB64), KeyTypes.Ed25519PublicKey);
    const icEd25519PublicKey = toKey(decodeBase64(connection.icEd25519PublicKeyB64), KeyTypes.Ed25519PublicKey);

    const requestEnvelope = await encryptAndSignEnvelope<any, any>(
      walletEd25519SecretKey,
      walletEd25519PublicKey,
      icEd25519PublicKey,
      0, // ignore
      { apiVersion: API_VERSION, networkName: networkName ?? this.defaultNetworkName },
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

      const dappEd25519PublicKey = toKey(decodeBase64(dappEd25519PublicKeyB64), KeyTypes.Ed25519PublicKey);

      const accountTransportEd25519SecretKey = toKey(
        decodeBase64(account.transportEd25519SecretKeyB64),
        KeyTypes.Ed25519SecretKey,
      );

      const decryptedEnvelope = decryptEnvelope<any, any>(
        dappEd25519PublicKey,
        accountTransportEd25519SecretKey,
        signingRequest.requestEnvelope,
      );

      const apiVersion: string = decryptedEnvelope.publicMessage?.apiVersion ?? '0.1.0';
      const decryptedSigningRequest: SignatureRequest = {
        accountAddress: account.address,
        apiVersion,
        args: decryptedEnvelope.privateMessage,
        createdAt: new Date(signingRequest.createdAt),
        id: signingRequest.id,
        networkName: decryptedEnvelope.publicMessage?.networkName,
        pairingId: signingRequest.pairingId,
        registeredDapp: signingRequest.pairing.registeredDapp,
        type: signingRequest.requestType,
      };

      // Request type normalization so that wallet doesn't break. Will remove in the near future
      const [apiMajorVersion, apiMinorVersion] = apiVersion.split('.').map(Number);
      if (
        apiMajorVersion === 0 &&
        apiMinorVersion === 1 &&
        decryptedSigningRequest.type === 'SIGN_AND_SUBMIT_TRANSACTION'
      ) {
        decryptedSigningRequest.args = { payload: decryptedSigningRequest.args as any };
      }

      return decryptedSigningRequest;
    });
  }

  async getAllSigningRequests(networkName?: NetworkName) {
    const walletIds = Object.keys(await this.accessors.getAll());
    const allSigningRequests = await Promise.all(
      walletIds.map((walletId) => this.getSigningRequests(walletId, networkName)),
    );
    return allSigningRequests.flat();
  }

  async respondToSigningRequest(
    signingRequestId: string,
    pairingId: string,
    action: string,
    args?: SerializedSignatureResponseArgs,
  ) {
    const pairing = await this.getPairing(pairingId);
    if (pairing.status !== PairingStatus.Finalized) {
      throw new Error('Pairing is not finalized');
    }
    const dappEd25519PublicKey = decodeBase64(pairing.dappEd25519PublicKeyB64);

    const account = await this.getConnectedAccount(pairing.account.accountAddress);
    const accountTransportEd25519SecretKey = decodeBase64(account.transportEd25519SecretKeyB64);
    const accountTransportEd25519PublicKey = decodeBase64(account.transportEd25519PublicKeyB64);

    const responseEnvelope = await encryptAndSignEnvelope<any, any>(
      toKey(accountTransportEd25519SecretKey, KeyTypes.Ed25519SecretKey),
      toKey(accountTransportEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      toKey(dappEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      pairing.maxWalletSequenceNumber + 1,
      {
        action,
        signingRequestId,
      },
      args ?? {},
    );

    const response = await this.axiosInstance.patch<RespondToSignRequestSerializedResponse>(
      `v1/signing-request/${signingRequestId}/${action}`,
      responseEnvelope,
    );

    return response.data;
  }

  async approveSigningRequest(signingRequestId: string, pairingId: string, args: SerializedSignatureResponseArgs) {
    return this.respondToSigningRequest(signingRequestId, pairingId, 'approve', args);
  }

  async rejectSigningRequest(signingRequestId: string, pairingId: string) {
    return this.respondToSigningRequest(signingRequestId, pairingId, 'reject');
  }

  // endregion
}
