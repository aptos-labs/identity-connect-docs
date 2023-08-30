# Wallet SDK

The Wallet SDK is intented for Aptos wallet developers that want to allow the user to connect to accounts to IC through their wallet.

For now, the Wallet SDK is only available for Typescript, but it’ll very soon be available for Rust and to many more languages thanks to native bindings.

## Initialization

The main entrypoint of the Wallet SDK is the `ICWalletClient` class. It provides APIs to create and update a connection to IC, as well as fetching and responding to signature requests.

Some metadata is required in order to initialize the client

```tsx
import { ICWalletClient, WalletInfo } from '@identity-connect/wallet-sdk';

const walletInfo: WalletInfo = {
  deviceIdentifier: ...,
  platform: 'native-app',
  platformOS: 'ios',
  walletName: 'Petra',
};

const icWalletClient = new ICWalletClient(walletInfo);
```

The client needs to persist a state in order to keep track of connections.
It's required to provide a custom implementation of state accessors in the constructor options.

```tsx
import {
  ICWalletClient,
  WalletInfo,
  WalletConnectionData,
} from '@identity-connect/wallet-sdk';

const walletInfo: WalletInfo = { ... };

const inMemoryStorage: { [id: string]: WalletConnectionData } = {};
const accessors = {
  get: (id: string) => inMemoryStorage[id],
	getAll: () => ({ ...inMemoryStorage }),
  update: (id: string, connection?: WalletConnectionData) => {
    inMemoryStorage[id] = connection;
  },
};

const icWalletClient = new ICWalletClient(walletInfo, accessors);
```

## Connect wallet to IC

Once the Wallet client is initialized, it can be used to accept a connection request.

The user can start a connection request from the IC dashboard, an the connection request id can be scanned as QR code or copied to the clipboard.

The wallet is responsible for allowing the user to either scan the QR code or manually paste the request id.

In order to establish a connection with an account managed by the wallet, the wallet requires it to provide:

- a proof of ownership
- a transport keypair used for encrypted end-to-end communication

The following example shows how to obtain them using the wallet SDK

```tsx
import {
  AccountConnectionAction,
  Ed25519PublicKey,
	KeyTypes,
  createSerializedAccountInfo,
  deriveAccountTransportEd25519Keypair,
	toKey,
} from '@identity-connect/crypto';

// Public key and sign callback for the account we wish to connect
const ed25519PublicKey = toKey(publicKeyBytes, KeyTypes.Ed25519PublicKey)
const signCallback = (buffer: UInt8Array): UInt8Array => { ... };

// Derive a deterministic transport keypair from the account's public key
const transportKeys = await deriveAccountTransportEd25519Keypair(
	signCallback,
	ed25519PublicKey,
);

// Request a signed intent to connect the account to IC
const info = await createSerializedAccountInfo(
  signCallback,
  ed25519PublicKey,
  transportKeys.publicKey,
  AccountConnectionAction.ADD,
  connectionRequestId,
  accountAddress,
);
```

The below utility function, will perform the two actions and pack them together
into a single `WalletAccountConnectInfo` that is the input type of further methods

```tsx
import {
  AccountConnectionAction,
	KeyTypes,
	WalletAccountConnectInfo,
	toKey,
} from '@identity-connect/crypto';
import { createWalletAccountConnectInfo } from '@identity-connect/wallet-sdk';

const info: WalletAccountConnectInfo = await createWalletAccountConnectInfo(
  signCallback,
  toKey(publicKeyBytes, KeyTypes.Ed25519PublicKey),
  action,
  walletId,
);
```

The wallet should allow the user to choose which accounts to be included in the connection, and for each of them request the signed connection info.

With that, the connection can be finalized by calling `finalizeConnection` as follows:

```tsx
import { WalletAccountConnectInfo } from '@identity-connect/wallet-sdk';

const allConnectInfo: WalletAccountConnectInfo[] = ...;
await walletClient.finalizeConnection(connectionRequestId, allConnectInfo);
```

The accounts are now successfully connected and will show up in the account connection prompt when connecting to a dapp.

## Fetch pending signature requests

Once the wallet is connected, you can fetch pending signature request for all the accounts associated with the connection by calling the `getAllSigningRequests` method.

By checking the `type` property of each request, you can type-infer the body of the request.

```tsx
const requests = await icWalletClient.getAllSigningRequests();
for (const request of requests) {
  if (request.type === SigningRequestTypes.SIGN_MESSAGE) {
		// request.body will be a SignMessageRequestBody
  } else if (request.type === SigningRequestTypes.SIGN_AND_SUBMIT_TRANSACTION) {
    // request.body will be a SerializedPayload
  }
}
```

## Respond to a signature request

In the previous section we saw how to fetch pending requests. Ideally, the wallet would display the requests to the user, and allow them to either approve or reject them.

The wallet client provides `approveSigningRequest` and `rejectSigningRequest` to do so.

Below, you can find an example on how to approve a message signature request, and return the message signature.

```tsx
const { message, nonce } = request.body;
const application = ...
const chainId = ...
const prefix = ...

const fullMessage = ...
const fullMessageBytes = new TextEncoder().encode(fullMessage);

const signatureBytes = await signCallback(fullMessageBytes);
const signature = Buffer.from(signatureBytes).toString('hex');
await walletClient.approveSigningRequest(request.id, request.pairingId, {
  address: request.accountAddress,
  application,
  chainId,
  fullMessage,
  message,
  nonce,
  prefix,
  signature,
});
```

## Disconnect wallet

Disconnecting the wallet from IC is done very simply by calling the `removeConnection` method on the wallet client.

```tsx
await icWalletClient.removeConnection(id);
```

The call will instruct the server to expire the connection, as well as remove it from the client’s state.
