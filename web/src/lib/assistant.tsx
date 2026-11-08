import { useMutation } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { intel } from './api';
import { useLanguage } from './i18n';
import type { AssistantReply } from './types';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
  /** The assistant would not answer this one: shown, but never sent again. */
  declined?: boolean;
}

interface Conversation {
  turns: Turn[];
  draft: string;
  setDraft: (draft: string) => void;
  /** Asks the question, sending at most `most` messages of the conversation with it. */
  send: (question: string, most: number) => void;
  startOver: () => void;
  pending: boolean;
  error: Error | null;
}

/**
 * What goes to intel, which keeps nothing between questions: the conversation, less any
 * question the assistant declined, cut to the latest it accepts and starting with a question.
 */
function sendable(turns: Turn[], most: number): Pick<Turn, 'role' | 'content'>[] {
  const kept = turns.filter((turn, index) => !turn.declined && !turns[index + 1]?.declined);
  const latest = kept.slice(-most);
  const start = latest.findIndex((turn) => turn.role === 'user');
  return start < 0 ? [] : latest.slice(start).map(({ role, content }) => ({ role, content }));
}

const AssistantContext = createContext<Conversation | null>(null);

/**
 * One conversation for the whole visit, shared by the Assistant page and the chat button on
 * every screen, so a question asked over one screen is still there on the next.
 */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const ask = useMutation({
    mutationFn: (messages: Pick<Turn, 'role' | 'content'>[]) =>
      intel<AssistantReply>('/v1/assistant/reply', { method: 'POST', body: { messages, language } }),
  });

  const send = (question: string, most: number) => {
    const text = question.trim();
    if (!text || ask.isPending) return;
    const asked: Turn[] = [...turns, { role: 'user', content: text }];
    setTurns(asked);
    setDraft('');
    ask.mutate(sendable(asked, most), {
      onSuccess: (answer) =>
        setTurns((now) => [...now, answer.declined || answer.reply === null ? { role: 'assistant', content: '', declined: true } : { role: 'assistant', content: answer.reply }]),
      // Nothing was answered: the question goes back in the box, to send again.
      onError: () => {
        setTurns((now) => now.slice(0, -1));
        setDraft(text);
      },
    });
  };

  const startOver = () => {
    setTurns([]);
    ask.reset();
  };

  return (
    <AssistantContext.Provider value={{ turns, draft, setDraft, send, startOver, pending: ask.isPending, error: ask.error }}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant(): Conversation {
  const conversation = useContext(AssistantContext);
  if (!conversation) throw new Error('useAssistant is used outside an AssistantProvider');
  return conversation;
}
