import { useQuery } from '@tanstack/react-query';
import { ArrowUp, Mic, RotateCcw, Sparkles, Square } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { Button, Notice, Page, QueryState } from '../components/ui';
import { intel } from '../lib/api';
import { useAssistant } from '../lib/assistant';
import { useAuth } from '../lib/auth';
import { msg, useT } from '../lib/i18n';
import { useNow } from '../lib/live';
import { canRecord, startRecording, type Recording } from '../lib/recorder';
import type { AssistantStatus } from '../lib/types';

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
 * The conversation with the assistant: on its own page, or in the panel the chat button opens
 * over any screen. Both show the same conversation.
 *
 * @param inPanel the conversation scrolls inside the panel, with the question box under it
 */
export function AssistantChat({ inPanel = false }: { inPanel?: boolean }) {
  const t = useT();
  const { user } = useAuth();
  const status = useQuery({ queryKey: ['assistant'], queryFn: () => intel<AssistantStatus>('/v1/assistant') });
  const { turns, draft, setDraft, send, sendSpoken, startOver, pending, error } = useAssistant();
  const box = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const boxId = useId();

  // A question asked out loud: where the service can listen and the browser can record.
  const [recording, setRecording] = useState<{ take: Recording; since: number } | null>(null);
  const [micRefused, setMicRefused] = useState(false);
  const now = useNow(250);
  const voice = Boolean(status.data?.voice) && canRecord();
  const live = useRef(recording);
  useEffect(() => {
    live.current = recording;
  }, [recording]);
  // Leaving the screen lets go of the microphone and keeps nothing.
  useEffect(() => () => live.current?.take.cancel(), []);

  const listen = async () => {
    setMicRefused(false);
    try {
      setRecording({ take: await startRecording(), since: Date.now() });
    } catch {
      setMicRefused(true);
    }
  };
  const finishListening = async () => {
    if (!recording || !status.data) return;
    setRecording(null);
    sendSpoken(await recording.take.stop(), status.data.max_messages);
  };
  const cancelListening = () => {
    recording?.take.cancel();
    setRecording(null);
  };
  const seconds = recording ? Math.floor((now - recording.since) / 1000) : 0;
  // At the longest a question may be, it goes as it is.
  useEffect(() => {
    if (recording && status.data && seconds >= status.data.max_voice_seconds) void finishListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  // The latest answer, or the note that one is being written, is in view: at the foot of the
  // panel's own scrolling, or just above the question box on the page. In braces: newer
  // browsers return a promise from scrolling, and an effect may return only its clean-up.
  useEffect(() => {
    if (inPanel) listEnd.current?.scrollIntoView?.({ block: 'nearest' });
    else form.current?.scrollIntoView?.({ block: 'end' });
  }, [turns.length, pending, inPanel]);

  const ask = (question: string) => {
    if (status.data) send(question, status.data.max_messages);
  };

  // Enter sends; Shift+Enter starts a new line.
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      ask(draft);
    }
  };

  const starters = user?.role === 'DRIVER' ? STARTERS.DRIVER : STARTERS.PASSENGER;
  return (
    <>
      <QueryState isPending={status.isPending} error={status.error} isEmpty={false} empty="" onRetry={() => void status.refetch()} />
      {status.data && !status.data.enabled && <Notice tone="info">{t('The assistant is switched off on this server.')}</Notice>}
      {status.data?.enabled && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm text-slate-700">
              {t('Ask how VAYORA works: booking, cancelling, paying your driver, safety. It cannot see your bookings or change anything.')}
            </p>
            {/* Where the questions go, and what may become of them there: Gemini's free tier keeps them. */}
            <p className="text-[13px] text-slate-500">
              {status.data.provider === 'claude'
                ? t('What you type is sent to Anthropic, whose AI writes the answers. VAYORA keeps none of it. An answer can be wrong: check anything important on the screen it is about.')
                : t('What you type or say is sent to Google, whose AI writes the answers. On its free service Google may use it to improve its products, and people there may read or hear it, so do not type or say personal details. VAYORA keeps none of it. An answer can be wrong: check anything important on the screen it is about.')}
            </p>
          </div>

          <section aria-label={t('Conversation')} className={`space-y-3 ${inPanel ? 'max-h-[40vh] overflow-y-auto overscroll-contain pr-1 sm:max-h-[22rem]' : ''}`}>
            {turns.length === 0 && (
              <div>
                <p className="mb-2 text-[13px] font-semibold text-slate-500">{t('Try asking')}</p>
                <div className="flex flex-wrap gap-2">
                  {starters.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => ask(t(starter))}
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
                    {turn.spoken && <Mic aria-hidden="true" className="-mt-0.5 mr-1.5 inline h-4 w-4 opacity-80" />}
                    {/* The answer is shown as text, never as markup. */}
                    {turn.declined
                      ? t('The assistant cannot help with that. Ask about how VAYORA works.')
                      : turn.spoken && !turn.content
                        ? t('(spoken question)')
                        : turn.content}
                  </p>
                </li>
              ))}
            </ol>
            {pending && (
              <p role="status" className="text-sm text-slate-500">
                {t('Writing an answer…')}
              </p>
            )}
            <div ref={listEnd} />
          </section>

          {error && <Notice tone="error">{error.message}</Notice>}
          {micRefused && <Notice tone="info">{t('Allow the microphone to ask out loud, or type your question.')}</Notice>}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(draft);
            }}
            ref={form}
            // Clear of the tab bar a phone has at the bottom of the screen.
            className="flex scroll-mb-28 items-end gap-2 sm:scroll-mb-6"
          >
            {recording ? (
              // While listening, the box gives way to how long it has been, and a way out.
              <div className="flex min-h-[4.25rem] flex-1 items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5">
                <p className="flex items-center gap-2 text-[15px] font-medium text-red-800">
                  <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
                  {/* Said once; the clock, which changes every second, is for the eye only. */}
                  <span role="status">{t('Listening…')}</span>
                  <span aria-hidden="true" className="tabular-nums">{`0:${String(seconds).padStart(2, '0')}`}</span>
                </p>
                <Button tone="secondary" onClick={cancelListening}>
                  {t('Cancel')}
                </Button>
              </div>
            ) : (
              <>
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
              </>
            )}
            {voice &&
              (recording ? (
                <Button tone="danger" onClick={() => void finishListening()} aria-label={t('Stop and send')}>
                  <Square aria-hidden="true" className="h-4 w-4" fill="currentColor" />
                </Button>
              ) : (
                <Button tone="secondary" disabled={pending} onClick={() => void listen()} aria-label={t('Ask out loud')}>
                  <Mic aria-hidden="true" className="h-4 w-4" />
                </Button>
              ))}
            {!recording && (
              <Button type="submit" disabled={!draft.trim()} busy={pending} aria-label={t('Send')}>
                <ArrowUp aria-hidden="true" className="h-4 w-4" />
              </Button>
            )}
          </form>
          {turns.length > 0 && (
            <Button
              tone="secondary"
              onClick={() => {
                startOver();
                box.current?.focus();
              }}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              {t('Start over')}
            </Button>
          )}
        </div>
      )}
    </>
  );
}

export function AssistantPage() {
  const t = useT();
  return (
    <Page title={t('Assistant')}>
      <AssistantChat />
    </Page>
  );
}
