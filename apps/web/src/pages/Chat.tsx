import { useRef, useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  Bot,
  Hand,
  Lightbulb,
  BookOpen,
  AlertCircle,
  X,
  Loader2,
  Plus,
  MessageSquare,
  Trash2,
  Download,
  Eraser,
} from 'lucide-react';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { useChat, Conversation } from '../hooks/useChat';

interface ChatProps {
  studentId: string;
}

export function Chat({ studentId }: ChatProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoLoaded = useRef(false);

  const {
    messages,
    conversationId,
    storedLastConversationId,
    isLoading,
    isLoadingHistory,
    isLoadingConversations,
    isStreaming,
    error,
    conversations,
    sendWithStreaming,
    startNewConversation,
    selectConversation,
    deleteConversation,
    clearHistory,
  } = useChat({
    studentId,
    onError: (err) => {
      setErrorMessage(err.message || 'Error inesperado');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const isBusy = isLoading || isStreaming;

  useEffect(() => {
    if (
      !hasAutoLoaded.current &&
      !isLoadingConversations &&
      conversations.length > 0 &&
      !conversationId
    ) {
      hasAutoLoaded.current = true;
      const preferredId =
        storedLastConversationId && conversations.some((c) => c._id === storedLastConversationId)
          ? storedLastConversationId
          : conversations[0]._id;
      selectConversation(preferredId);
    }
  }, [conversations, conversationId, isLoadingConversations, selectConversation, storedLastConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, isBusy]);

  const handleNewConversation = () => {
    hasAutoLoaded.current = true;
    startNewConversation();
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    await deleteConversation(convId);
  };

  const handleClearHistory = async () => {
    await clearHistory();
  };

  const handleExportConversation = () => {
    if (messages.length === 0) return;
    const lines = messages.map((m) => {
      const role = m.role === 'user' ? 'Tú' : 'Asistente';
      const time = m.timestamp.toLocaleString('es-ES');
      return `[${time}] ${role}:\n${m.content}\n`;
    });
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversacion-${conversationId || 'nueva'}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageLayout>
      <Sidebar>
        <SidebarHeader>
          <SidebarTitle>Conversaciones</SidebarTitle>
          <NewChatIconButton onClick={handleNewConversation} title="Nueva conversación">
            <Plus size={18} />
          </NewChatIconButton>
        </SidebarHeader>

        <ConversationList>
          {isLoadingConversations ? (
            <>
              {[1, 2, 3].map((i) => (
                <SkeletonConvItem key={i}>
                  <SkeletonLine $width="75%" />
                  <SkeletonLine $width="40%" />
                </SkeletonConvItem>
              ))}
            </>
          ) : conversations.length === 0 ? (
            <EmptyConversations>
              <MessageSquare size={24} />
              <span>Sin conversaciones</span>
            </EmptyConversations>
          ) : (
            conversations.map((conv: Conversation) => (
              <ConversationItem
                key={conv._id}
                $active={conv._id === conversationId}
                onClick={() => selectConversation(conv._id)}
              >
                <ConvContent>
                  <ConvTitle>{conv.title || 'Nueva conversación'}</ConvTitle>
                  <ConvMeta>
                    {conv.messageCount} msgs
                  </ConvMeta>
                </ConvContent>
                <DeleteConvButton
                  onClick={(e) => handleDeleteConversation(e, conv._id)}
                  title="Eliminar conversación"
                >
                  <Trash2 size={14} />
                </DeleteConvButton>
              </ConversationItem>
            ))
          )}
        </ConversationList>
      </Sidebar>

      <ChatArea>
        <ChatHeader>
          <HeaderTitle>
            <HeaderIcon>
              <Bot size={28} />
            </HeaderIcon>
            <div>
              <h2>Asistente de Estudios</h2>
              <HeaderSubtitle>Pregúntame sobre tus cursos</HeaderSubtitle>
            </div>
          </HeaderTitle>
          <HeaderActions>
            <IconButton
              onClick={handleExportConversation}
              disabled={messages.length === 0}
              title="Exportar conversación"
            >
              <Download size={18} />
            </IconButton>
            <IconButton
              onClick={handleClearHistory}
              title="Limpiar historial"
            >
              <Eraser size={18} />
            </IconButton>
          </HeaderActions>
        </ChatHeader>

        {(errorMessage || error) && (
          <ErrorBanner>
            <AlertCircle size={16} />
            <span>{errorMessage || error?.message}</span>
            <DismissButton onClick={() => setErrorMessage(null)}>
              <X size={14} />
            </DismissButton>
          </ErrorBanner>
        )}

        <MessagesContainer>
          {isLoadingHistory ? (
            <LoadingHistoryContainer>
              <SpinnerIcon>
                <Loader2 size={32} />
              </SpinnerIcon>
              <LoadingText>Cargando historial...</LoadingText>
              <MessageSkeletonGroup>
                <MessageSkeleton $align="right">
                  <SkeletonMsgLine $width="60%" />
                </MessageSkeleton>
                <MessageSkeleton $align="left">
                  <SkeletonMsgLine $width="80%" />
                  <SkeletonMsgLine $width="45%" />
                </MessageSkeleton>
                <MessageSkeleton $align="right">
                  <SkeletonMsgLine $width="50%" />
                </MessageSkeleton>
              </MessageSkeletonGroup>
            </LoadingHistoryContainer>
          ) : (
            <>
              {messages.length === 0 && !isLoading && (
                <WelcomeMessage>
                  <WelcomeIcon>
                    <Hand size={48} />
                  </WelcomeIcon>
                  <WelcomeTitle>¡Hola! Soy tu asistente de estudios</WelcomeTitle>
                  <WelcomeText>
                    Puedo ayudarte con:
                    <ul>
                      <li>Dudas sobre el contenido de tus cursos</li>
                      <li>Técnicas de estudio y organización</li>
                      <li>Motivación y consejos</li>
                    </ul>
                  </WelcomeText>
                  <SuggestionButtons>
                    <SuggestionButton
                      onClick={() =>
                        sendWithStreaming('¿Cómo puedo mejorar mi técnica de estudio?')
                      }
                    >
                      <Lightbulb size={14} /> Técnicas de estudio
                    </SuggestionButton>
                    <SuggestionButton
                      onClick={() => sendWithStreaming('¿Qué curso me recomiendas empezar?')}
                    >
                      <BookOpen size={14} /> Recomendaciones
                    </SuggestionButton>
                  </SuggestionButtons>
                </WelcomeMessage>
              )}

              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                  isLoading={isStreaming && message.id.startsWith('stream-') && !message.content}
                />
              ))}

              {isLoading && !isStreaming && (
                <ChatMessage role="assistant" content="" isLoading />
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </MessagesContainer>

        <ChatInput
          onSend={(message) => sendWithStreaming(message)}
          disabled={isBusy || isLoadingHistory}
          placeholder="Escribe tu pregunta..."
        />
      </ChatArea>
    </PageLayout>
  );
}

const PageLayout = styled.div`
  display: flex;
  height: calc(100vh - 48px);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const SIDEBAR_WIDTH = '280px';

const Sidebar = styled.aside`
  width: ${SIDEBAR_WIDTH};
  min-width: ${SIDEBAR_WIDTH};
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
`;

const HEADER_HEIGHT = '57px';

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-md);
  height: ${HEADER_HEIGHT};
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
`;

const SidebarTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
`;

const NewChatIconButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
`;

const ConversationList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xs);
`;

const DeleteConvButton = styled.button`
  opacity: 0;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  transition: all 0.15s ease;

  &:hover {
    color: var(--color-error, #dc2626);
    background: rgba(220, 38, 38, 0.08);
  }
`;

const ConversationItem = styled.div<{ $active: boolean }>`
  position: relative;
  padding: var(--spacing-sm) var(--spacing-md);
  padding-right: 36px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  background: ${(p) => (p.$active ? 'var(--color-background)' : 'transparent')};
  border-left: 3px solid ${(p) => (p.$active ? 'var(--color-primary)' : 'transparent')};

  &:hover {
    background: var(--color-background);

    ${DeleteConvButton} {
      opacity: 1;
    }
  }

  & + & {
    margin-top: 2px;
  }
`;

const ConvContent = styled.div`
  min-width: 0;
`;

const ConvTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ConvMeta = styled.div`
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 2px;
`;

const EmptyConversations = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl) var(--spacing-md);
  color: var(--color-text-secondary);
  font-size: 13px;
  opacity: 0.6;
`;

/* ── Chat Area ── */

const ChatArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const ChatHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--spacing-lg);
  height: ${HEADER_HEIGHT};
  flex-shrink: 0;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);

  h2 {
    font-size: 16px;
    font-weight: 600;
  }
`;

const HeaderIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
`;

const HeaderSubtitle = styled.p`
  font-size: 13px;
  color: var(--color-text-secondary);
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
`;

const IconButton = styled.button`
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--color-background);
    color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const ErrorBanner = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: #fef2f2;
  color: var(--color-error, #dc2626);
  border-bottom: 1px solid #fecaca;
  font-size: 13px;
`;

const DismissButton = styled.button`
  margin-left: auto;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;

  &:hover {
    opacity: 0.7;
  }
`;

/* ── Messages Area ── */

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
`;

/* ── Skeletons & Loading ── */

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

const LoadingHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-xl) 0;
  gap: var(--spacing-md);
`;

const SpinnerIcon = styled.div`
  color: var(--color-primary);
  animation: ${spin} 1s linear infinite;
  display: flex;
`;

const LoadingText = styled.p`
  color: var(--color-text-secondary);
  font-size: 14px;
`;

const MessageSkeletonGroup = styled.div`
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
`;

const MessageSkeleton = styled.div<{ $align: string }>`
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: ${(p) => (p.$align === 'right' ? 'flex-end' : 'flex-start')};
`;

const skeletonBg = `
  background: linear-gradient(90deg, var(--color-border) 25%, var(--color-surface) 37%, var(--color-border) 63%);
  background-size: 400px 100%;
`;

const SkeletonMsgLine = styled.div<{ $width: string }>`
  height: 14px;
  width: ${(p) => p.$width};
  border-radius: var(--radius-md);
  ${skeletonBg}
  animation: ${shimmer} 1.4s ease infinite;
`;

const SkeletonLine = styled.div<{ $width: string }>`
  height: 12px;
  width: ${(p) => p.$width};
  border-radius: var(--radius-sm);
  ${skeletonBg}
  animation: ${shimmer} 1.4s ease infinite;
`;

const SkeletonConvItem = styled.div`
  padding: var(--spacing-sm) var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const WelcomeMessage = styled.div`
  text-align: center;
  max-width: 400px;
  margin: var(--spacing-xl) auto;
`;

const WelcomeIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-md);
  color: var(--color-primary);
`;

const WelcomeTitle = styled.h3`
  font-size: 20px;
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
`;

const WelcomeText = styled.div`
  color: var(--color-text-secondary);
  font-size: 14px;
  margin-bottom: var(--spacing-lg);

  ul {
    text-align: left;
    margin-top: var(--spacing-sm);
    padding-left: var(--spacing-lg);
  }

  li {
    margin-bottom: var(--spacing-xs);
  }
`;

const SuggestionButtons = styled.div`
  display: flex;
  gap: var(--spacing-sm);
  justify-content: center;
  flex-wrap: wrap;
`;

const SuggestionButton = styled.button`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: 13px;
  color: var(--color-text-primary);
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
`;
