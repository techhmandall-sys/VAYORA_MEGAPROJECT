import { useMutation } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { intel } from './api';
import { useLanguage } from './i18n';
import { toBase64 } from './recorder';
import type { AssistantHeard, AssistantReply } from './types';

export interface Turn {
  role: 'user' | 'assistant';
  /** For a question asked out loud, what was heard; empty until it is. */
  content: string;
  /** The assistant would not answer this one: shown, but never sent again. */
  declined?: boolean;
  /** Asked out loud. */
  spoken?: boolean;
}

interface Conversation {
  turns: Turn[];
  draft: string;
  setDraft: (draft: string) => void;
  /** Asks the question, sending at most `most` messages of the conversation with it. */
  send: (question: string, most: number) => void;
  /** Asks the question in the recording, with at most `most` messages in all. */
  sendSpoken: (recording: Blob, most: number) => void;
  startOver: () => void;
  pending: boolean;
  error: Error | null;
}

type Sent = Pick<Turn, 'role' | 'content'>;

/**
 * What goes to intel, which keeps nothing between questions: the conversation, less any
 * question the assistant declined, cut to the latest it accepts and starting with a question.
 */
function sendable(turns: Turn[], most: number): Sent[] {
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
    mutationFn: (messages: Sent[]) => intel<AssistantReply>('/v1/assistant/reply', { method: 'POST', body: { messages, language } }),
  });
  const listen = useMutation({
    mutationFn: async ({ history, recording }: { history: Sent[]; recording: Blob }) =>
      intel<AssistantHeard>('/v1/assistant/voice', {
        method: 'POST',
        body: { history, language, mime_type: recording.type, audio: await toBase64(recording) },
      }),
  });
  const busy = ask.isPending || listen.isPending;
  const answered = (answer: AssistantReply): Turn =>
    answer.declined || answer.reply === null ? { role: 'assistant', content: '', declined: true } : { role: 'assistant', content: answer.reply };

  const send = (question: string, most: number) => {
    const text = question.trim();
    if (!text || busy) return;
    listen.reset();
    const asked: Turn[] = [...turns, { role: 'user', content: text }];
    setTurns(asked);
    setDraft('');
    ask.mutate(sendable(asked, most), {
      onSuccess: (answer) => setTurns((now) => [...now, answered(answer)]),
      // Nothing was answered: the question goes back in the box, to send again.
      onError: () => {
        setTurns((now) => now.slice(0, -1));
        setDraft(text);
      },
    });
  };

  const sendSpoken = (recording: Blob, most: number) => {
    if (recording.size === 0 || busy) return;
    ask.reset();
    const history = sendable(turns, most - 1);
    // The question shows at once; what was heard fills it in when the answer comes.
    setTurns((now) => [...now, { role: 'user', content: '', spoken: true }]);
    listen.mutate(
      { history, recording },
      {
        onSuccess: (answer) =>
          setTurns((now) => [...now.slice(0, -1), { role: 'user', content: answer.heard ?? '', spoken: true }, answered(answer)]),
        onError: () => setTurns((now) => now.slice(0, -1)),
      },
    );
  };

  const startOver = () => {
    setTurns([]);
    ask.reset();
    listen.reset();
  };

  return (
    <AssistantContext.Provider
      value={{ turns, draft, setDraft, send, sendSpoken, startOver, pending: busy, error: ask.error ?? listen.error }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant(): Conversation {
  const conversation = useContext(AssistantContext);
  if (!conversation) throw new Error('useAssistant is used outside an AssistantProvider');
  return conversation;
}
