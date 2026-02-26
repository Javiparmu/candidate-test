import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  type ChatMessage,
  loadChatStorage,
  saveChatStorage,
  removeConversationFromChatStorage,
  clearConversationHistoryInChatStorage,
} from '../lib/chatStorage';

type Message = ChatMessage;

export interface Conversation {
  _id: string;
  title: string;
  isActive: boolean;
  lastMessageAt?: string;
  messageCount: number;
  createdAt: string;
}

interface UseChatOptions {
  studentId: string;
  onError?: (error: Error) => void;
}

export function useChat({ studentId, onError }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [storedLastConversationId] = useState<string | null>(
    () => loadChatStorage(studentId).lastConversationId
  );
  const queryClient = useQueryClient();

  useEffect(() => {
    saveChatStorage(studentId, conversationId, messages);
  }, [studentId, conversationId, messages]);

  const conversationsQuery = useQuery({
    queryKey: ['conversations', studentId],
    queryFn: async () => {
      const data = await api.getChatHistory(studentId);
      return (data?.conversations || []) as Conversation[];
    },
  });

  const invalidateConversations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['conversations', studentId] });
  }, [queryClient, studentId]);

  const fetchMessages = useCallback(
    async (convId: string) => {
      setIsLoadingHistory(true);
      try {
        const data = await api.getChatHistory(studentId, convId);
        if (data?.messages) {
          const loaded: Message[] = data.messages.map((msg: any) => ({
            id: msg._id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.createdAt || Date.now()),
          }));
          setMessages(loaded);
        }
      } catch (error) {
        onError?.(error as Error);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [studentId, onError]
  );

  const selectConversation = useCallback(
    async (convId: string) => {
      if (convId === conversationId) return;
      setConversationId(convId);
      const stored = loadChatStorage(studentId);
      const cached = stored.conversations[convId];
      if (cached?.length) {
        setMessages(cached);
      } else {
        setMessages([]);
      }
      await fetchMessages(convId);
    },
    [studentId, conversationId, fetchMessages]
  );

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      return api.sendChatMessage({
        studentId,
        message,
        conversationId: conversationId || undefined,
      });
    },
    onMutate: async (message) => {
      const tempId = `temp-${Date.now()}`;
      const userMessage: Message = {
        id: tempId,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      return { tempId };
    },
    onSuccess: (data) => {
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
      }
      const assistantMessage: Message = {
        id: data.assistantMessage._id,
        role: 'assistant',
        content: data.assistantMessage.content,
        timestamp: new Date(data.assistantMessage.createdAt || Date.now()),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      invalidateConversations();
    },
    onError: (error: Error) => {
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
      onError?.(error);
    },
  });

  const sendWithStreaming = useCallback(
    async (message: string) => {
      const tempId = `temp-${Date.now()}`;
      const streamId = `stream-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: tempId, role: 'user' as const, content: message, timestamp: new Date() },
        { id: streamId, role: 'assistant' as const, content: '', timestamp: new Date() },
      ]);
      setIsStreaming(true);

      try {
        await api.streamChatMessage(
          { studentId, message, conversationId: conversationId || undefined },
          {
            onToken: (token) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamId ? { ...m, content: m.content + token } : m
                )
              );
            },
            onComplete: ({ conversationId: newConvId, messageId }) => {
              if (!conversationId && newConvId) {
                setConversationId(newConvId);
              }
              setMessages((prev) =>
                prev.map((m) => (m.id === streamId ? { ...m, id: messageId } : m))
              );
              setIsStreaming(false);
              invalidateConversations();
            },
            onError: (error) => {
              onError?.(error);
              setIsStreaming(false);
            },
          }
        );
      } catch (error) {
        onError?.(error as Error);
        setIsStreaming(false);
      }
    },
    [studentId, conversationId, onError, invalidateConversations]
  );

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
  }, []);

  const loadHistory = useCallback(
    async (targetConversationId?: string) => {
      const convId = targetConversationId || conversationId;
      if (!convId) return;
      if (!conversationId && convId) setConversationId(convId);
      await fetchMessages(convId);
    },
    [conversationId, fetchMessages]
  );

  const deleteConversation = useCallback(
    async (targetConvId?: string) => {
      const convToDelete = targetConvId || conversationId;
      if (!convToDelete) return;

      try {
        await api.deleteChatHistory(studentId, convToDelete);
        removeConversationFromChatStorage(studentId, convToDelete);
        if (convToDelete === conversationId) {
          setConversationId(null);
          setMessages([]);
        }
        invalidateConversations();
      } catch (error) {
        onError?.(error as Error);
      }
    },
    [studentId, conversationId, onError, invalidateConversations]
  );

  const clearHistory = useCallback(
    async (targetConvId?: string) => {
      const convId = targetConvId ?? conversationId;
      if (!convId) {
        setMessages([]);
        return;
      }
      try {
        await api.deleteChatHistory(studentId, convId);
        if (convId === conversationId) {
          setMessages([]);
        }
        clearConversationHistoryInChatStorage(studentId, convId);
        invalidateConversations();
      } catch (error) {
        onError?.(error as Error);
      }
    },
    [studentId, conversationId, onError, invalidateConversations]
  );

  return {
    messages,
    conversationId,
    storedLastConversationId,
    isLoading: sendMutation.isPending,
    isLoadingHistory,
    isStreaming,
    error: sendMutation.error,
    conversations: conversationsQuery.data || [],
    isLoadingConversations: conversationsQuery.isLoading,
    sendMessage: sendMutation.mutate,
    sendWithStreaming,
    startNewConversation,
    selectConversation,
    loadHistory,
    deleteConversation,
    clearHistory,
    clearMessages: () => setMessages([]),
  };
}
