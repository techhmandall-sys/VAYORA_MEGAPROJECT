import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Bus, Flag, Fuel, type LucideIcon, Route as RouteIcon, Scale, Ticket, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { reportReasons } from '../components/report';
import { CountUp } from '../components/countup';
import { LiveStatus } from '../components/live';
import { Button, Card, ConfirmButton, Meter, Notice, Page, QueryState, SelectField, StatusBadge, TextField } from '../components/ui';
import { api } from '../lib/api';
import { msg, useT } from '../lib/i18n';
import { LIVE_MS } from '../lib/live';
import { idDocumentLabels } from '../lib/idDocuments';
import { formatDate, formatDateTime, formatRupees } from '../lib/format';
import type { AdminOverview, AuditEntry, BookingStatus, BusService, DisputedTrip, PaymentStatus, Stopover, SupplyGap, Member, MemberReport, ReportOutcome, RideStatus, Role, WaitingCheck } from '../lib/types';

// The server's own codes, in words. A code with no entry here is shown as it is.
const codeLabels: Record<string, string> = {
  PASSENGER: msg('Passengers'),
  DRIVER: msg('Drivers'),
  ADMIN: msg('Administrators'),
  SCHEDULED: msg('Scheduled'),
  IN_PROGRESS: msg('On the road'),
  COMPLETED: msg('Completed'),
  CANCELLED: msg('Cancelled'),
  PENDING: msg('Waiting for the driver'),
  CONFIRMED: msg('Confirmed'),
  REJECTED: msg('Declined by the driver'),
  NO_SHOW: msg('Did not board'),
};

const roleLabels: Record<Role, string> = {
  PASSENGER: msg('Passenger'),
  DRIVER: msg('Driver'),
  ADMIN: msg('Administrator'),
};

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((total, n) => total + n, 0);

/** A headline figure with its icon, counting up when the page opens. */
function Tile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-slate-900/[0.04] transition-transform duration-300 ease-settle hover:-translate-y-0.5">
      <span aria-hidden="true" className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-slate-900">
        <CountUp value={value} format={(n) => Math.round(n).toLocaleString('en-IN')} />
      </p>
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

