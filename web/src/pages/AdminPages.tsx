import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button, Card, Notice, Page, QueryState } from '../components/ui';
import { api } from '../lib/api';
import { formatDateTime, formatPercent } from '../lib/format';
import { msg, useT } from '../lib/i18n';
import type { HazardScore, ScoringSummary } from '../lib/types';

// The model's features in words: version f1's nine, and the two last-mile ones world h3 added.
const factorLabels: Record<string, string> = {
  lead_hours: msg('How far ahead it was booked'),
  seats: msg('Seats booked'),
  departure_hour: msg('Hour the ride leaves'),
  desired_gap_hours: msg('Gap from the time asked for'),
  prior_accepted: msg('Earlier accepted bookings'),
  prior_cancellations: msg('Earlier cancellations'),
  prior_completed: msg('Earlier completed trips'),
  prior_no_shows: msg('Earlier no-shows'),
  prior_cancel_share: msg('Share of earlier bookings cancelled'),
  last_mile_distance_m: msg('Distance from the start to the boarding stop'),
  last_mile_mode_available: msg('Rickshaw or bus offered to reach the stop'),
};

/** The two features that moved the estimate most, largest first. */
export function mainFactors(contributions: Record<string, number>): [string, number][] {
  return Object.entries(contributions)
    .filter(([, value]) => value !== 0)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 2);
}

export function DurabilityPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const scores = useQuery({ queryKey: ['hazard-scores'], queryFn: () => api<HazardScore[]>('/admin/hazard/scores') });
  const run = useMutation({
    mutationFn: () => api<ScoringSummary>('/admin/hazard/score', { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['hazard-scores'] }),
  });

  return (
    <Page title={t('Booking durability')}>
      <Notice tone="info">
        {t(
          "Each figure is a model's estimate that the passenger will not cancel before departure. The model was trained on simulated data only and separates risky from safe bookings weakly. It is not a fact about any person and must not be used to decline, penalise or price anyone. It is used for one thing: choosing whom the seat-release reminder asks.",
        )}
      </Notice>

      <div className="flex flex-wrap items-center gap-4">
        <Button disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? t('Scoring…') : t('Score bookings now')}
        </Button>
        {run.data && (
          <p role="status" className="text-sm text-slate-700">
            {run.data.skippedRun
              ? t('Another scoring run is in progress.')
              : t('{scored} scored, {already} already scored today, {failed} could not be scored.', {
                  scored: run.data.scored,
                  already: run.data.alreadyScored,
                  failed: run.data.failed,
                })}
          </p>
        )}
      </div>
      {run.error && <Notice tone="error">{run.error.message}</Notice>}
      {run.data && run.data.failed > 0 && (
        <Notice tone="error">
          {t('The model service did not answer for some bookings. They are unchanged; run it again later.')}
        </Notice>
      )}

      <QueryState
        isPending={scores.isPending}
        error={scores.error}
        isEmpty={scores.data?.length === 0}
        empty={t('No confirmed booking has been scored yet.')}
        onRetry={() => void scores.refetch()}
      />
      {scores.data && scores.data.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t('Latest durability estimate of each confirmed booking')}</caption>
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Booking')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Passenger')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Trip')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Leaves')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Estimate')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Main reasons')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Model')}</th>
                  <th scope="col" className="py-2 font-medium">{t('Scored')}</th>
                </tr>
              </thead>
              <tbody>
                {scores.data.map((score) => (
                  <tr key={score.bookingId} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4">#{score.bookingId}</td>
                    <td className="py-2 pr-4">{score.passengerName}</td>
                    <td className="py-2 pr-4">
                      {t(score.fromStop)} → {t(score.toStop)}
                    </td>
                    <td className="py-2 pr-4">{formatDateTime(score.boardingTime)}</td>
                    <td className="py-2 pr-4 font-medium">{formatPercent(score.survivalProbability)}</td>
                    <td className="py-2 pr-4">
                      {mainFactors(score.contributions ?? {}).length === 0 ? (
                        <span className="text-slate-500">{t('None given')}</span>
                      ) : (
                        <ul>
                          {mainFactors(score.contributions).map(([factor, value]) => {
                            const name = factorLabels[factor] ? t(factorLabels[factor]) : factor;
                            return (
                              <li key={factor}>
                                {value > 0 ? t('{factor} makes a cancellation likelier', { factor: name }) : t('{factor} makes a cancellation less likely', { factor: name })}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4">{score.modelVersion}</td>
                    <td className="py-2">{formatDateTime(score.scoredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}
