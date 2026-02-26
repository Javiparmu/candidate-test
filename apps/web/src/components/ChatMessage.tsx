import { memo, useState, useCallback, type ComponentProps } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { User, Bot, Copy, Check, ThumbsUp, ThumbsDown, Heart } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isLoading?: boolean;
}

type Reaction = 'like' | 'dislike' | 'heart';

const REACTIONS: { key: Reaction; icon: typeof ThumbsUp; label: string }[] = [
  { key: 'like', icon: ThumbsUp, label: 'Útil' },
  { key: 'dislike', icon: ThumbsDown, label: 'No útil' },
  { key: 'heart', icon: Heart, label: 'Me encanta' },
];

export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  timestamp,
  isLoading,
}: ChatMessageProps) {
  const [reaction, setReaction] = useState<Reaction | null>(null);

  const toggleReaction = useCallback((key: Reaction) => {
    setReaction((prev) => (prev === key ? null : key));
  }, []);

  return (
    <Container $role={role}>
      <Avatar $role={role}>
        {role === 'user' ? <User size={18} /> : <Bot size={18} />}
      </Avatar>

      <Bubble $role={role}>
        <MessageContent>
          {isLoading ? (
            <LoadingIndicator>
              <Dot $delay="0s" />
              <Dot $delay="0.2s" />
              <Dot $delay="0.4s" />
            </LoadingIndicator>
          ) : (
            <>
              {role === 'assistant' ? (
                <MarkdownBody>
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{ code: CodeBlock }}
                  >
                    {content}
                  </Markdown>
                </MarkdownBody>
              ) : (
                <MessageText>{content}</MessageText>
              )}
            </>
          )}
        </MessageContent>

        {!isLoading && (
          <Footer>
            {timestamp && <Timestamp>{formatTime(timestamp)}</Timestamp>}

            {role === 'assistant' && content && (
              <ReactionsRow>
                {REACTIONS.map(({ key, icon: Icon, label }) => (
                  <ReactionButton
                    key={key}
                    $active={reaction === key}
                    onClick={() => toggleReaction(key)}
                    title={label}
                  >
                    <Icon size={14} />
                  </ReactionButton>
                ))}
              </ReactionsRow>
            )}
          </Footer>
        )}
      </Bubble>
    </Container>
  );
});

function CodeBlock({
  className,
  children,
}: ComponentProps<'code'>) {
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');

  if (!match) {
    return <InlineCode>{children}</InlineCode>;
  }

  return (
    <CodeBlockWrapper>
      <CodeHeader>
        <CodeLang>{match[1]}</CodeLang>
        <CopyButton code={codeString} />
      </CodeHeader>
      <SyntaxHighlighter
        style={oneDark}
        language={match[1]}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          fontSize: '0.85em',
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </CodeBlockWrapper>
  );
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <CopyBtn onClick={handleCopy} title="Copiar código">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copiado' : 'Copiar'}
    </CopyBtn>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const bounce = keyframes`
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
`;

const Container = styled.div<{ $role: string }>`
  display: flex;
  gap: var(--spacing-sm);
  flex-direction: ${(props) => (props.$role === 'user' ? 'row-reverse' : 'row')};
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
  animation: ${fadeIn} 0.3s ease;
`;

const Avatar = styled.div<{ $role: string }>`
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: ${(props) => (props.$role === 'user' ? 'var(--color-primary)' : 'var(--color-background)')};
  color: ${(props) => (props.$role === 'user' ? 'white' : 'var(--color-text-secondary)')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const Bubble = styled.div<{ $role: string }>`
  max-width: 70%;
  border-radius: var(--radius-lg);
  background: ${(p) => (p.$role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)')};
  color: ${(p) => (p.$role === 'user' ? 'white' : 'var(--color-text-primary)')};
  border: ${(p) => (p.$role === 'assistant' ? '1px solid var(--color-border)' : 'none')};
  overflow: hidden;
`;

const MessageContent = styled.div`
  padding: var(--spacing-sm) var(--spacing-md);
`;

const MessageText = styled.div`
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-md) var(--spacing-xs);
  gap: var(--spacing-sm);
`;

const Timestamp = styled.div`
  font-size: 11px;
  opacity: 0.5;
`;

const ReactionsRow = styled.div`
  display: flex;
  gap: 2px;
  margin-left: auto;
`;

const ReactionButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  opacity: 0.5;

  &:hover {
    background: var(--color-background);
    opacity: 1;
  }

  ${(props) =>
    props.$active &&
    css`
      color: var(--color-primary);
      opacity: 1;
      background: var(--color-primary)15;
    `}
`;

const InlineCode = styled.code`
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'Fira Code', 'Consolas', monospace;
`;

const CodeBlockWrapper = styled.div`
  margin: 8px calc(-1 * var(--spacing-md));
  border-radius: 0;

  &:last-child {
    margin-bottom: 8px;
  }
`;

const CodeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #282a36;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const CodeLang = styled.span`
  font-size: 12px;
  color: #a0a0b0;
  font-family: 'Fira Code', 'Consolas', monospace;
  text-transform: lowercase;
`;

const CopyBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: #a0a0b0;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s ease;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }
`;

const MarkdownBody = styled.div`
  line-height: 1.6;
  word-break: break-word;

  p { margin: 0 0 0.5em; }
  p:last-child { margin-bottom: 0; }

  pre {
    margin: 0;
    padding: 0;
    background: none;
  }

  ul, ol {
    padding-left: 1.5em;
    margin: 0.4em 0;
  }

  li { margin-bottom: 0.2em; }

  strong { font-weight: 600; }

  blockquote {
    border-left: 3px solid var(--color-primary);
    margin: 8px 0;
    padding: 4px 12px;
    opacity: 0.85;
  }

  table {
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 0.9em;
  }

  th, td {
    border: 1px solid var(--color-border);
    padding: 6px 10px;
  }

  th { background: var(--color-background); font-weight: 600; }
`;

const LoadingIndicator = styled.div`
  display: flex;
  gap: 4px;
  padding: var(--spacing-xs);
`;

const Dot = styled.div<{ $delay: string }>`
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-text-secondary);
  animation: ${bounce} 1.2s ease-in-out infinite;
  animation-delay: ${(props) => props.$delay};
`;
