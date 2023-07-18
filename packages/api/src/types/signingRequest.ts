// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { SecuredEnvelopeTransport } from '@identity-connect/crypto';

export enum SigningRequestTypes {
  SIGN_AND_SUBMIT_TRANSACTION = 'SIGN_AND_SUBMIT_TRANSACTION',
  SIGN_MESSAGE = 'SIGN_MESSAGE',
  // SIGN_TRANSACTION = 'SIGN_TRANSACTION',
}

export enum SigningRequestStatus {
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
  INVALID = 'INVALID',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
}

export interface SigningRequestData {
  createdAt: Date;
  id: string;
  pairingId: string;
  requestEnvelope: SecuredEnvelopeTransport;
  requestType: SigningRequestTypes;
  responseEnvelope?: SecuredEnvelopeTransport;
  status: SigningRequestStatus;
}
