import { Check, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useT } from '../lib/i18n';
import { Card, Meter } from './ui';

export interface SetupStep {
  done: boolean;
  label: string;
  /** Where it is done. */
  to: string;
}

/**
 * What a member still has to do before the app works well for them, in order, each a tap away,
 * and how much is done. Gone once everything is; nothing here is required by the server.
 */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const t = useT();
  const left = steps.filter((step) => !step.done).length;
  if (left === 0) return null;
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">{t('Get set up')}</h2>
        <p className="text-sm text-slate-600">{t('{done} of {all} done', { done: steps.length - left, all: steps.length })}</p>
      </div>
      <Meter fraction={(steps.length - left) / steps.length} label={t('Get set up')} />
      <ol className="mt-3 divide-y divide-slate-100">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              to={step.to}
              className="flex min-h-[44px] items-center gap-3 py-2 text-[15px] text-slate-900 hover:text-teal-800"
              aria-label={step.done ? t('{step}: done', { step: step.label }) : step.label}
            >
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${step.done ? 'bg-emerald-500 text-white' : 'ring-2 ring-slate-300'}`}
              >
                {step.done && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              <span className={step.done ? 'text-slate-500 line-through decoration-slate-300' : 'font-medium'}>{step.label}</span>
              <ChevronRight aria-hidden="true" className="ml-auto h-4 w-4 text-slate-400" />
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** A figure on a home screen that leads to where it comes from. */
export function HomeStat({ label, value, to }: { label: string; value: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-[5.5rem] flex-col justify-center rounded-2xl bg-surface px-4 py-3 shadow-card ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-float focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
    >
      <span className="text-2xl font-extrabold tabular-nums tracking-tight text-slate-950">{value}</span>
      {/* Read as "2 Trips ahead", not "2Trips ahead"; a flex container draws no space. */}{' '}
      <span className="mt-0.5 text-[13px] font-medium leading-tight text-slate-500">{label}</span>
    </Link>
  );
}

/** How a greeting names someone: their first name, or the whole of a single name. */
export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;