function Counts({ title, counts }: { title: string; counts: Record<string, number> }) {
  const t = useT();
  const entries = Object.entries(counts);
  const all = sum(counts);
  return (
    <Card>
      <h2 className="text-sm font-medium text-slate-500">{title}</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">{t('None yet.')}</p>
      ) : (
        <dl className="mt-2 space-y-2.5 text-sm">
          {entries.map(([code, count]) => (
            <div key={code}>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">{t(codeLabels[code] ?? code)}</dt>
                <dd className="font-medium tabular-nums">{count}</dd>
              </div>
              <div className="mt-1">
                <Meter fraction={all === 0 ? 0 : count / all} label={t(codeLabels[code] ?? code)} />
              </div>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

export function OverviewPage() {
  const t = useT();
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api<AdminOverview>('/admin/overview'), refetchInterval: LIVE_MS.lists });
  return (
    <Page title={t('Overview')} aside={overview.data ? <LiveStatus query={overview} /> : undefined}>
      <QueryState isPending={overview.isPending} error={overview.error} isEmpty={false} empty="" onRetry={() => void overview.refetch()} />
      {overview.data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={t('Members')} value={sum(overview.data.users)} icon={Users} tone="bg-teal-100 text-teal-900" />
            <Tile label={t('Rides')} value={sum(overview.data.rides)} icon={RouteIcon} tone="bg-sky-100 text-sky-900" />
            <Tile label={t('Bookings')} value={sum(overview.data.bookings)} icon={Ticket} tone="bg-emerald-100 text-emerald-900" />
            <Tile label={t('Reports')} value={overview.data.openReports} icon={Flag} tone="bg-amber-100 text-amber-900" />
          </div>
          {overview.data.openReports > 0 && (
            <Notice tone="info">
              {overview.data.openReports === 1
                ? t('{n} report is waiting.', { n: overview.data.openReports })
                : t('{n} reports are waiting.', { n: overview.data.openReports })}{' '}
              <Link to="/admin/reports" className="font-medium underline">
                {t('Open the queue')}
              </Link>
            </Notice>
          )}
          {overview.data.disputedTrips > 0 && (
            <Notice tone="info">
              {t('{n} completed trips are disputed by their passenger.', { n: overview.data.disputedTrips })}{' '}
              <Link to="/admin/disputes" className="font-medium underline">
                {t('See them')}
              </Link>
            </Notice>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Counts title={t('Members by role')} counts={overview.data.users} />
            <Counts title={t('Rides by status')} counts={overview.data.rides} />
            <Counts title={t('Bookings by status')} counts={overview.data.bookings} />
          </div>
          <p className="text-sm text-slate-600">{t('Suspended members: {n}', { n: overview.data.suspendedMembers })}</p>
        </>
      )}
    </Page>
  );
}

export function ReportsPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const reports = useQuery({ queryKey: ['admin', 'reports'], queryFn: () => api<MemberReport[]>('/admin/reports?status=OPEN') });
  const [notes, setNotes] = useState<Record<number, string>>({});
  const resolve = useMutation({
    mutationFn: ({ id, outcome }: { id: number; outcome: ReportOutcome }) =>
      api<MemberReport>(`/admin/reports/${id}/resolve`, { method: 'POST', body: { outcome, note: notes[id] ?? '' } }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });

  return (
    <Page title={t('Reports')}>
      {resolve.error && <Notice tone="error">{resolve.error.message}</Notice>}
      <QueryState
        isPending={reports.isPending}
        error={reports.error}
        isEmpty={reports.data?.length === 0}
        empty={t('No reports are waiting.')}
        icon={Flag}
        onRetry={() => void reports.refetch()}
      />
      {reports.data?.map((report) => (
        <Card key={report.id}>
          <p className="font-medium">
            {t('{reason}: {reporter} about', { reason: t(reportReasons[report.reason]), reporter: report.reporterName })}{' '}
            <Link to={`/users/${report.reportedUserId}`} className="text-teal-800 underline">
              {report.reportedUserName}
            </Link>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {t('Filed {time}', { time: formatDateTime(report.createdAt) })}
            {report.bookingId !== null && ` · ${t('booking #{id}', { id: report.bookingId })}`}
          </p>
          {/* Rendered as text: this is whatever the reporter typed. */}
          {report.details && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{report.details}</p>}
          <div className="mt-3 space-y-3">
            <TextField
              label={t('Note for report #{id}', { id: report.id })}
              hint={t('Kept with the report. Sent to the member if you warn them.')}
              maxLength={1000}
              value={notes[report.id] ?? ''}
              onChange={(event) => setNotes({ ...notes, [report.id]: event.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <Button tone="secondary" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: report.id, outcome: 'DISMISS' })}>
                {t('Dismiss')}
              </Button>
              <Button disabled={resolve.isPending} onClick={() => resolve.mutate({ id: report.id, outcome: 'WARN' })}>
                {t('Warn member')}
              </Button>
              <ConfirmButton
                label={t('Suspend member')}
                confirmLabel={t('Yes, suspend {name}', { name: report.reportedUserName })}
                disabled={resolve.isPending}
                onConfirm={() => resolve.mutate({ id: report.id, outcome: 'SUSPEND' })}
              />
            </div>
          </div>
        </Card>
      ))}
    </Page>
  );
}

export function MembersPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const members = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => api<Member[]>(`/admin/users?${new URLSearchParams({ q: search })}`),
  });
  const reinstate = useMutation({
    mutationFn: (id: number) => api<void>(`/admin/users/${id}/reinstate`, { method: 'POST' }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });

  return (
    <Page title={t('Members')}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(typed);
        }}
      >
        <div className="min-w-64 flex-1">
          <TextField label={t('Name, email or phone')} value={typed} onChange={(event) => setTyped(event.target.value)} />
        </div>
        <Button type="submit">{t('Search')}</Button>
      </form>
      {reinstate.error && <Notice tone="error">{reinstate.error.message}</Notice>}
      <QueryState
        isPending={members.isPending}
        error={members.error}
        isEmpty={members.data?.length === 0}
        empty={t('No member matches.')}
        onRetry={() => void members.refetch()}
      />
      {members.data && members.data.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t('Members, newest first')}</caption>
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Name')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Email')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Role')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Joined')}</th>
                  <th scope="col" className="py-2 font-medium">{t('Standing')}</th>
                </tr>
              </thead>
              <tbody>
                {members.data.map((member) => (
                  <tr key={member.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4">{member.fullName}</td>
                    <td className="py-2 pr-4">{member.email ?? t('Signed up by phone')}</td>
                    <td className="py-2 pr-4">{t(roleLabels[member.role])}</td>
                    <td className="py-2 pr-4">{formatDateTime(member.memberSince)}</td>
                    <td className="py-2">
                      {member.status === 'SUSPENDED' ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-red-800">{t('Suspended')}</span>
                          <Button tone="secondary" disabled={reinstate.isPending} onClick={() => reinstate.mutate(member.id)}>
                            {t('Reinstate {name}', { name: member.fullName })}
                          </Button>
                        </span>
                      ) : (
                        t('Active')
                      )}
                    </td>
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

export function AuditPage() {
  const t = useT();
  const entries = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api<AuditEntry[]>('/admin/audit') });
  return (
    <Page title={t('Audit log')}>
      <p className="text-sm text-slate-600">{t('Every administrative action, newest first. Entries cannot be edited or removed.')}</p>
      <QueryState
        isPending={entries.isPending}
        error={entries.error}
        isEmpty={entries.data?.length === 0}
        empty={t('No administrative action has been recorded.')}
        onRetry={() => void entries.refetch()}
      />
      {entries.data && entries.data.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t('Administrative actions')}</caption>
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('When')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Who')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('Action')}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t('On')}</th>
                  <th scope="col" className="py-2 font-medium">{t('Detail')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.data.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-2 pr-4">{formatDateTime(entry.createdAt)}</td>
                    <td className="py-2 pr-4">{entry.actorName}</td>
                    {/* The record itself, as written: action codes and detail are not translated. */}
                    <td className="py-2 pr-4">{entry.action.replace(/_/g, ' ').toLowerCase()}</td>
                    <td className="py-2 pr-4">{entry.targetType ? `${entry.targetType} #${entry.targetId}` : ''}</td>
                    <td className="py-2 font-mono text-xs text-slate-600">{entry.detail}</td>
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

export function DisputesPage() {
  const t = useT();
  const disputes = useQuery({ queryKey: ['admin', 'disputes'], queryFn: () => api<DisputedTrip[]>('/admin/disputed-trips') });
  return (
    <Page title={t('Disputed trips')}>
      <p className="text-sm text-slate-600">
        {t('Trips a driver marked completed and the passenger says did not happen. Nothing has been reversed: payments are simulated, and each case is for a person to judge.')}
      </p>
      <QueryState
        isPending={disputes.isPending}
        error={disputes.error}
        isEmpty={disputes.data?.length === 0}
        empty={t('No trip is disputed.')}
        icon={Scale}
        onRetry={() => void disputes.refetch()}
      />
      {disputes.data?.map((dispute) => (
        <Card key={dispute.bookingId}>
          <p className="font-medium">
            {t(dispute.fromStop)} → {t(dispute.toStop)} · {formatDateTime(dispute.boardingTime)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            <Link to={`/users/${dispute.passengerId}`} className="text-teal-800 underline">
              {dispute.passengerName}
            </Link>{' '}
            · {t('driver')}{' '}
            <Link to={`/users/${dispute.driverId}`} className="text-teal-800 underline">
              {dispute.driverName}
            </Link>{' '}
            · {t('disputed {time}', { time: formatDateTime(dispute.disputedAt) })}
          </p>
        </Card>
      ))}
    </Page>
  );
}

const emptyBus = { operator: '', fromStop: '', toStop: '', departs: '', durationMinutes: '', fare: '', notes: '' };

/** Bus services offered to passengers when no ride will do. None ship with the platform. */
export function BusServicesPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyBus);
  const buses = useQuery({ queryKey: ['admin', 'bus-services'], queryFn: () => api<BusService[]>('/admin/bus-services') });
  const add = useMutation({
    mutationFn: () =>
      api<BusService>('/admin/bus-services', {
        method: 'POST',
        body: { ...draft, durationMinutes: Number(draft.durationMinutes), fare: Number(draft.fare), notes: draft.notes || null },
      }),
    onSuccess: () => setDraft(emptyBus),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'bus-services'] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/admin/bus-services/${id}`, { method: 'DELETE' }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'bus-services'] }),
  });
  const field = (name: keyof typeof emptyBus) => ({
    value: draft[name],
    onChange: (event: { target: { value: string } }) => setDraft({ ...draft, [name]: event.target.value }),
  });

  return (
    <Page title={t('Bus services')}>
      <p className="text-sm text-slate-600">
        {t('Passengers see these when no ride matches their search, and in the notice when a driver withdraws. Enter them from the operator\'s published timetable: nothing here checks them, and passengers are told to check with the operator.')}
      </p>
      {(add.error ?? remove.error) && <Notice tone="error">{(add.error ?? remove.error)!.message}</Notice>}
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <TextField label={t('Operator')} required {...field('operator')} />
          <TextField label={t('Leaves at')} type="time" required {...field('departs')} />
          <TextField label={t('From')} required {...field('fromStop')} />
          <TextField label={t('To')} required {...field('toStop')} />
          <TextField label={t('Journey time in minutes')} type="number" min={10} max={1440} required {...field('durationMinutes')} />
          <TextField label={t('Fare in rupees')} type="number" min={0} step="0.01" required {...field('fare')} />
          <TextField label={t('Notes (optional)')} {...field('notes')} />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={add.isPending}>
              {t('Add bus service')}
            </Button>
          </div>
        </form>
      </Card>
      <QueryState
        isPending={buses.isPending}
        error={buses.error}
        isEmpty={buses.data?.length === 0}
        empty={t('No bus services are listed.')}
        icon={Bus}
        onRetry={() => void buses.refetch()}
      />
      {buses.data?.map((bus) => (
        <Card key={bus.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              <span className="font-medium">
                {bus.fromStop} → {bus.toStop} · {bus.departs.slice(0, 5)}
              </span>{' '}
              · {bus.operator} · {formatRupees(bus.fare)}
            </p>
            <ConfirmButton
              label={t('Remove')}
              confirmLabel={t('Yes, remove it')}
              disabled={remove.isPending}
              onConfirm={() => remove.mutate(bus.id)}
            />
          </div>
        </Card>
      ))}
    </Page>
  );
}

/** Days ahead where passengers searched a stretch and found no ride. */
export function DocumentChecksPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const waiting = useQuery({ queryKey: ['admin', 'document-checks'], queryFn: () => api<WaitingCheck[]>('/admin/document-checks') });
  const decide = useMutation({
    mutationFn: ({ id, outcome }: { id: number; outcome: 'CHECKED' | 'REFUSED' }) =>
      api(`/admin/document-checks/${id}/decide`, { method: 'POST', body: { outcome, note: notes[id] ?? '' } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'document-checks'] }),
  });
  return (
    <Page title={t('Document checks')}>
      <p className="text-sm text-slate-600">
        {t('Ask the driver to show you the original, in person or on a video call, then record what you saw. Do not write down its number or keep a copy. This says a person saw it, not that its issuer stands behind it.')}
      </p>
      {decide.error && <Notice tone="error">{decide.error.message}</Notice>}
      <QueryState
        isPending={waiting.isPending}
        error={waiting.error}
        isEmpty={waiting.data?.length === 0}
        empty={t('No document is waiting to be checked.')}
        icon={BadgeCheck}
        onRetry={() => void waiting.refetch()}
      />
      {waiting.data?.map((check) => (
        <Card key={check.id}>
          <div className="space-y-3 text-sm">
            <p className="font-semibold text-slate-900">
              <Link to={`/users/${check.driverId}`} className="underline">
                {check.driverName}
              </Link>
            </p>
            <p>
              {check.kind === 'IDENTITY' && check.document
                ? t('Identity document: {document}', { document: t(idDocumentLabels[check.document]) })
                : t('Insurance for {vehicle}: {insurer}, until {date}', {
                    vehicle: check.vehicle ?? '',
                    insurer: check.insurer ?? '',
                    date: check.insuredUntil ? formatDate(check.insuredUntil) : '',
                  })}
            </p>
            <p className="text-slate-500">{t('Asked {when}', { when: formatDateTime(check.requestedAt) })}</p>
            <TextField
              label={t('Note for the driver (needed to refuse)')}
              maxLength={500}
              value={notes[check.id] ?? ''}
              onChange={(event) => setNotes({ ...notes, [check.id]: event.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <ConfirmButton
                label={t('Mark as checked')}
                confirmLabel={t('Yes, I saw the original')}
                tone="primary"
                disabled={decide.isPending}
                onConfirm={() => decide.mutate({ id: check.id, outcome: 'CHECKED' })}
              />
              <Button
                tone="secondary"
                disabled={decide.isPending || (notes[check.id] ?? '').trim() === ''}
                onClick={() => decide.mutate({ id: check.id, outcome: 'REFUSED' })}
              >
                {t('Could not confirm')}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </Page>
  );
}

export function SupplyGapsPage() {
  const t = useT();
  const gaps = useQuery({ queryKey: ['admin', 'supply-gaps'], queryFn: () => api<SupplyGap[]>('/admin/supply-gaps') });
  return (
    <Page title={t('Unmet demand')}>
      <p className="text-sm text-slate-600">
        {t('Days in the coming week where at least three searches on one stretch found no ride. Each morning, a few drivers who have driven the stretch are told, none more than once a week. Whether they then offer a ride is recorded, not reported as a result.')}
      </p>
      <QueryState
        isPending={gaps.isPending}
        error={gaps.error}
        isEmpty={gaps.data?.length === 0}
        empty={t('No gaps in the coming week.')}
        icon={TrendingUp}
        onRetry={() => void gaps.refetch()}
      />
      {gaps.data && gaps.data.length > 0 && (
        <Card>
          <table className="w-full text-left text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="py-2 pr-4 font-medium">{t('Date')}</th>
                <th className="py-2 pr-4 font-medium">{t('Stretch')}</th>
                <th className="py-2 pr-4 font-medium">{t('Searches with no ride')}</th>
                <th className="py-2 font-medium">{t('Drivers told')}</th>
              </tr>
            </thead>
            <tbody>
              {gaps.data.map((gap) => (
                <tr key={`${gap.date}-${gap.fromStop}-${gap.toStop}`} className="border-t border-slate-100">
                  <td className="py-2 pr-4">{formatDate(gap.date)}</td>
                  <td className="py-2 pr-4">
                    {t(gap.fromStop)} → {t(gap.toStop)}
                  </td>
                  <td className="py-2 pr-4">{gap.emptySearches}</td>
                  <td className="py-2">{gap.driversNudged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Page>
  );
}

const emptyStopover = { kind: 'REST', name: '', lat: '', lon: '', chargerKw: '', notes: '' };

/** Rest stops and chargers shown to drivers along their route. None ship with the platform. */
export function StopoversPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyStopover);
  const stopovers = useQuery({ queryKey: ['admin', 'stopovers'], queryFn: () => api<Stopover[]>('/admin/stopovers') });
  const add = useMutation({
    mutationFn: () =>
      api<Stopover>('/admin/stopovers', {
        method: 'POST',
        body: {
          kind: draft.kind,
          name: draft.name,
          lat: Number(draft.lat),
          lon: Number(draft.lon),
          chargerKw: draft.kind === 'CHARGER' && draft.chargerKw ? Number(draft.chargerKw) : null,
          notes: draft.notes || null,
        },
      }),
    onSuccess: () => setDraft(emptyStopover),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'stopovers'] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/admin/stopovers/${id}`, { method: 'DELETE' }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'stopovers'] }),
  });
  const field = (name: keyof typeof emptyStopover) => ({
    value: draft[name],
    onChange: (event: { target: { value: string } }) => setDraft({ ...draft, [name]: event.target.value }),
  });

  return (
    <Page title={t('Rest stops and chargers')}>
      <p className="text-sm text-slate-600">
        {t('Drivers see these when they work out a route that passes near them. Nothing here checks that a stop is open or a charger works, and drivers are told so.')}
      </p>
      {(add.error ?? remove.error) && <Notice tone="error">{(add.error ?? remove.error)!.message}</Notice>}
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <SelectField label={t('Kind')} {...field('kind')}>
            <option value="REST">{t('Rest stop')}</option>
            <option value="CHARGER">{t('Charger')}</option>
          </SelectField>
          <TextField label={t('Name')} required {...field('name')} />
          <TextField label={t('Latitude')} type="number" step="any" min={-90} max={90} required {...field('lat')} />
          <TextField label={t('Longitude')} type="number" step="any" min={-180} max={180} required {...field('lon')} />
          {draft.kind === 'CHARGER' && (
            <TextField label={t('Power in kW (optional)')} type="number" min={1} step="0.1" {...field('chargerKw')} />
          )}
          <TextField label={t('Notes (optional)')} {...field('notes')} />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={add.isPending}>
              {t('Add')}
            </Button>
          </div>
        </form>
      </Card>
      <QueryState
        isPending={stopovers.isPending}
        error={stopovers.error}
        isEmpty={stopovers.data?.length === 0}
        empty={t('No rest stops or chargers are listed.')}
        icon={Fuel}
        onRetry={() => void stopovers.refetch()}
      />
      {stopovers.data?.map((stop) => (
        <Card key={stop.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              <span className="font-medium">{stop.name}</span> · {stop.kind === 'CHARGER' ? t('Charger') : t('Rest stop')}
              {stop.chargerKw != null && ` · ${stop.chargerKw} kW`} · {stop.lat.toFixed(4)}, {stop.lon.toFixed(4)}
            </p>
            <ConfirmButton
              label={t('Remove')}
              confirmLabel={t('Yes, remove it')}
              disabled={remove.isPending}
              onConfirm={() => remove.mutate(stop.id)}
            />
          </div>
        </Card>
      ))}
    </Page>
  );
}

