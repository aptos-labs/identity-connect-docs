// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import {
  NetworkName,
  SerializedPayload,
  SigningRequestTypes,
  SignMessageRequestBody,
  RegisteredDappDataBase,
} from '@identity-connect/api';
import { AccountConnectInfoSerialized, Ed25519SecretKey } from '@identity-connect/crypto';

export interface WalletAccountConnectInfo {
  info: AccountConnectInfoSerialized;
  transportEd25519SecretKey: Ed25519SecretKey;
}

export interface BaseSignRequest {
  accountAddress: string;
  createdAt: Date;
  id: string;
  networkName: NetworkName;
  pairingId: string;
  registeredDapp: RegisteredDappDataBase;
}

export interface SignMessageRequest extends BaseSignRequest {
  body: SignMessageRequestBody;
  type: SigningRequestTypes.SIGN_MESSAGE;
}

export interface SignTransactionRequest extends BaseSignRequest {
  body: SerializedPayload;
  type: SigningRequestTypes.SIGN_AND_SUBMIT_TRANSACTION;
}

export type SignRequest = SignMessageRequest | SignTransactionRequest;
