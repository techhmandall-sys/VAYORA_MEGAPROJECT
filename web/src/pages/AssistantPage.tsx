import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowUp, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { Button, Notice, Page, QueryState } from '../components/ui';
import { intel } from '../lib/api';
import { useAuth } from '../lib/auth';
import { msg, useLanguage, useT } from '../lib/i18n';
import type { AssistantReply, AssistantStatus } from '../lib/types';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  /** The assistant would not answer this one: shown, but never sent again. */
  declined?: boolean;
}

/** Questions to start from, in the reader's language, so the first one takes a tap. */
const STARTERS = {
  PASSENGER: [
    msg('What does cancelling cost?'),
    msg('How do I pay my driver?'),
    msg('What happens if my driver cancels?'),
    msg('What is a women-only ride?'),
  ],
  DRIVER: [
    msg('How do I publish a ride?'),
    msg('When can I start my ride?'),
    msg('How do passengers pay me?'),
    msg('What if a passenger does not turn up?'),
  ],
};

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

export function AssistantPage() {
  const t = useT();
  const { language } = useLanguage();
  const { user } = useAuth();
  const status = useQuery({ queryKey: ['assistant'], queryFn: () => intel<AssistantStatus>('/v1/assistant') });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const boxId = useId();
  const ask = useMutation({
    mutationFn: (messages: Pick<Turn, 'role' | 'content'>[]) =>
      intel<AssistantReply>('/v1/assistant/reply', { method: 'POST', body: { messages, language } }),
  });

  // The latest answer, or the note that one is being written, is in view.
  useEffect(() => end.current?.scrollIntoView?.({ block: 'end' }), [turns.length, ask.isPending]);

  const send = (question: string) => {
    const text = question.trim();
    if (!text || ask.isPending || !status.data) return;
    const asked: Turn[] = [...turns, { role: 'user', content: text }];
    setTurns(asked);
    setDraft('');
    ask.mutate(sendable(asked, status.data.max_messages), {
      onSuccess: (answer) =>
        setTurns((now) => [...now, answer.declined || answer.reply === null ? { role: 'assistant', content: '', declined: true } : { role: 'assistant', content: answer.reply }]),
      // Nothing was answered: the question goes back in the box, to send again.
      onError: () => {
        setTurns((now) => now.slice(0, -1));
        setDraft(text);
      },
    });
  };

  // Enter sends; Shift+Enter starts a new line.
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  };

  const startOver = () => {
    setTurns([]);
    ask.reset();
    box.current?.focus();
  };

  const starters = user?.role === 'DRIVER' ? STARTERS.DRIVER : STARTERS.PASSENGER;
  return (
    <Page title={t('Assistant')}>
      <QueryState isPending={status.isPending} error={status.error} isEmpty={false} empty="" onRetry={() => void status.refetch()} />
      {status.data && !status.data.enabled && <Notice tone="info">{t('The assistant is switched off on this server.')}</Notice>}
      {status.data?.enabled && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm text-slate-700">
              {t('Ask how VAYORA works: booking, cancelling, paying your driver, safety. It cannot see your bookings or change anything.')}
            </p>
            <p className="text-[13px] text-slate-500">
              {t('What you type is sent to Anthropic, whose AI writes the answers. VAYORA keeps none of it. An answer can be wrong: check anything important on the screen it is about.')}
            </p>
          </div>

          <section aria-label={t('Conversation')} className="space-y-3">
            {turns.length === 0 && (
              <div>
                <p className="mb-2 text-[13px] font-semibold text-slate-500">{t('Try asking')}</p>
                <div className="flex flex-wrap gap-2">
                  {starters.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => send(t(starter))}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/[0.05] px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-900/[0.08] touch:min-h-11 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
                    >
                      <Sparkles aria-hidden="true" className="h-4 w-4 text-teal-700" />
                      {t(starter)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <ol className="space-y-3">
              {turns.map((turn, index) => (
                <li key={index} className={turn.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                      turn.role === 'user'
                        ? 'rounded-br-md bg-accent text-white'
                        : 'rounded-bl-md bg-surface text-slate-900 shadow-card ring-1 ring-slate-900/[0.04]'
                    }`}
                  >
                    <span className="sr-only">{turn.role === 'user' ? t('You') : t('Assistant')}: </span>
                    {/* The answer is shown as text, never as markup. */}
                    {turn.declined ? t('The assistant cannot help with that. Ask about how VAYORA works.') : turn.content}
                  </p>
                </li>
              ))}
            </ol>
            {ask.isPending && (
              <p role="status" className="text-sm text-slate-500">
                {t('Writing an answer…')}
              </p>
            )}
            <div ref={end} />
          </section>

          {ask.error && <Notice tone="error">{ask.error.message}</Notice>}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
            className="flex items-end gap-2"
          >
            <label htmlFor={boxId} className="sr-only">
              {t('Your question')}
            </label>
            <textarea
              id={boxId}
              ref={box}
              rows={2}
              value={draft}
              maxLength={status.data.max_message_chars}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKey}
              placeholder={t('Your question')}
              className="min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-surface px-4 py-2.5 text-[15px] shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
            />
            <Button type="submit" disabled={!draft.trim()} busy={ask.isPending} aria-label={t('Send')}>
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
            </Button>
          </form>
          {turns.length > 0 && (
            <Button tone="secondary" onClick={startOver}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              {t('Start over')}
            </Button>
          )}
        </div>
      )}
    </Page>
  );
}
