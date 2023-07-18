// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

// Quick polyfill for window, so we don't have to use jsdom
if (global.window === undefined) {
  (global as any).window = {
    addEventListener: jest.fn(),
    open: jest.fn(),
    postMessage: jest.fn(),
    removeEventListener: jest.fn(),
    ...{
      outerHeight: 768,
      outerWidth: 1024,
      screenLeft: 0,
      screenTop: 0,
    },
  };
}

class Signal {
  private isSet: boolean = false;
  private promise?: Promise<void>;
  private resolve?: () => void;

  async wait() {
    if (this.isSet) {
      return;
    }
    if (this.promise === undefined) {
      this.promise = new Promise<void>((resolve) => {
        this.resolve = resolve;
      });
    }
    await this.promise;
  }

  set() {
    this.isSet = true;
    if (this.resolve) {
      this.resolve();
      this.promise = undefined;
      this.resolve = undefined;
    }
  }

  clear() {
    this.isSet = false;
    expect(this.promise).toBeUndefined();
  }
}

class Pipe<T> {
  private buffer: T[] = [];
  private nonEmptySignal = new Signal();

  push(value: T) {
    this.buffer.push(value);
    this.nonEmptySignal.set();
  }

  async pop() {
    await this.nonEmptySignal.wait();
    const first = this.buffer[0];
    this.buffer.shift();
    if (this.buffer.length === 0) {
      this.nonEmptySignal.clear();
    }
    return first;
  }
}

interface MockWindow {
  closed: boolean;
  location?: URL;
}

type MessageListener = (this: Window, event: { data: any }) => void;

export default class MockWindowAPI {
  open = jest.spyOn(window, 'open');
  postMessage = jest.spyOn(window, 'postMessage');
  addEventListener = jest.spyOn(window, 'addEventListener');
  removeEventListener = jest.spyOn(window, 'removeEventListener');

  private messagePipe = new Pipe<any>();
  private hasListenersSignal = new Signal();
  readonly listeners: Set<MessageListener> = new Set();

  constructor() {
    this.postMessage.mockImplementation((message) => {
      this.messagePipe.push(message);
    });

    this.addEventListener.mockImplementation((type, listener: any) => {
      expect(type).toEqual('message');
      this.listeners.add(listener);
      if (this.listeners.size === 1) {
        this.hasListenersSignal.set();
      }
    });

    this.removeEventListener.mockImplementation((type, listener: any) => {
      expect(type).toEqual('message');
      expect(this.listeners.has(listener)).toBeTruthy();
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.hasListenersSignal.clear();
      }
    });
  }

  mockClear() {
    expect(this.listeners.size).toEqual(0);
    this.open.mockClear();
    this.postMessage.mockClear();
    this.addEventListener.mockClear();
    this.removeEventListener.mockClear();
  }

  interceptWindowOpen() {
    const mockWindow: MockWindow = { closed: false, location: undefined };
    this.open.mockImplementationOnce((url) => {
      mockWindow.location = url !== undefined ? new URL(url) : undefined;
      return mockWindow as any as Window;
    });
    return mockWindow;
  }

  async waitForMessage() {
    const message = await this.messagePipe.pop();
    expect(this.postMessage).toHaveBeenCalled();
    return message;
  }

  async waitForListeners() {
    await this.hasListenersSignal.wait();
  }

  async postMessageAs(response: any, source: any = window) {
    expect(this.addEventListener).toHaveBeenCalled();
    for (const listener of this.listeners) {
      listener.call(window, { data: response, source });
    }
  }
}