interface RideRow {
  id: number;
  driverName: string;
  driverId: number;
  departureTime: string;
  status: RideStatus;
  seatsOffered: number;
  bookings: number;
  fromStop: string;
  toStop: string;
}

interface BookingRow {
  id: number;
  rideId: number;
  passengerName: string;
  passengerId: number;
  driverName: string;
  fromStop: string;
  toStop: string;
  seats: number;
  status: BookingStatus;
  createdAt: string;
  paymentStatus: PaymentStatus | null;
  amountDue: number | null;
}

const RIDE_STATUSES: RideStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];

/** The newest 100 rides, optionally of one status. */
export function AdminRidesPage() {
  const t = useT();
  const [status, setStatus] = useState('');
  const rides = useQuery({
    queryKey: ['admin', 'rides', status],
    queryFn: () => api<RideRow[]>(`/admin/rides${status ? `?status=${status}` : ''}`),
  });
  return (
    <Page title={t('Rides')}>
      <div className="max-w-xs">
        <SelectField label={t('Status')} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t('Any')}</option>
          {RIDE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(codeLabels[value] ?? value)}
            </option>
          ))}
        </SelectField>
      </div>
      <QueryState isPending={rides.isPending} error={rides.error} isEmpty={rides.data?.length === 0} empty={t('No rides.')} onRetry={() => void rides.refetch()} />
      {rides.data?.map((ride) => (
        <Card key={ride.id}>
          <p className="font-medium">
            #{ride.id} · {t(ride.fromStop)} → {t(ride.toStop)} · {formatDateTime(ride.departureTime)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            <Link to={`/users/${ride.driverId}`} className="text-teal-800 underline">
              {ride.driverName}
            </Link>{' '}
            · {t('{n} seats offered, {b} bookings', { n: ride.seatsOffered, b: ride.bookings })}
          </p>
          <p className="mt-1">
            <StatusBadge status={ride.status} />
          </p>
        </Card>
      ))}
    </Page>
  );
}

