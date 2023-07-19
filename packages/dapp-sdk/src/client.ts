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
  SerializedPayload,
  SigningRequestStatus,
  SigningRequestTypes,
  SignMessageRequestBody,
  SignMessageResponseBody,
  SignTransactionRequestBody,
  SignTransactionResponseBody,
} from '@identity-connect/api';
import {
  createEd25519KeyPair,
  decryptEnvelope,
  encryptAndSignEnvelope,
  KeyTypes,
  toKey,
} from '@identity-connect/crypto';
import axios, { AxiosInstance, CreateAxiosDefaults } from 'axios';
import { DEFAULT_FRONTEND_URL } from './constants';
import { SignRequestError } from './errors';
import { openPrompt, waitForPromptResponse } from './prompt';
import { DappPairingData, DappStateAccessors, windowStateAccessors } from './state';
import { CancelToken } from './types';
import { validateSignAndSubmitTransactionResponse, validateSignMessageResponse } from './utils';

const SIGNING_REQUEST_POLLING_INTERVAL = 1000;

async function waitFor(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export interface ICDappClientConfig {
  accessors?: DappStateAccessors;
  axiosConfig?: CreateAxiosDefaults;
  frontendBaseURL?: string;
}

export default class ICDappClient {
  private readonly accessors: DappStateAccessors;
  private readonly axiosInstance: AxiosInstance;
  private readonly frontendBaseURL: string;

  constructor(
    private readonly dappId: string,
    { accessors = windowStateAccessors, axiosConfig, frontendBaseURL = DEFAULT_FRONTEND_URL }: ICDappClientConfig = {},
  ) {
    this.accessors = accessors;
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

  private async createSigningRequest<TRequestBody>(pairing: DappPairingData, type: string, requestBody: TRequestBody) {
    const dappEd25519SecretKey = Buffer.from(pairing.dappEd25519SecretKeyB64, 'base64');
    const dappEd25519PublicKey = Buffer.from(pairing.dappEd25519PublicKeyB64, 'base64');
    const accountTransportEd25519PublicKey = Buffer.from(pairing.accountTransportEd25519PublicKeyB64, 'base64');

    const sequenceNumber = pairing.currSequenceNumber;
    const requestEnvelope = await encryptAndSignEnvelope<any, any>(
      toKey(dappEd25519SecretKey, KeyTypes.Ed25519SecretKey),
      toKey(dappEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      toKey(accountTransportEd25519PublicKey, KeyTypes.Ed25519PublicKey),
      sequenceNumber + 1,
      { requestType: type },
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

  async cancelSigningRequest(pairing: DappPairingData, id: string) {
    const sequenceNumber = pairing.currSequenceNumber;
    const dappEd25519SecretKey = Buffer.from(pairing.dappEd25519SecretKeyB64, 'base64');
    const dappEd25519PublicKey = Buffer.from(pairing.dappEd25519PublicKeyB64, 'base64');
    const accountEd25519PublicKey = Buffer.from(pairing.accountEd25519PublicKeyB64, 'base64');

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
    cancelToken?: CancelToken,
  ) {
    const pairing = await this.accessors.get(address);
    if (pairing === undefined) {
      throw new Error('The requested account is not paired');
    }
    let signingRequest = await this.createSigningRequest<TRequestBody>(pairing, type, requestBody);

    while (signingRequest.status === 'PENDING') {
      await waitFor(SIGNING_REQUEST_POLLING_INTERVAL);
      if (cancelToken?.cancelled) {
        // TODO: send cancel request
        signingRequest.status = SigningRequestStatus.CANCELLED;
        break;
      }
      signingRequest = (await this.getSigningRequest(signingRequest.id)) ?? signingRequest;
    }

    if (signingRequest.status !== 'APPROVED') {
      throw new SignRequestError(signingRequest.status);
    }

    const decrypted = decryptEnvelope<{}, TResponseBody & {}>(
      toKey(Buffer.from(pairing.accountTransportEd25519PublicKeyB64, 'base64'), KeyTypes.Ed25519PublicKey),
      toKey(Buffer.from(pairing.dappEd25519SecretKeyB64, 'base64'), KeyTypes.Ed25519SecretKey),
      signingRequest.responseEnvelope!,
    );
    return decrypted.privateMessage;
  }

  // region Public API

  async connect() {
    const { publicKey, secretKey } = createEd25519KeyPair();
    const dappEd25519PublicKeyB64 = Buffer.from(publicKey.key).toString('base64');

    const { id: pairingId } = await this.createPairingRequest(dappEd25519PublicKeyB64);
    const promptWindow = await openPrompt(`${this.frontendBaseURL}/pairing/${pairingId}`);
    const finalizedPairing = await waitForPromptResponse<FinalizedPairingData>(promptWindow);

    if (finalizedPairing === undefined) {
      // TODO: cancel pairing request
      return undefined;
    }

    await this.accessors.update(finalizedPairing.account.accountAddress, {
      accountAddress: finalizedPairing.account.accountAddress,
      accountAlias: finalizedPairing.account.userSubmittedAlias ?? undefined,
      accountEd25519PublicKeyB64: finalizedPairing.account.ed25519PublicKeyB64,
      accountTransportEd25519PublicKeyB64: finalizedPairing.account.transportEd25519PublicKeyB64,
      currSequenceNumber: finalizedPairing.maxDappSequenceNumber,
      dappEd25519PublicKeyB64: Buffer.from(publicKey.key).toString('base64'),
      dappEd25519SecretKeyB64: Buffer.from(secretKey.key).toString('base64'),
      pairingId: finalizedPairing.id,
    });

    return finalizedPairing.account.accountAddress;
  }

  async disconnect(address: string) {
    // TODO: call to backend
    await this.accessors.update(address, undefined);
  }

  async signMessage(address: string, payload: SignMessageRequestBody, cancelToken?: CancelToken) {
    const response = await this.signRequest<SignMessageRequestBody, SignMessageResponseBody>(
      address,
      SigningRequestTypes.SIGN_MESSAGE,
      payload,
      cancelToken,
    );
    validateSignMessageResponse(response);
    return response;
  }

  async signAndSubmitTransaction(
    address: string,
    payload: SignTransactionRequestBody,
    cancelToken?: CancelToken,
  ): Promise<SignTransactionResponseBody> {
    const serializedPayload = ensurePayloadSerialized(payload);
    const response = await this.signRequest<SerializedPayload, SignTransactionResponseBody>(
      address,
      SigningRequestTypes.SIGN_AND_SUBMIT_TRANSACTION,
      serializedPayload,
      cancelToken,
    );
    validateSignAndSubmitTransactionResponse(response);
    return response;
  }

  // endregion
}
