const CHAT_STORAGE_PREFIX = 'chat:';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SerializedMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

function storageKey(studentId: string): string {
  return `${CHAT_STORAGE_PREFIX}${studentId}`;
}

function serializeMessages(messages: ChatMessage[]): SerializedMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
  }));
}

function deserializeMessages(raw: SerializedMessage[]): ChatMessage[] {
  return raw.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    timestamp: new Date(m.timestamp),
  }));
}

export interface ChatStorageData {
  lastConversationId: string | null;
  conversations: Record<string, ChatMessage[]>;
}

export function loadChatStorage(studentId: string): ChatStorageData {
  try {
    const raw = localStorage.getItem(storageKey(studentId));
    if (!raw) return { lastConversationId: null, conversations: {} };
    const data = JSON.parse(raw);
    const conversations: Record<string, ChatMessage[]> = {};
    if (data.conversations && typeof data.conversations === 'object') {
      for (const id of Object.keys(data.conversations)) {
        const arr = (data.conversations as Record<string, unknown>)[id];
        if (Array.isArray(arr)) {
          conversations[id] = deserializeMessages(arr as SerializedMessage[]);
        }
      }
    }
    return {
      lastConversationId: data.lastConversationId ?? null,
      conversations,
    };
  } catch {
    return { lastConversationId: null, conversations: {} };
  }
}

export function saveChatStorage(
  studentId: string,
  conversationId: string | null,
  messages: ChatMessage[]
): void {
  try {
    const loaded = loadChatStorage(studentId);
    if (conversationId && messages.length > 0) {
      loaded.conversations[conversationId] = messages;
    }
    loaded.lastConversationId = conversationId;
    const serialized: Record<string, unknown> = {};
    for (const id of Object.keys(loaded.conversations)) {
      serialized[id] = serializeMessages(loaded.conversations[id]);
    }
    localStorage.setItem(
      storageKey(studentId),
      JSON.stringify({
        lastConversationId: loaded.lastConversationId,
        conversations: serialized,
      })
    );
  } catch {
    // ignore quota or parse errors
  }
}

export function removeConversationFromChatStorage(studentId: string, convId: string): void {
  try {
    const loaded = loadChatStorage(studentId);
    delete loaded.conversations[convId];
    if (loaded.lastConversationId === convId) {
      loaded.lastConversationId = Object.keys(loaded.conversations)[0] ?? null;
    }
    const serialized: Record<string, unknown> = {};
    for (const id of Object.keys(loaded.conversations)) {
      serialized[id] = serializeMessages(loaded.conversations[id]);
    }
    localStorage.setItem(
      storageKey(studentId),
      JSON.stringify({
        lastConversationId: loaded.lastConversationId,
        conversations: serialized,
      })
    );
  } catch {
    // ignore quota or parse errors
  }
}

export function clearConversationHistoryInChatStorage(studentId: string, convId: string): void {
  try {
    const loaded = loadChatStorage(studentId);
    loaded.conversations[convId] = [];
    const serialized: Record<string, unknown> = {};
    for (const id of Object.keys(loaded.conversations)) {
      serialized[id] = serializeMessages(loaded.conversations[id]);
    }
    localStorage.setItem(
      storageKey(studentId),
      JSON.stringify({
        lastConversationId: loaded.lastConversationId,
        conversations: serialized,
      })
    );
  } catch {
    // ignore quota or parse errors
  }
}
