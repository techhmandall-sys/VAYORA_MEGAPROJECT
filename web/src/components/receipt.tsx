import { useState } from 'react';
import { Link } from 'react-router-dom';

import { download } from '../lib/api';
import { useT } from '../lib/i18n';

/**
 * A booking's or a pass's receipt: to view in the reader's language and print or save from
 * the browser, or as a PDF in English, with names in Latin or Devanagari script only.
 */
export function ReceiptLinks({ of, id }: { of: 'booking' | 'pass'; id: number }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  const link = 'text-left text-sm font-medium text-teal-800 underline underline-offset-2';
  return (
    <span className="inline-flex flex-col gap-1">
      <Link to={`/receipts/${of}/${id}`} className={link}>
        {t('View or print receipt')}
      </Link>
      <button
        type="button"
        disabled={state === 'busy'}
        onClick={() => {
          setState('busy');
          download(`/${of === 'booking' ? 'bookings' : 'passes'}/${id}/receipt`, `vayora-${of}-${id}.pdf`).then(
            () => setState('idle'),
            () => setState('failed'),
          );
        }}
        className={`${link} disabled:opacity-50`}
      >
        {t('Download receipt (PDF, in English)')}
      </button>
      {state === 'failed' && (
        <span role="alert" className="text-xs text-red-700">
          {t('The receipt could not be downloaded. Try again.')}
        </span>
      )}
    </span>
  );
}
