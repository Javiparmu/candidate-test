import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Chat } from './Chat';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    sendChatMessage: vi.fn(),
    startNewConversation: vi.fn(),
    getChatHistory: vi.fn(),
    deleteChatHistory: vi.fn(),
    streamChatMessage: vi.fn(),
  },
}));

type StreamCallbacks = {
  onToken?: (t: string) => void;
  onComplete?: (c: { conversationId: string; messageId: string }) => void;
  onError?: (e: Error) => void;
};

const mockGetChatHistory = vi.mocked(api.getChatHistory);
const mockStreamChatMessage = vi.mocked(api.streamChatMessage);

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  );
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mockStreamSuccess(tokens: string[], complete?: { conversationId: string; messageId: string }) {
  mockStreamChatMessage.mockImplementation(async (_data: unknown, callbacks: StreamCallbacks) => {
    tokens.forEach((t) => callbacks.onToken?.(t));
    callbacks.onComplete?.(complete ?? { conversationId: 'c1', messageId: 'm1' });
  });
}

function mockStreamError(message: string) {
  mockStreamChatMessage.mockImplementation(async (_data: unknown, callbacks: StreamCallbacks) => {
    callbacks.onError?.(new Error(message));
  });
}

describe('Chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetChatHistory.mockResolvedValue({
      conversations: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    } as any);

    vi.mocked(api.sendChatMessage).mockResolvedValue({
      conversationId: 'conv-123',
      userMessage: { _id: 'msg-1', content: 'Test', role: 'user' },
      assistantMessage: {
        _id: 'msg-2',
        content: 'Response',
        role: 'assistant',
        createdAt: new Date().toISOString(),
      },
    });
  });

  it('should render welcome message when no messages', async () => {
    renderWithProviders(<Chat studentId="test-id" />);

    expect(await screen.findByText(/¡Hola! Soy tu asistente de estudios/)).toBeInTheDocument();
  });

  it('should render chat header', () => {
    renderWithProviders(<Chat studentId="test-id" />);
    expect(screen.getByText('Asistente de Estudios')).toBeInTheDocument();
  });

  describe('Message sending', () => {
    it('should send message when clicking send button', async () => {
      mockStreamSuccess(['Hello', ' world'], { conversationId: 'conv-1', messageId: 'msg-1' });

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'Hi' } });

      fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

      expect(await screen.findByText('Hi')).toBeInTheDocument();
      expect(await screen.findByText('Hello world')).toBeInTheDocument();
    });

    it('should send message when pressing Enter', async () => {
      mockStreamSuccess(['Ok'], { conversationId: 'conv-1', messageId: 'msg-1' });

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'Hello' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(mockStreamChatMessage).toHaveBeenCalled();
      });

      const firstCallArgs = mockStreamChatMessage.mock.calls[0]?.[0] as any;
      expect(firstCallArgs).toEqual(expect.objectContaining({ message: 'Hello' }));

      expect(await screen.findByText('Hello')).toBeInTheDocument();
    });

    it('should show user message immediately (optimistic update)', async () => {
      const d = deferred<void>();
      mockStreamChatMessage.mockImplementation(async (_data: unknown, _callbacks: StreamCallbacks) => {
        await d.promise;
      });

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'Quick' } });

      fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

      expect(await screen.findByText('Quick')).toBeInTheDocument();

      d.resolve();
    });

    it('should show assistant response after API call', async () => {
      mockStreamSuccess(['Assistant ', 'reply'], { conversationId: 'c1', messageId: 'm1' });

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'Hi' } });
      fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

      expect(await screen.findByText('Assistant reply')).toBeInTheDocument();
    });

    it('should disable input while sending', async () => {
      const d = deferred<void>();
      mockStreamChatMessage.mockImplementation(async (_data: unknown, _callbacks: StreamCallbacks) => {
        await d.promise;
      });

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'Hi' } });
      fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

      expect(await screen.findByPlaceholderText('Escribe tu pregunta...')).toBeDisabled();

      d.resolve();
    });

    it('should show typing indicator while waiting for response', async () => {
      const d = deferred<void>();
      mockStreamChatMessage.mockImplementation(async (_data: unknown, _callbacks: StreamCallbacks) => {
        await d.promise;
      });

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'Hi' } });
      fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

      expect(await screen.findByPlaceholderText('Escribe tu pregunta...')).toBeDisabled();

      d.resolve();
    });
  });

  describe('Streaming', () => {
    it('should display tokens as they arrive', async () => {
      mockStreamSuccess(['One', ' ', 'Two'], { conversationId: 'c1', messageId: 'm1' });

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'Stream' } });
      fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

      expect(await screen.findByText('One Two')).toBeInTheDocument();
    });

    it('should handle stream errors gracefully', async () => {
      mockStreamError('Stream failed');

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'Fail' } });
      fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

      expect(await screen.findByText(/Stream failed/)).toBeInTheDocument();
    });

    it('should complete message when stream ends', async () => {
      mockStreamSuccess(['Final'], { conversationId: 'c1', messageId: 'm1' });

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'End' } });
      fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

      expect(await screen.findByText('Final')).toBeInTheDocument();
      expect(mockStreamChatMessage).toHaveBeenCalled();
    });
  });

  describe('Conversation management', () => {
    it('should start new conversation when button clicked', async () => {
      renderWithProviders(<Chat studentId="test-id" />);

      fireEvent.click(await screen.findByRole('button', { name: /Nueva conversación/i }));

      expect(await screen.findByText(/¡Hola! Soy tu asistente de estudios/)).toBeInTheDocument();
    });

    it('should clear messages when starting new conversation', async () => {
      renderWithProviders(<Chat studentId="test-id" />);

      fireEvent.click(await screen.findByRole('button', { name: /Nueva conversación/i }));

      expect(await screen.findByText(/¡Hola! Soy tu asistente de estudios/)).toBeInTheDocument();
    });

    it('should load history for existing conversation', async () => {
      mockGetChatHistory
        .mockResolvedValueOnce({
          conversations: [{ _id: 'conv-1', title: 'Conv 1', isActive: true, messageCount: 2, createdAt: '' }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        } as any)
        .mockResolvedValueOnce({
          conversation: { _id: 'conv-1' },
          messages: [
            { _id: 'm1', role: 'user', content: 'Old', createdAt: new Date().toISOString() },
            { _id: 'm2', role: 'assistant', content: 'Reply', createdAt: new Date().toISOString() },
          ],
        } as any);

      renderWithProviders(<Chat studentId="test-id" />);

      await waitFor(() => {
        expect(mockGetChatHistory).toHaveBeenCalledWith('test-id');
      });

      await waitFor(() => {
        expect(mockGetChatHistory).toHaveBeenCalledWith('test-id', 'conv-1');
      });

      expect(await screen.findByText('Old')).toBeInTheDocument();
      expect(await screen.findByText('Reply')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', async () => {
      renderWithProviders(<Chat studentId="test-id" />);

      fireEvent.keyDown(document.body, { key: 'Tab', code: 'Tab' });
      const newConvBtn = await screen.findByRole('button', { name: /Nueva conversación/i });
      expect(newConvBtn).toBeInTheDocument();
    });

    it('should have proper aria labels', async () => {
      renderWithProviders(<Chat studentId="test-id" />);

      const sendBtn = await screen.findByRole('button', { name: /Enviar mensaje/i });
      expect(sendBtn).toHaveAttribute('aria-label', 'Enviar mensaje');

      const newConvBtn = await screen.findByRole('button', { name: /Nueva conversación/i });
      expect(newConvBtn).toBeInTheDocument();
    });

    it('should announce new messages to screen readers', async () => {
      mockStreamSuccess(['Done'], { conversationId: 'c1', messageId: 'm1' });

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'Hi' } });
      fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

      expect(await screen.findByText('Hi')).toBeInTheDocument();
      expect(await screen.findByText('Done')).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('should show error message when API fails', async () => {
      mockStreamError('API Error');

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'Fail' } });
      fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

      expect(await screen.findByText('API Error')).toBeInTheDocument();
    });

    it('should allow retry after error', async () => {
      mockStreamError('Retry me');

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'Retry' } });
      fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

      expect(await screen.findByText('Retry me')).toBeInTheDocument();

      const input2 = screen.getByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input2, { target: { value: '' } });
      fireEvent.change(input2, { target: { value: 'Second try' } });

      const sendBtn = screen.getByRole('button', { name: /Enviar mensaje/i });
      expect(sendBtn).not.toBeDisabled();
    });

    it('should handle network disconnection', async () => {
      mockStreamError('Network Error');

      renderWithProviders(<Chat studentId="test-id" />);

      const input = await screen.findByPlaceholderText('Escribe tu pregunta...');
      fireEvent.change(input, { target: { value: 'Network' } });
      fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));

      expect(await screen.findByText('Network Error')).toBeInTheDocument();
    });
  });
});