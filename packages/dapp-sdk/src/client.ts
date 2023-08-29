// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-await-in-loop */

import {
  CancelSigningRequestSerializedResponse,
  CreatePairingSerializedResponse,
  CreateSigningRequestSerializedResponse,
  DEFAULT_BACKEND_URL,
  ensurePayloadSerialized,
  FinalizedPairingData,
  GetSigningRequestSerializedResponse,
  NetworkName,
  SerializedDate,
  SerializedPayload,
  SigningRequestData,
  SigningRequestStatus,
  SigningRequestTypes,
  SignMessageRequestBody,
  SignMessageResponseBody,
  SignTransactionRequestBody,
  SignTransactionResponseBody,
} from '@identity-connect/api';
import {
  createEd25519KeyPair,
  decodeBase64,
  decryptEnvelope,
  Ed25519PublicKey,
  Ed25519SecretKey,
  encodeBase64,
  encryptAndSignEnvelope,
  KeyTypes,
  toKey,
} from '@identity-connect/crypto';
import axios, { AxiosInstance, CreateAxiosDefaults, isAxiosError } from 'axios';
import { DEFAULT_FRONTEND_URL } from './constants';
import { PairingExpiredError, SignRequestError } from './errors';
import { openPrompt, waitForPromptResponse } from './prompt';
import { DappPairingData, DappStateAccessors, windowStateAccessors } from './state';
import { CancelToken } from './types';
import { validateSignAndSubmitTransactionResponse, validateSignMessageResponse } from './utils';

const SIGNING_REQUEST_POLLING_INTERVAL = 2500;

