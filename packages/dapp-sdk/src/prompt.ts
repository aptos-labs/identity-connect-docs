// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

const PROMPT_POLLER_INTERVAL = 500;
const DEFAULT_PROMPT_SIZE = { height: 695, width: 465 };

export async function openPrompt(url: string, size = DEFAULT_PROMPT_SIZE) {
  const { height, width } = size;
  const params = {
    height,
    left: window.screenLeft + window.outerWidth - width,
    popup: true,
    top: window.screenTop,
    width,
  };

  const strParams = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .reduce((acc, entry) => `${acc}, ${entry}`);

  const promptWindow = window.open(url, undefined, strParams);
  if (promptWindow === null) {
    throw new Error("Couldn't open prompt");
  }

  return promptWindow;
}

export async function waitForPromptResponse<TResponseType = any>(promptWindow: Window) {
  return new Promise<TResponseType | undefined>((resolve) => {
    const listeners = {
      onMessage: (message: MessageEvent) => {
        if (message.source === promptWindow) {
          window.removeEventListener('message', listeners.onMessage);
          clearTimeout(listeners.promptPollerId);
          resolve(message.data);
        }
      },
      promptPollerId: setInterval(() => {
        if (promptWindow.closed) {
          window.removeEventListener('message', listeners.onMessage);
          clearTimeout(listeners.promptPollerId);
          resolve(undefined);
        }
      }, PROMPT_POLLER_INTERVAL),
    };

    window.addEventListener('message', listeners.onMessage);
  });
}
