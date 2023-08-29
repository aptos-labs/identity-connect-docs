// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { SigningRequestStatus, SignMessageRequestBody, SignMessageResponseBody } from '@identity-connect/api';
import { createEd25519KeyPair, deriveAccountTransportEd25519Keypair } from '@identity-connect/crypto';
import { AptosAccount } from 'aptos';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { randomUUID } from 'crypto';
import { ICDappClient } from '../client';
import { SignRequestError } from '../errors';
import { DappPairingData } from '../state';
import MockWindowAPI from './MockWindowAPI';
import { makeMockDappState, makeResponseEnvelope, wrapPromise } from './testUtils';

const mockPairingId = 'mock-pairing-id';
const mockDappId = 'mock-dapp-id';
const mockWindowApi = new MockWindowAPI();
const mockAxios = new MockAdapter(axios);

const { mockDappState, mockDappStateAccessors } = makeMockDappState();
const dappClientConfig = { accessors: mockDappStateAccessors };

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  mockWindowApi.mockClear();
  mockDappState.pairings = {};
  mockAxios.reset();
});

function setupMockPairing() {
  const pairingId = randomUUID();
  const dappKeys = createEd25519KeyPair();
  const dappEd25519SecretKeyB64 = Buffer.from(dappKeys.secretKey.key).toString('base64');
  const dappEd25519PublicKeyB64 = Buffer.from(dappKeys.publicKey.key).toString('base64');

  const accountKeys = createEd25519KeyPair();
  const mockAccount = new AptosAccount(accountKeys.secretKey.key);
  const accountAddress = mockAccount.address().toString();
  const accountEd25519PublicKeyB64 = Buffer.from(mockAccount.signingKey.publicKey).toString('base64');

  const transportKeys = deriveAccountTransportEd25519Keypair(accountKeys.secretKey, accountKeys.publicKey);
  const accountTransportEd25519PublicKeyB64 = Buffer.from(transportKeys.publicKey.key).toString('base64');

  const mockPairing: DappPairingData = {
    accountAddress,
    accountEd25519PublicKeyB64,
    accountTransportEd25519PublicKeyB64,
    currSequenceNumber: 0,
    dappEd25519PublicKeyB64,
    dappEd25519SecretKeyB64,
    pairingId,
  };

  // Manually add mock pairing to state
  mockDappState.pairings = {
    [accountAddress]: mockPairing,
  };

  return { accountAddress, accountKeys, dappKeys, pairingId, transportKeys };
}

