import { useState, useRef, useCallback, KeyboardEvent, ChangeEvent } from 'react';
import styled from 'styled-components';
import { Send, Loader2, Smile } from 'lucide-react';
import Picker from '@emoji-mart/react';
import { data } from '../lib/emojiMart';
import { useMessageHistory } from '../hooks/useMessageHistory';
import { useEmoji } from '../hooks/useEmoji';
import { useAutosizeTextarea } from '../hooks/useAutosizeTextarea';
import { useClickOutside } from '../hooks/useClickOutside';

const MAX_CHARS = 2000;
const TEXTAREA_MIN_HEIGHT = 44;
const TEXTAREA_MAX_HEIGHT = 160;
const HISTORY_LIMIT = 50;
const CHAR_WARNING_THRESHOLD = 200;

interface EmojiData {
  id: string;
  name: string;
  native: string;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

type EmojiMartSelected = { native: string };


export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Escribe tu mensaje...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const history = useMessageHistory(HISTORY_LIMIT);
  const colon = useEmoji();

  const charCount = message.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isWarning = !isOverLimit && MAX_CHARS - charCount <= CHAR_WARNING_THRESHOLD;
  const canSend = message.trim().length > 0 && !disabled && !isOverLimit;

  useAutosizeTextarea(textAreaRef, message, TEXTAREA_MIN_HEIGHT, TEXTAREA_MAX_HEIGHT);

  const closeEmojiPicker = useCallback(() => setShowEmojiPicker(false), []);
  useClickOutside(emojiPickerRef, showEmojiPicker, closeEmojiPicker);

  const insertAtCursor = useCallback((text: string) => {
    const el = textAreaRef.current;

    if (!el) {
      setMessage((prev) => prev + text);
      colon.close();
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;

    setMessage((prev) => prev.slice(0, start) + text + prev.slice(end));
    colon.close();

    requestAnimationFrame(() => {
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
      el.focus();
    });
  }, [colon]);

  const insertColonEmoji = useCallback(
    (emoji: EmojiData) => {
      const el = textAreaRef.current;
      if (!el || colon.query === null) return;

      const cursorPos = el.selectionStart;

      setMessage((prev) => {
        const before = prev.slice(0, cursorPos);
        const colonStart = before.lastIndexOf(':');
        if (colonStart === -1) return prev;
        return prev.slice(0, colonStart) + emoji.native + prev.slice(cursorPos);
      });

      colon.close();

      requestAnimationFrame(() => {
        const beforeText = message.slice(0, cursorPos);
        const colonStart = beforeText.lastIndexOf(':');
        const pos = (colonStart === -1 ? cursorPos : colonStart) + emoji.native.length;
        el.setSelectionRange(pos, pos);
        el.focus();
      });
    },
    [colon, message]
  );

  const handleEmojiPickerSelect = useCallback(
    (emoji: EmojiMartSelected) => {
      insertAtCursor(emoji.native);
      closeEmojiPicker();
    },
    [insertAtCursor, closeEmojiPicker]
  );

  const sendMessage = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || disabled || isOverLimit) return false;

    history.push(trimmed);
    history.resetNavigation();

