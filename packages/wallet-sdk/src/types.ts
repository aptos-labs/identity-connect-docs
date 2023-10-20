// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { NetworkName, RegisteredDappDataBase, SigningRequestTypes } from '@identity-connect/api';
import { AccountConnectInfoSerialized, Ed25519SecretKey } from '@identity-connect/crypto';
import {
  SerializedSignAndSubmitTransactionRequestArgs,
  SerializedSignTransactionRequestArgs,
  SerializedSignTransactionResponseArgs,
  SignAndSubmitTransactionResponseArgs,
  SignMessageRequestArgs,
  SignMessageResponseArgs,
} from '@identity-connect/wallet-api';

export interface WalletAccountConnectInfo {
  info: AccountConnectInfoSerialized;
  transportEd25519SecretKey: Ed25519SecretKey;
}

export interface BaseSignatureRequest {
  accountAddress: string;
  apiVersion: string;
  createdAt: Date;
  id: string;
  networkName: NetworkName;
  pairingId: string;
  registeredDapp: RegisteredDappDataBase;
}

export interface SignMessageRequest extends BaseSignatureRequest {
  args: SignMessageRequestArgs;
  type: SigningRequestTypes.SIGN_MESSAGE;
}

export interface SignTransactionRequest extends BaseSignatureRequest {
  args: SerializedSignTransactionRequestArgs;
  type: SigningRequestTypes.SIGN_TRANSACTION;
}

export interface SignAndSubmitTransactionRequest extends BaseSignatureRequest {
  args: SerializedSignAndSubmitTransactionRequestArgs;
  type: SigningRequestTypes.SIGN_AND_SUBMIT_TRANSACTION;
}

export type SignatureRequest = SignMessageRequest | SignTransactionRequest | SignAndSubmitTransactionRequest;
export type SerializedSignatureResponseArgs =
  | SignMessageResponseArgs
  | SerializedSignTransactionResponseArgs
  | SignAndSubmitTransactionResponseArgs;
