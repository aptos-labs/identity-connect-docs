// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import {
  AccountData,
  AnonymousPairingData,
  AuthenticatedWalletData,
  BackendErrorResponse,
  BackendResponse,
  BaseFinalizedPairingData,
  GetDappData,
  NewPairingData,
  NewWalletData,
  PairingData,
  ProjectData,
  SerializedDate,
  SigningRequestData,
  UserData,
  WalletData,
} from './types';

// region Dapp

export type GetDappResponse = BackendResponse<{ dapp: GetDappData }>;
export type GetDappSerializedResponse = SerializedDate<GetDappResponse>;

// endregion

// region Wallet

export type CreateWalletConnectionResponse = BackendResponse<{
  wallet: NewWalletData;
}>;
export type CreateWalletConnectionSerializedResponse = SerializedDate<CreateWalletConnectionResponse>;

export type GetWalletResponse = BackendResponse<{
  wallet: WalletData;
}>;
export type GetWalletSerializedResponse = SerializedDate<GetWalletResponse>;

export type FinalizeConnectionResponse = BackendResponse<{
  wallet: AuthenticatedWalletData;
}>;
export type FinalizeConnectionSerializedResponse = SerializedDate<FinalizeConnectionResponse>;

// endregion

// region Pairing

export type CreatePairingResponse = BackendResponse<{ pairing: NewPairingData }>;
export type CreatePairingSerializedResponse = SerializedDate<CreatePairingResponse>;

export type GetPairingResponse = BackendResponse<{ pairing: PairingData }>;
export type GetPairingSerializedResponse = SerializedDate<GetPairingResponse>;

export type FinalizePairingResponse = BackendResponse<{ pairing: BaseFinalizedPairingData }> | BackendErrorResponse;
export type FinalizePairingSerializedResponse = SerializedDate<FinalizePairingResponse>;

export type FinalizeAnonymousPairingResponse = BackendResponse<{ pairing: AnonymousPairingData }>;
export type FinalizeAnonymousPairingSerializedResponse = SerializedDate<FinalizeAnonymousPairingResponse>;

// endregion

// region Signing request

export type CreateSigningRequestResponse = BackendResponse<{
  signingRequest: SigningRequestData;
}>;
export type CreateSigningRequestSerializedResponse = SerializedDate<CreateSigningRequestResponse>;

export type GetSigningRequestResponse = BackendResponse<{
  signingRequest: SigningRequestData;
}>;
export type GetSigningRequestSerializedResponse = SerializedDate<GetSigningRequestResponse>;

export type GetSigningRequestsResponse = BackendResponse<{
  signingRequests: SigningRequestData[];
}>;
export type GetSigningRequestsSerializedResponse = SerializedDate<GetSigningRequestsResponse>;

export type RespondToSignRequestResponse = BackendResponse<{
  signingRequest: SigningRequestData;
}>;
export type RespondToSignRequestSerializedResponse = SerializedDate<RespondToSignRequestResponse>;

export type CancelSigningRequestResponse = BackendResponse<{
  signingRequest: SigningRequestData;
}>;
export type CancelSigningRequestSerializedResponse = SerializedDate<CancelSigningRequestResponse>;

// endregion

// region Other

export type GetUserAccountsResponse = BackendResponse<{ accounts: AccountData[] }>;
export type GetUserAccountsSerializedResponse = SerializedDate<GetUserAccountsResponse>;

export type GetUserProjectsResponse = BackendResponse<{ projects: ProjectData[] }>;
export type GetUserProjectsSerializedResponse = SerializedDate<GetUserProjectsResponse>;

export type GetUserDataResponse = BackendResponse<{ user: UserData }>;
export type GetUserDataSerializedResponse = SerializedDate<GetUserDataResponse>;

export type GetUserPairingsResponse = BackendResponse<{ pairings: PairingData[] }>;
export type GetUserPairingsSerializedResponse = SerializedDate<GetUserPairingsResponse>;

// endregion
