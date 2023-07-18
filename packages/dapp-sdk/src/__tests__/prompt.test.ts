// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { openPrompt, waitForPromptResponse } from '../prompt';
import MockWindowAPI from './MockWindowAPI';

const mockWindowApi = new MockWindowAPI();
afterEach(() => {
  mockWindowApi.mockClear();
});

describe(openPrompt, () => {
  const mockPromptUrl = 'https://website.com/prompt';

  it("throws an error if the prompt doesn't open", async () => {
    mockWindowApi.open.mockReturnValueOnce(null);
    expect(openPrompt(mockPromptUrl)).rejects.toThrowError("Couldn't open prompt");
  });

  it('opens a prompt and returns its reference', async () => {
    const mockPromptWindow = mockWindowApi.interceptWindowOpen();
    const promptWindow = await openPrompt(mockPromptUrl);
    expect(promptWindow).toBe(mockPromptWindow);
    expect(promptWindow.closed).toBeFalsy();
    expect(promptWindow.location.href).toEqual(mockPromptUrl);
  });
});

describe(waitForPromptResponse, () => {
  it('returns undefined when the prompt is closed', async () => {
    const mockPromptWindow = { closed: false };
    const poller = waitForPromptResponse(mockPromptWindow as Window);
    expect(mockWindowApi.listeners.size === 1);

    mockPromptWindow.closed = true;
    const response = await poller;
    expect(mockWindowApi.listeners.size === 0);
    expect(response).toBeUndefined();
  });

  it('ignores messages that are not from the prompt', async () => {
    const mockPromptWindow = { closed: false };
    const poller = waitForPromptResponse(mockPromptWindow as Window);
    expect(mockWindowApi.listeners.size === 1);

    const mockMessage = { data: "I'm merely jesting" };
    await mockWindowApi.postMessageAs(mockMessage, {});
    expect(mockWindowApi.listeners.size === 1);

    mockPromptWindow.closed = true;
    const response = await poller;
    expect(mockWindowApi.listeners.size === 0);
    expect(response).toBeUndefined();
  });

  it('returns messages received from the prompt', async () => {
    const mockPromptWindow = { closed: false };
    const poller = waitForPromptResponse(mockPromptWindow as Window);
    expect(mockWindowApi.listeners.size === 1);

    const mockMessage = { data: "I'm merely jesting" };
    await mockWindowApi.postMessageAs(mockMessage, mockPromptWindow);
    expect(mockWindowApi.listeners.size === 0);

    const response = await poller;
    expect(response).toBe(mockMessage);
  });
});