/** The newest 100 bookings, optionally of one status. */
export function AdminBookingsPage() {
  const t = useT();
  const [status, setStatus] = useState('');
  const [owing, setOwing] = useState(false);
  const bookings = useQuery({
    queryKey: ['admin', 'bookings', status, owing],
    queryFn: () => {
      const params = new URLSearchParams({ ...(status ? { status } : {}), ...(owing ? { owing: 'true' } : {}) }).toString();
      return api<BookingRow[]>(`/admin/bookings${params ? `?${params}` : ''}`);
    },
  });
  return (
    <Page title={t('Bookings')}>
      <div className="max-w-xs">
        <SelectField label={t('Status')} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t('Any')}</option>
          {BOOKING_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(codeLabels[value] ?? value)}
            </option>
          ))}
        </SelectField>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={owing} onChange={(event) => setOwing(event.target.checked)} />
          {t('Only those still owing a driver')}
        </label>
      </div>
      <QueryState isPending={bookings.isPending} error={bookings.error} isEmpty={bookings.data?.length === 0} empty={t('No bookings.')} onRetry={() => void bookings.refetch()} />
      {bookings.data?.map((booking) => (
        <Card key={booking.id}>
          <p className="font-medium">
            #{booking.id} · {t(booking.fromStop)} → {t(booking.toStop)} · {formatDateTime(booking.createdAt)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            <Link to={`/users/${booking.passengerId}`} className="text-teal-800 underline">
              {booking.passengerName}
            </Link>{' '}
            · {t('with {driver}, {n} seats', { driver: booking.driverName, n: booking.seats })}
          </p>
          <p className="mt-1">
            <StatusBadge status={booking.status} />
          </p>
          {booking.paymentStatus === 'DUE' && booking.amountDue != null && <ClearDue bookingId={booking.id} amount={booking.amountDue} />}
        </Card>
      ))}
    </Page>
  );
}

/** Lets a passenger off what they owe, when a driver who was paid will not say so. */
function ClearDue({ bookingId, amount }: { bookingId: number; amount: number }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const clear = useMutation({
    mutationFn: () => api<unknown>(`/admin/bookings/${bookingId}/clear-due`, { method: 'POST', body: { reason } }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] }),
  });
  return (
    <div className="mt-3 max-w-md space-y-2 border-t border-slate-200 pt-3 text-sm">
      <p className="font-medium text-amber-800">{t('Owes the driver {amount}', { amount: formatRupees(amount) })}</p>
      <TextField
        label={t('Why clear it')}
        hint={t('For a driver who was paid and will not mark it. Kept in the audit log, and not shown to either side.')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={300}
      />
      <ConfirmButton label={t('Clear what is owed')} confirmLabel={t('Yes, clear it')} disabled={clear.isPending || !reason.trim()} onConfirm={() => clear.mutate()} />
      {clear.error && <Notice tone="error">{clear.error.message}</Notice>}
    </div>
  );
}