async function waitFor(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export interface SignRequestOptions {
  cancelToken?: CancelToken;
  networkName?: NetworkName;
}

export type OnDisconnectListener = (address: string) => void;
export type OnDisconnectListenerCleanup = () => void;

export interface ICDappClientConfig {
  accessors?: DappStateAccessors;
  axiosConfig?: CreateAxiosDefaults;
  defaultNetworkName?: NetworkName;
  frontendBaseURL?: string;
}

export class ICDappClient {
  private readonly accessors: DappStateAccessors;
  private readonly defaultNetworkName: NetworkName;

  private readonly axiosInstance: AxiosInstance;
  private readonly frontendBaseURL: string;

  constructor(
    private readonly dappId: string,
    {
      accessors = windowStateAccessors,
      axiosConfig,
      defaultNetworkName = NetworkName.MAINNET,
      frontendBaseURL = DEFAULT_FRONTEND_URL,
    }: ICDappClientConfig = {},
  ) {
    this.accessors = accessors;
    this.defaultNetworkName = defaultNetworkName;
    this.axiosInstance = axios.create({
      baseURL: DEFAULT_BACKEND_URL,
      ...axiosConfig,
    });
    this.frontendBaseURL = frontendBaseURL;
  }

  private async createPairingRequest(dappEd25519PublicKeyB64: string) {
    const response = await this.axiosInstance.post<CreatePairingSerializedResponse>('v1/pairing', {
      dappEd25519PublicKeyB64,
      dappId: this.dappId,
    });
    return response.data.data.pairing;
  }

  private async createSigningRequest<TRequestBody>(
    pairing: DappPairingData,
    type: string,
    networkName: NetworkName,
    requestBody: TRequestBody,
  ) {
    const dappEd25519SecretKey = decodeBase64(pairing.dappEd25519SecretKeyB64);
    const dappEd25519PublicKey = decodeBase64(pairing.dappEd25519PublicKeyB64);
    const accountTransportEd25519PublicKey = decodeBase64(pairing.accountTransportEd25519PublicKeyB64);

    const sequenceNumber = pairing.currSequenceNumber;
    const requestEnvelope = await encryptAndSignEnvelope<any, any>(
      toKey(dappEd25519SecretKey, KeyTypes.Ed25519SecretKey),
      toKey(dappEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      toKey(accountTransportEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      sequenceNumber + 1,
      { networkName, requestType: type },
      requestBody,
    );

    const response = await this.axiosInstance.post<CreateSigningRequestSerializedResponse>(
      `v1/pairing/${pairing.pairingId}/signing-request`,
      requestEnvelope,
    );

    // TODO: auto-sync sequence number on error
    await this.accessors.update(pairing.accountAddress, {
      ...pairing,
      currSequenceNumber: sequenceNumber + 1,
    });

    return response.data.data.signingRequest;
  }

  private async getSigningRequest(id: string) {
    const response = await this.axiosInstance.get<GetSigningRequestSerializedResponse | undefined>(
      `v1/signing-request/${id}`,
      {
        validateStatus: (status) => status === 200 || status === 404,
      },
    );
    return response.data?.data?.signingRequest;
  }

  private async deletePairing(pairingId: string, secretKey: Ed25519SecretKey, publicKey: Ed25519PublicKey) {
    const requestEnvelope = await encryptAndSignEnvelope<any, any>(
      secretKey,
      publicKey,
      publicKey,
      0, // ignored
      {},
      {},
    );

    await this.axiosInstance.post<CreateSigningRequestSerializedResponse>(
      `v1/pairing/${pairingId}/delete`,
      requestEnvelope,
      { validateStatus: (status) => status === 204 || status === 404 },
    );
  }

  async cancelSigningRequest(pairing: DappPairingData, id: string) {
    const sequenceNumber = pairing.currSequenceNumber;
    const dappEd25519SecretKey = decodeBase64(pairing.dappEd25519SecretKeyB64);
    const dappEd25519PublicKey = decodeBase64(pairing.dappEd25519PublicKeyB64);
    const accountEd25519PublicKey = decodeBase64(pairing.accountEd25519PublicKeyB64);

    const requestEnvelope = await encryptAndSignEnvelope<any, any>(
      toKey(dappEd25519SecretKey, KeyTypes.Ed25519SecretKey),
      toKey(dappEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      toKey(accountEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      sequenceNumber + 1,
      {},
      {},
    );

    const response = await this.axiosInstance.patch<CancelSigningRequestSerializedResponse>(
      `v1/signing-request/${id}/cancel`,
      requestEnvelope,
    );

    // TODO: auto-sync sequence number on error
    await this.accessors.update(pairing.accountAddress, {
      ...pairing,
      currSequenceNumber: sequenceNumber + 1,
    });

    return response.data.data.signingRequest;
  }

  private async signRequest<TRequestBody, TResponseBody>(
    address: string,
    type: SigningRequestTypes,
    requestBody: TRequestBody,
    { cancelToken, networkName }: SignRequestOptions = {},
  ) {
    const pairing = await this.accessors.get(address);
    if (pairing === undefined) {
      throw new Error('The requested account is not paired');
    }

    let signingRequest: SerializedDate<SigningRequestData>;

    try {
      signingRequest = await this.createSigningRequest<TRequestBody>(
        pairing,
        type,
        networkName || this.defaultNetworkName,
        requestBody,
      );

      while (signingRequest.status === 'PENDING') {
        await waitFor(SIGNING_REQUEST_POLLING_INTERVAL);
        if (cancelToken?.cancelled) {
          // TODO: send cancel request
          signingRequest.status = SigningRequestStatus.CANCELLED;
          break;
        }
        signingRequest = (await this.getSigningRequest(signingRequest.id)) ?? signingRequest;
      }
    } catch (err) {
      if (isAxiosError(err) && err.code === '404') {
        await this.accessors.update(address, undefined);
        for (const listener of this.onDisconnectListeners) {
          listener(address);
        }
        throw new PairingExpiredError();
      }
      throw err;
    }

    if (signingRequest.status !== 'APPROVED') {
      throw new SignRequestError(signingRequest.status);
    }

    const decrypted = decryptEnvelope<{}, TResponseBody & {}>(
      toKey(decodeBase64(pairing.accountTransportEd25519PublicKeyB64), KeyTypes.Ed25519PublicKey),
      toKey(decodeBase64(pairing.dappEd25519SecretKeyB64), KeyTypes.Ed25519SecretKey),
      signingRequest.responseEnvelope!,
    );
    return decrypted.privateMessage;
  }

  // region Public API

  /**
   * Requests a connection to an account (internally known as pairing).
   * @returns either the address of the connected account, or undefined if the
   * connection was cancelled.
   */
  async connect() {
    const { publicKey, secretKey } = createEd25519KeyPair();
    const dappEd25519PublicKeyB64 = encodeBase64(publicKey.key);

    const { id: pairingId } = await this.createPairingRequest(dappEd25519PublicKeyB64);
    const url = new URL(`${this.frontendBaseURL}/pairing`);
    url.searchParams.set('pairingId', pairingId);
    const promptWindow = await openPrompt(url.href);
    const finalizedPairing = await waitForPromptResponse<FinalizedPairingData>(promptWindow);

    if (finalizedPairing === undefined) {
      await this.deletePairing(pairingId, secretKey, publicKey);
      return undefined;
    }

    await this.accessors.update(finalizedPairing.account.accountAddress, {
      accountAddress: finalizedPairing.account.accountAddress,
      accountAlias: finalizedPairing.account.userSubmittedAlias ?? undefined,
      accountEd25519PublicKeyB64: finalizedPairing.account.ed25519PublicKeyB64,
      accountTransportEd25519PublicKeyB64: finalizedPairing.account.transportEd25519PublicKeyB64,
      currSequenceNumber: finalizedPairing.maxDappSequenceNumber,
      dappEd25519PublicKeyB64: encodeBase64(publicKey.key),
      dappEd25519SecretKeyB64: encodeBase64(secretKey.key),
      pairingId: finalizedPairing.id,
    });

    return finalizedPairing.account.accountAddress;
  }

  async disconnect(address: string) {
    const pairing = await this.accessors.get(address);
    if (pairing === undefined) {
      throw new Error('The specified account is not paired');
    }

    const dappEd25519SecretKey = decodeBase64(pairing.dappEd25519SecretKeyB64);
    const dappEd25519PublicKey = decodeBase64(pairing.dappEd25519PublicKeyB64);
    await this.deletePairing(
      pairing.pairingId,
      toKey(dappEd25519SecretKey, KeyTypes.Ed25519SecretKey),
      toKey(dappEd25519PublicKey, KeyTypes.Ed25519PublicKey),
    );
    await this.accessors.update(address, undefined);
    for (const listener of this.onDisconnectListeners) {
      listener(address);
    }
  }

  async signMessage(address: string, payload: SignMessageRequestBody, options?: SignRequestOptions) {
    const response = await this.signRequest<SignMessageRequestBody, SignMessageResponseBody>(
      address,
      SigningRequestTypes.SIGN_MESSAGE,
      payload,
      options,
    );
    validateSignMessageResponse(response);
    return response;
  }

  async signAndSubmitTransaction(
    address: string,
    payload: SignTransactionRequestBody,
    options?: SignRequestOptions,
  ): Promise<SignTransactionResponseBody> {
    const serializedPayload = ensurePayloadSerialized(payload);
    const response = await this.signRequest<SerializedPayload, SignTransactionResponseBody>(
      address,
      SigningRequestTypes.SIGN_AND_SUBMIT_TRANSACTION,
      serializedPayload,
      options,
    );
    validateSignAndSubmitTransactionResponse(response);
    return response;
  }

  async getConnectedAccounts() {
    const pairings = await this.accessors.getAll();
    return Object.values(pairings).map(({ accountAddress, accountAlias, accountEd25519PublicKeyB64 }) => ({
      accountAddress,
      accountAlias,
      accountEd25519PublicKeyB64,
    }));
  }

  // endregion

  private readonly onDisconnectListeners = new Set<OnDisconnectListener>();

  onDisconnect(listener: OnDisconnectListener): OnDisconnectListenerCleanup {
    this.onDisconnectListeners.add(listener);
    return () => this.onDisconnectListeners.delete(listener);
  }
}
