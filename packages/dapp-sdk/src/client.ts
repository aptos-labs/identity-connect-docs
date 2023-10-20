// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-await-in-loop */

import {
  CancelSigningRequestSerializedResponse,
  CreatePairingSerializedResponse,
  CreateSigningRequestSerializedResponse,
  DEFAULT_BACKEND_URL,
  FinalizedPairingData,
  GetPairingSerializedResponse,
  GetSigningRequestSerializedResponse,
  NetworkName,
  SerializedDate,
  SigningRequestData,
  SigningRequestStatus,
  SigningRequestTypes,
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
import {
  deserializeSignTransactionResponseArgs,
  type SerializedSignAndSubmitTransactionRequestArgs,
  type SerializedSignTransactionRequestArgs,
  type SerializedSignTransactionResponseArgs,
  serializeSignAndSubmitTransactionRequestArgs,
  serializeSignTransactionRequestArgs,
  type SignAndSubmitTransactionRequestArgs,
  type SignAndSubmitTransactionResponseArgs,
  SignMessageRequestArgs,
  SignMessageResponseArgs,
  type SignTransactionRequestArgs,
  type SignTransactionResponseArgs,
  type SignTransactionWithPayloadRequestArgs,
  type SignTransactionWithPayloadResponseArgs,
  type SignTransactionWithRawTxnRequestArgs,
  type SignTransactionWithRawTxnResponseArgs,
} from '@identity-connect/wallet-api';
import axios, { AxiosError, AxiosInstance, CreateAxiosDefaults, isAxiosError } from 'axios';
import { DEFAULT_FRONTEND_URL } from './constants';
import { PairingExpiredError, SignatureRequestError, UnregisteredDappError } from './errors';
import { openPrompt, waitForPromptResponse } from './prompt';
import { DappPairingData, DappStateAccessors, windowStateAccessors } from './state';
import { CancelToken } from './types';
import { validateSignAndSubmitTransactionResponse, validateSignMessageResponse } from './utils';

const API_VERSION = '0.2.0' as const;
const SIGNING_REQUEST_POLLING_INTERVAL = 2500;
const SEQUENCE_NUMBER_MISMATCH_PATTERN = /^Sequence number mismatch, expected (?:\S+ to be )?(\d+)/;

async function waitFor(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function withRetries<Response>(
  requestFn: () => Promise<Response>,
  onError: (err: any) => void,
  retries: number = 1,
) {
  for (let i = 0; i < retries; i += 1) {
    try {
      return await requestFn();
    } catch (err) {
      onError(err);
    }
  }
  return requestFn();
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

  private readonly initPromise?: Promise<void>;

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

    const isClientSideRendering = typeof window !== 'undefined';
    this.initPromise = isClientSideRendering ? this.syncFirstPairing() : undefined;
  }

  private async getPairing(id: string) {
    const response = await this.axiosInstance.get<GetPairingSerializedResponse>(`v1/pairing/${id}`);
    return response.data.data.pairing;
  }

  private async syncFirstPairing() {
    const pairings = await this.accessors.getAll();
    const firstPairing = Object.values(pairings)[0];
    if (firstPairing === undefined) {
      return;
    }

    try {
      const { dappSpecificWallet, maxDappSequenceNumber } = await this.getPairing(firstPairing.pairingId);
      await this.accessors.update(firstPairing.accountAddress, {
        ...firstPairing,
        currSequenceNumber: maxDappSequenceNumber,
        dappWalletId: dappSpecificWallet?.id,
      });
    } catch (err) {
      await this.accessors.update(firstPairing.accountAddress, undefined);
    }
  }

  private async createPairingRequest(dappEd25519PublicKeyB64: string) {
    try {
      const response = await this.axiosInstance.post<CreatePairingSerializedResponse>('v1/pairing', {
        dappEd25519PublicKeyB64,
        dappId: this.dappId,
      });
      return response.data.data.pairing;
    } catch (err) {
      // TODO: export typed errors from API
      if (isAxiosError(err) && err.response?.data?.message === 'Dapp not found') {
        throw new UnregisteredDappError();
      }
      throw err;
    }
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

    let sequenceNumber = pairing.currSequenceNumber + 1;
    return withRetries(
      async () => {
        const requestEnvelope = await encryptAndSignEnvelope<any, any>(
          toKey(dappEd25519SecretKey, KeyTypes.Ed25519SecretKey),
          toKey(dappEd25519PublicKey, KeyTypes.Ed25519PublicKey),
          toKey(accountTransportEd25519PublicKey, KeyTypes.Ed25519PublicKey),
          sequenceNumber,
          { apiVersion: API_VERSION, networkName, requestType: type },
          requestBody,
        );

        const response = await this.axiosInstance.post<CreateSigningRequestSerializedResponse>(
          `v1/pairing/${pairing.pairingId}/signing-request`,
          requestEnvelope,
        );

        await this.accessors.update(pairing.accountAddress, {
          ...pairing,
          currSequenceNumber: sequenceNumber,
        });

        return response.data.data.signingRequest;
      },
      (err) => {
        if (isAxiosError(err)) {
          const errorMessage: string = err.response?.data?.message;
          const expectedSequenceNumber = errorMessage?.match(SEQUENCE_NUMBER_MISMATCH_PATTERN)?.[1];
          if (expectedSequenceNumber !== undefined) {
            sequenceNumber = Number(expectedSequenceNumber);
            return;
          }
        }
        throw err;
      },
    );
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
    await this.initPromise;
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
      throw new SignatureRequestError(signingRequest.status);
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

    // Open the prompt without pairingId (for a snappier ux)
    const url = new URL(`${this.frontendBaseURL}/pairing`);
    const promptWindow = await openPrompt(url.href);

    let pairingId: string;
    try {
      const pendingPairing = await this.createPairingRequest(dappEd25519PublicKeyB64);
      pairingId = pendingPairing.id;
    } catch (err) {
      // Close the prompt and have the dapp handle the error
      promptWindow.close();
      throw err;
    }

    // Update the prompt's URL as soon as a pairingId is available
    url.searchParams.set('pairingId', pairingId);
    promptWindow.location.href = url.href;
    const finalizedPairing = await waitForPromptResponse<FinalizedPairingData>(promptWindow);

    if (finalizedPairing === undefined) {
      // Ignore the result. This is just a courtesy call, so if anything goes wrong
      // the pairing will be removed during scheduled cleanup)
      void this.deletePairing(pairingId, secretKey, publicKey);
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
      dappWalletId: finalizedPairing.dappSpecificWalletId,
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

  async signMessage(address: string, args: SignMessageRequestArgs, options?: SignRequestOptions) {
    const response = await this.signRequest<SignMessageRequestArgs, SignMessageResponseArgs>(
      address,
      SigningRequestTypes.SIGN_MESSAGE,
      args,
      options,
    );
    validateSignMessageResponse(response);
    return response;
  }

  // region signTransaction

  async signTransaction(
    address: string,
    args: SignTransactionWithPayloadRequestArgs,
    options?: SignRequestOptions,
  ): Promise<SignTransactionWithPayloadResponseArgs>;

  async signTransaction(
    address: string,
    args: SignTransactionWithRawTxnRequestArgs,
    options?: SignRequestOptions,
  ): Promise<SignTransactionWithRawTxnResponseArgs>;

  async signTransaction(
    address: string,
    args: SignTransactionRequestArgs,
    options?: SignRequestOptions,
  ): Promise<SignTransactionResponseArgs>;

  async signTransaction(
    address: string,
    args: SignTransactionRequestArgs,
    options?: SignRequestOptions,
  ): Promise<SignTransactionResponseArgs> {
    const serializedRequestArgs = serializeSignTransactionRequestArgs(args);
    const serializedResponseArgs = await this.signRequest<
      SerializedSignTransactionRequestArgs,
      SerializedSignTransactionResponseArgs
    >(address, SigningRequestTypes.SIGN_TRANSACTION, serializedRequestArgs, options);
    return deserializeSignTransactionResponseArgs(serializedResponseArgs);
  }

  // endregion

  async signAndSubmitTransaction(
    address: string,
    args: SignAndSubmitTransactionRequestArgs,
    options?: SignRequestOptions,
  ): Promise<SignAndSubmitTransactionResponseArgs> {
    const serializedRequestArgs = serializeSignAndSubmitTransactionRequestArgs(args);
    try {
      const responseArgs = await this.signRequest<
        SerializedSignAndSubmitTransactionRequestArgs,
        SignAndSubmitTransactionResponseArgs
      >(address, SigningRequestTypes.SIGN_AND_SUBMIT_TRANSACTION, serializedRequestArgs, options);
      validateSignAndSubmitTransactionResponse(responseArgs);
      return responseArgs;
    } catch (e) {
      if (e instanceof AxiosError && e.response?.data?.message) {
        throw new Error(e.response?.data?.message);
      }
      throw e;
    }
  }

  async getConnectedAccounts() {
    await this.initPromise;
    const pairings = await this.accessors.getAll();
    return Object.values(pairings).map(
      ({ accountAddress, accountAlias, accountEd25519PublicKeyB64, dappWalletId }) => ({
        accountAddress,
        accountAlias,
        accountEd25519PublicKeyB64,
        dappWalletId,
      }),
    );
  }

  async offboard(address: string) {
    const pairing = await this.accessors.get(address);
    if (pairing === undefined) {
      throw new Error('This account is not paired');
    }

    const walletId = pairing.dappWalletId;
    if (walletId === undefined) {
      throw new Error('This account cannot be offboarded');
    }

    const promptWindow = await openPrompt(`${this.frontendBaseURL}/offboarding?walletId=${walletId}`);
    const response = await waitForPromptResponse(promptWindow);
    if (response.success === true) {
      // If exported, disconnect the pairing to clean up
      this.disconnect(address);
      return true;
    }
    return false;
  }

  // endregion

  private readonly onDisconnectListeners = new Set<OnDisconnectListener>();

  onDisconnect(listener: OnDisconnectListener): OnDisconnectListenerCleanup {
    this.onDisconnectListeners.add(listener);
    return () => this.onDisconnectListeners.delete(listener);
  }
}