describe(ICDappClient, () => {
  describe('connect', () => {
    it('returns undefined when the user closes the prompt', async () => {
      const client = new ICDappClient(mockDappId, dappClientConfig);

      const mockPairing = { id: mockPairingId };
      mockAxios.onPost('v1/pairing').reply(200, { data: { pairing: mockPairing } });

      const mockPromptWindow = mockWindowApi.interceptWindowOpen();
      const connectionRequest = client.connect();

      await mockWindowApi.waitForListeners();
      expect(mockWindowApi.listeners.size).toEqual(1);

      mockPromptWindow.closed = true;
      await jest.runAllTimersAsync();

      const response = await connectionRequest;
      expect(mockWindowApi.listeners.size).toEqual(0);
      expect(response).toBeUndefined();
    });
    it('persists a valid pairing when the user approves', async () => {
      const client = new ICDappClient(mockDappId, dappClientConfig);

      const mockPairingRequest = { id: mockPairingId };
      mockAxios.onPost('v1/pairing').reply(200, { data: { pairing: mockPairingRequest } });
      const mockPromptWindow = mockWindowApi.interceptWindowOpen();
      const connectionRequest = client.connect();

      await mockWindowApi.waitForListeners();
      expect(mockWindowApi.listeners.size).toEqual(1);

      const mockAccount = new AptosAccount();
      const accountAddress = mockAccount.address().toString();
      const ed25519PublicKeyB64 = Buffer.from(mockAccount.signingKey.publicKey).toString('base64');
      const userSubmittedAlias = 'Mock account';
      const mockFinalizedPairing = {
        ...mockPairingRequest,
        account: {
          accountAddress,
          ed25519PublicKeyB64,
          userSubmittedAlias,
        },
        currDappSequenceNumber: 0,
        status: 'FINALIZED',
      };
      await mockWindowApi.postMessageAs(mockFinalizedPairing, mockPromptWindow);

      const connectedAccountAddress = await connectionRequest;
      expect(connectedAccountAddress).toBeDefined();
      expect(connectedAccountAddress).toEqual(accountAddress);

      const pairings = Object.values(mockDappState.pairings);
      expect(pairings).toHaveLength(1);
      const pairing = pairings[0];
      expect(pairing.pairingId).toEqual(mockPairingId);

      expect(mockPromptWindow.location?.href).toBeDefined();
      const maybePairingId = mockPromptWindow.location?.searchParams.get('pairingId');
      expect(maybePairingId).toBeDefined();
      expect(maybePairingId).toEqual(mockPairingId);
    });
  });
  describe('signRequest', () => {
    it('throws when cancelled', async () => {
      const { accountAddress, pairingId } = setupMockPairing();
      const client = new ICDappClient(mockDappId, dappClientConfig);

      const signingRequest = {
        id: randomUUID(),
        status: 'PENDING',
      };

      mockAxios.onPost(`v1/pairing/${pairingId}/signing-request`).reply(200, { data: { signingRequest } });
      mockAxios.onGet(`v1/signing-requests/${signingRequest.id}`).reply(200, { data: { signingRequest } });

      const cancelToken = { cancelled: false };
      const signMessageRequest = wrapPromise(
        client.signMessage(
          accountAddress,
          {
            message: 'message',
            nonce: 'nonce',
          },
          { cancelToken },
        ),
      );

      await jest.runOnlyPendingTimersAsync();
      expect(signMessageRequest.pending).toBeTruthy();

      cancelToken.cancelled = true;
      jest.runOnlyPendingTimers();

      await expect(signMessageRequest).rejects.toThrow(new SignRequestError(SigningRequestStatus.CANCELLED));
    });
    it('throws when rejected', async () => {
      const { accountAddress, pairingId } = setupMockPairing();
      const client = new ICDappClient(mockDappId, dappClientConfig);

      const signingRequest = {
        id: randomUUID(),
        status: 'REJECTED',
      };

      mockAxios.onPost(`v1/pairing/${pairingId}/signing-request`).reply(200, { data: { signingRequest } });
      const signMessageRequest = client.signMessage(accountAddress, { message: 'message', nonce: 'nonce' });

      await expect(signMessageRequest).rejects.toThrow(new SignRequestError(SigningRequestStatus.REJECTED));
    });
    it('throws when invalid', async () => {
      const { accountAddress, pairingId } = setupMockPairing();
      const client = new ICDappClient(mockDappId, dappClientConfig);

      const signingRequest = {
        id: randomUUID(),
        status: 'INVALID',
      };

      mockAxios.onPost(`v1/pairing/${pairingId}/signing-request`).reply(200, { data: { signingRequest } });
      const signMessageRequest = client.signMessage(accountAddress, { message: 'message', nonce: 'nonce' });

      await expect(signMessageRequest).rejects.toThrow(new SignRequestError(SigningRequestStatus.INVALID));
    });
    it('returns decrypted response when successful ', async () => {
      const { accountAddress, accountKeys, dappKeys, pairingId } = setupMockPairing();
      const client = new ICDappClient(mockDappId, dappClientConfig);

      const responseBody = { data: 'response' };
      const responseEnvelope = await makeResponseEnvelope(accountKeys.secretKey, dappKeys.publicKey, responseBody);

      const signingRequest = {
        id: randomUUID(),
        responseEnvelope,
        status: 'PENDING',
      };

      mockAxios.onPost(`v1/pairing/${pairingId}/signing-request`).reply(200, { data: { signingRequest } });
      mockAxios.onGet(`v1/signing-requests/${signingRequest.id}`).reply(200, { data: { signingRequest } });

      const signRequest = wrapPromise(client.signMessage(accountAddress, { message: 'message', nonce: 'nonce' }));

      // Test that the request stays pending until approved
      await jest.runOnlyPendingTimersAsync();
      expect(signRequest.pending).toBeTruthy();
      await jest.runOnlyPendingTimersAsync();
      expect(signRequest.pending).toBeTruthy();

      signingRequest.status = 'APPROVED';
      jest.runOnlyPendingTimers();
      expect(signRequest).resolves.toEqual(responseBody);
    });
  });
  describe('signMessage', () => {
    it('returns a signed message', async () => {
      const { accountAddress, dappKeys, pairingId, transportKeys } = setupMockPairing();
      const client = new ICDappClient(mockDappId, dappClientConfig);

      const signMessagePayload: SignMessageRequestBody = {
        message: 'mock-message',
        nonce: 'mock-nonce',
      };
      const mockSignMessageResponse: SignMessageResponseBody = {
        address: '0xb0b',
        application: 'mock-application',
        chainId: 1,
        fullMessage: 'mock-full-message',
        message: 'mock-message',
        nonce: 'mock-nonce',
        prefix: 'mock-prefix',
        signature: 'mock-signature',
      };

      const signingRequest = {
        id: randomUUID(),
        responseEnvelope: await makeResponseEnvelope(
          transportKeys.secretKey,
          dappKeys.publicKey,
          mockSignMessageResponse,
        ),
        status: 'APPROVED',
      };

      mockAxios.onPost(`v1/pairing/${pairingId}/signing-request`).reply(200, { data: { signingRequest } });
      const signMessageResponse = await client.signMessage(accountAddress, signMessagePayload);

      expect(signMessageResponse).toBeDefined();
      expect(signMessageResponse).toEqual(mockSignMessageResponse);
    });
  });
});