    onSend(trimmed);
    setMessage('');
    colon.close();
    return true;
  }, [message, disabled, isOverLimit, history, onSend, colon]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (colon.show) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        colon.moveDown();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        colon.moveUp();
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertColonEmoji(colon.matches[colon.selected]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        colon.close();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      return;
    }

    const el = textAreaRef.current;
    if (!el) return;

    if (e.key === 'ArrowUp' && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      const next = history.navigate('up', message);
      if (next !== null) setMessage(next);
      return;
    }

    if (e.key === 'ArrowDown' && el.selectionStart === message.length && el.selectionEnd === message.length) {
      e.preventDefault();
      const next = history.navigate('down', message);
      if (next !== null) setMessage(next);
      return;
    }
  }, [colon, history, message, closeEmojiPicker, sendMessage]);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    setMessage(value);
    history.resetNavigation();
    colon.updateFromText(value, cursorPos);
  }, [colon, history]);

  const counterStatus: CounterStatus = isOverLimit ? 'over' : isWarning ? 'warning' : 'normal';

  return (
    <Container>
      <InputWrapper>
        <TextArea
          ref={textAreaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          $isOverLimit={isOverLimit}
        />

        {colon.show && (
          <ColonPanel>
            {colon.matches.map((emoji, i) => (
              <ColonItem
                key={emoji.id}
                $active={i === colon.selected}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  insertColonEmoji(emoji);
                }}
                onMouseEnter={() => colon.setSelected(i)}
              >
                <ColonEmoji>{emoji.native}</ColonEmoji>
                <ColonLabel>:{emoji.id}:</ColonLabel>
              </ColonItem>
            ))}
          </ColonPanel>
        )}

        <BottomBar>
          <div ref={emojiPickerRef} style={{ position: 'relative' }}>
            <EmojiToggle
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              $active={showEmojiPicker}
              disabled={disabled}
              title="Emojis"
            >
              <Smile size={16} />
            </EmojiToggle>

            {showEmojiPicker && (
              <PickerWrapper>
                <Picker
                  data={data}
                  onEmojiSelect={handleEmojiPickerSelect}
                  theme="light"
                  locale="es"
                  previewPosition="none"
                  skinTonePosition="search"
                  maxFrequentRows={1}
                />
              </PickerWrapper>
            )}
          </div>

          {charCount > 0 && (
            <CharCounter $status={counterStatus}>
              {charCount}/{MAX_CHARS}
            </CharCounter>
          )}
        </BottomBar>
      </InputWrapper>

      <SendButton onClick={sendMessage} disabled={!canSend} aria-label="Enviar mensaje">
        {disabled ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
      </SendButton>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  align-items: flex-end;
`;

const InputWrapper = styled.div`
  flex: 1;
  position: relative;
`;

const TextArea = styled.textarea<{ $isOverLimit: boolean }>`
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  padding-bottom: 30px;
  border: 1px solid ${(props) => (props.$isOverLimit ? 'var(--color-error, #dc2626)' : 'var(--color-border)')};
  border-radius: var(--radius-lg);
  font-size: 14px;
  font-family: inherit;
  line-height: 20px;
  resize: none;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  min-height: ${TEXTAREA_MIN_HEIGHT}px;
  max-height: ${TEXTAREA_MAX_HEIGHT}px;
  overflow-y: hidden;

  &:focus {
    border-color: ${(props) => (props.$isOverLimit ? 'var(--color-error, #dc2626)' : 'var(--color-primary)')};
    box-shadow: 0 0 0 3px ${(props) =>
      props.$isOverLimit ? 'rgba(220, 38, 38, 0.1)' : 'rgba(99, 102, 241, 0.1)'};
  }

  &:disabled {
    background: var(--color-background);
    cursor: not-allowed;
  }
`;

const ColonPanel = styled.div`
  position: absolute;
  bottom: 36px;
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 20;
  padding: 4px;
`;

const ColonItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 6px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  background: ${(props) => (props.$active ? 'var(--color-background)' : 'transparent')};

  &:hover {
    background: var(--color-background);
  }
`;

const ColonEmoji = styled.span`
  font-size: 20px;
  width: 28px;
  text-align: center;
  flex-shrink: 0;
`;

const ColonLabel = styled.span`
  font-size: 13px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const BottomBar = styled.div`
  position: absolute;
  bottom: 4px;
  left: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
`;

const EmojiToggle = styled.button<{ $active: boolean }>`
  background: none;
  border: none;
  color: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-text-secondary)')};
  cursor: pointer;
  padding: 8px 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  transition: color 0.15s ease;

  &:hover:not(:disabled) {
    color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const PickerWrapper = styled.div`
  position: absolute;
  bottom: 32px;
  left: -4px;
  z-index: 20;
`;

type CounterStatus = 'normal' | 'warning' | 'over';

const counterColors: Record<CounterStatus, string> = {
  normal: 'var(--color-text-secondary)',
  warning: '#d97706',
  over: 'var(--color-error, #dc2626)',
};

const CharCounter = styled.span<{ $status: CounterStatus }>`
  font-size: 11px;
  color: ${(props) => counterColors[props.$status]};
  font-weight: ${(props) => (props.$status === 'over' ? '600' : '400')};
  user-select: none;
  min-width: 32px;
  text-align: right;
`;

const SendButton = styled.button`
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  border: none;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: var(--color-primary-dark, #4f46e5);
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    background: var(--color-border);
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
