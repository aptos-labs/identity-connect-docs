# Dapp SDK

The Dapp SDK is intented for Dapp developers that want to allow the user to connect to the Dapp through IC.

For now, the Dapp SDK is only available for Typescript, but it’ll very soon be available for Rust and to many more languages thanks to native bindings.

💡 **Note**: for web Dapps, we’re planning to include the Dapp SDK into the Wallet Adapter as a built-in provider. This means that using the Wallet Adapter will give your dapp access to IC for free.

💡 **Note**: In order to enable your Dapp to work with IC, it first need to be registered through the IC dashboard.
TODO expand on this and add reference to external doc

## Client initialization

The main entrypoint of the Dapp SDK is the `ICDappClient` class. It allows the Dapp to connect to accounts using IC and and send them signature requests.

In order to initialize the client, the `dappId` associated to your registered Dapp needs to be provided as first argument.

```tsx
import { DAPP_ID } from '@src/constants';
import { ICDappClient } from '@identity-connect/dapp-sdk';

const icDappClient = new ICDappClient(DAPP_ID);
```

The client needs to persist a state in order to keep pairings alive across dapp sessions. By default, we are using the [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), which should work out of the box for most web dapps. For more complex dapps, the developer should provide a custom implementation of state accessors in the constructor options.

```tsx
import { DAPP_ID } from '@src/constants';
import { ICDappClient, DappPairingData, DappStateAccessors } from '@identity-connect/dapp-sdk';

const inMemoryStorage: { [address: string]: DappPairingData } = {};
const accessors: DappStateAccessors = {
  get: (address: string) => inMemoryStorage[address],
  update: (address: string, pairing?: DappPairingData) => {
    inMemoryStorage[address] = pairing;
  },
};

const icDappClient = new ICDappClient(DAPP_ID, { accessors });
```

**Note**: in the future we might move the default web storage accessors in a separate package “web” package.

## Connect an account to your Dapp

Once the Dapp client is initialized, we can request an account connection by calling the `connect` method.

```tsx
// This will open up a connection prompt, in which the user
// can choose to connect one of their accounts
const accountAddress = await icDappClient.connect();

if (accountAddress !== undefined) {
  // The user approved the connection to an account, and its address is returned
  console.log(`Account with address ${accountAddress} is now connected.`)
}
```

If the user is not authenticated yet, they will be prompted to sign in. When signed in, they will be able to either:

- Pair one of the accounts they previously connected to IC
- Start an anonymous pairing (TODO not available yet in the prompt)

If the user closes the prompt without selecting an account, the call will return `undefined`, otherwise the paired account’s address is returned.

## Send signature requests

Once an account is connected to the Dapp, we can send signature requests using either the `signMessage` or the `signAndSubmitTransaction` methods.

The signature API adheres to the [Aptos wallet standard Dapp API](https://aptos.dev/standards/wallets/#dapp-api), so it should feel familiar to developers.

Since `ICDappClient` has no concept of “active account”, the signature API expects the signer’s address as first argument.

Below are examples on how to sign a message and a transaction respectively.

```tsx
const nonce = Datetime.now();
const { signature } = await icDappClient.signMessage(signerAddress, {
  message: 'Message to be signed',
	nonce,
});
```

```tsx
const payload = {
  arguments: ['0xb0b', 100],
  function: '0x1::coin::transfer',
  type: 'entry_function_payload' as const,
  type_arguments: ['0x1::aptos_coin::AptosCoin'],
};
const userTxn = await icDappClient.signAndSubmitTransaction(
	signerAddress,
	payload,
);
```

## Disconnect account

Disconnecting an account is done very simply by calling the `disconnect` method on the DappClient.

```tsx
await icDappClient.disconnect(address);
```

The call will instruct the server to expire the pairing, as well as remove it from the client’s state.
