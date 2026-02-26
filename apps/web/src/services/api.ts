import axios, { type InternalAxiosRequestConfig } from 'axios';

const LOG_PREFIX = '[API]';

function isLogEnabled(): boolean {
  return import.meta.env?.DEV ?? true;
}

function logRequest(config: InternalAxiosRequestConfig): void {
  if (!isLogEnabled()) return;
  const method = config.method?.toUpperCase() ?? 'GET';
  const url = config.url ?? '';
  const fullUrl = config.baseURL ? `${config.baseURL}${url}` : url;
  console.debug(`${LOG_PREFIX} → ${method} ${fullUrl}`);
  (config as InternalAxiosRequestConfig & { _startTime?: number })._startTime = Date.now();
}

function logResponse(config: InternalAxiosRequestConfig, status: number): void {
  if (!isLogEnabled()) return;
  const start = (config as InternalAxiosRequestConfig & { _startTime?: number })._startTime;
  const duration = start != null ? `${Date.now() - start}ms` : '?';
  const method = config.method?.toUpperCase() ?? 'GET';
  const url = config.url ?? '';
  console.debug(`${LOG_PREFIX} ← ${method} ${url} ${status} (${duration})`);
}

function logError(config: InternalAxiosRequestConfig, status?: number, message?: string): void {
  if (!isLogEnabled()) return;
  const method = config.method?.toUpperCase() ?? 'GET';
  const url = config.url ?? '';
  console.error(`${LOG_PREFIX} ✗ ${method} ${url}${status != null ? ` ${status}` : ''}${message ? ` - ${message}` : ''}`);
}

const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(
  (config) => {
    logRequest(config);
    return config;
  },
  (error) => {
    if (error.config) logError(error.config, undefined, error.message);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    logResponse(response.config, response.status);
    return response;
  },
  async (error) => {
    const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };

    if (config) {
      logError(config, error.response?.status, error.message);

      return apiClient.request(config);
    }

    const status = error.response?.status;
    const data = error.response?.data;
    const message =
      typeof data?.message === 'string'
        ? data.message
        : `Ha habido un error al procesar la solicitud. ${status}`;

    return Promise.reject(new Error(message));
  }
);

export const api = {
  // === Student Endpoints ===

  getDashboard: async (studentId: string) => {
    const response = await apiClient.get(`/students/${studentId}/dashboard`);
    return response.data;
  },

  getCourses: async (studentId: string) => {
    const response = await apiClient.get(`/students/${studentId}/courses`);
    return response.data;
  },

  getStats: async (studentId: string) => {
    const response = await apiClient.get(`/students/${studentId}/stats`);
    return response.data;
  },

  updatePreferences: async (studentId: string, preferences: unknown) => {
    const response = await apiClient.patch(`/students/${studentId}/preferences`, preferences);
    return response.data;
  },

  // === Chat Endpoints ===

  sendChatMessage: async (data: {
    studentId: string;
    message: string;
    conversationId?: string;
  }) => {
    const response = await apiClient.post('/chat/message', data);
    return response.data;
  },

  startNewConversation: async (studentId: string, initialContext?: string) => {
    const response = await apiClient.post('/chat/conversation/new', {
      studentId,
      initialContext,
    });
    return response.data;
  },

  getChatHistory: async (studentId: string, conversationId?: string) => {
    const params = conversationId ? { conversationId } : {};
    const response = await apiClient.get(`/chat/history/${studentId}`, { params });
    return response.data;
  },

  deleteChatHistory: async (studentId: string, conversationId: string) => {
    const response = await apiClient.delete(`/chat/history/${studentId}/${conversationId}`);
    return response.data;
  },

  streamChatMessage: async (
    data: { studentId: string; message: string; conversationId?: string },
    callbacks: {
      onToken: (token: string) => void;
      onComplete: (info: { conversationId: string; messageId: string }) => void;
      onError: (error: Error) => void;
    }
  ) => {
    const response = await fetch('/api/chat/message/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok || !response.body) {
      const message =
        response.status === 429
          ? 'Demasiadas solicitudes. Espera un momento.'
          : `HTTP ${response.status}`;
      callbacks.onError(new Error(message));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let receivedConversationId = '';

    let reading = true;
    while (reading) {
      const { done, value } = await reader.read();
      if (done) {
        reading = false;
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const event = JSON.parse(trimmed.slice(6));

          if (event.conversationId && !event.done) {
            receivedConversationId = event.conversationId;
          }
          if (event.token) {
            callbacks.onToken(event.token);
          }
          if (event.done) {
            callbacks.onComplete({
              conversationId: receivedConversationId,
              messageId: event.messageId,
            });
          }
          if (event.error) {
            callbacks.onError(new Error(event.error));
          }
        } catch {
          // ignore malformed SSE event
        }
      }
    }
  },
};
