import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Bell, ChevronDown, ChevronRight, CircleAlert, Contact, Gift, IdCard, Mail, Shield, ShieldAlert, UserRound, Wallet, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useToast } from '../components/toast';
import { Button, ConfirmButton, Notice, Page, QueryState, SelectField, TextField } from '../components/ui';
import { api, download } from '../lib/api';
import { DriverPaymentEditor } from '../components/payment';
import { initialsOf, Photo, PhotoEditor } from '../components/photo';
import { PushChoice } from '../components/push';
import { useAuth } from '../lib/auth';
import { msg, useT } from '../lib/i18n';
import { DocumentCheckStatus } from '../components/documentCheck';
import { idDocumentLabels } from '../lib/idDocuments';
import type { Chattiness, DriverPaymentDetails, EmergencyContact, Gender, IdDocument, MyProfile } from '../lib/types';

const PHONE = /^\+?[0-9]{10,15}$/;
const PHONE_ERROR = msg('Enter 10 to 15 digits, with or without a + in front');
const MAX_CONTACTS = 3;

type YesNo = '' | 'yes' | 'no';

const toYesNo = (value: boolean | null): YesNo => (value === null ? '' : value ? 'yes' : 'no');
const fromYesNo = (value: YesNo): boolean | null => (value === '' ? null : value === 'yes');

interface Draft {
  phone: string;
  bio: string;
  birthYear: string;
  gender: Gender | '';
  smoking: YesNo;
  pets: YesNo;
  music: YesNo;
  chattiness: Chattiness | '';
}

const draftOf = (profile: MyProfile): Draft => ({
  phone: profile.phone ?? '',
  bio: profile.bio ?? '',
  birthYear: profile.birthYear === null ? '' : String(profile.birthYear),
  gender: profile.gender ?? '',
  smoking: toYesNo(profile.smoking),
  pets: toYesNo(profile.pets),
  music: toYesNo(profile.music),
  chattiness: profile.chattiness ?? '',
});

function ProfileForm({ profile }: { profile: MyProfile }) {
  const t = useT();
  const id = useId();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftOf(profile));
  const [phoneError, setPhoneError] = useState<string>();
  const toast = useToast();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () =>
      api<MyProfile>('/me/profile', {
        method: 'PUT',
        body: {
          phone: draft.phone.trim(),
          bio: draft.bio,
          birthYear: draft.birthYear === '' ? null : Number(draft.birthYear),
          gender: draft.gender || null,
          smoking: fromYesNo(draft.smoking),
          pets: fromYesNo(draft.pets),
          music: fromYesNo(draft.music),
          chattiness: draft.chattiness || null,
        },
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['me', 'profile'], saved);
      toast(t('Your profile is saved.'));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const phone = draft.phone.trim();
    const bad = phone !== '' && !PHONE.test(phone);
    setPhoneError(bad ? PHONE_ERROR : undefined);
    if (!bad) save.mutate();
  }

  const yesNo = (
    <>
      <option value="">{t('Not said')}</option>
      <option value="yes">{t('Fine with me')}</option>
      <option value="no">{t('No, please')}</option>
    </>
  );

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      {save.error && <Notice tone="error">{save.error.message}</Notice>}
      <TextField
        label={t('Phone number')}
        type="tel"
        autoComplete="tel"
        value={draft.phone}
        error={phoneError}
        hint={t('Never shown to other members. Changing it means confirming it again.')}
        onChange={(event) => set('phone', event.target.value)}
      />
      <div>
        <label htmlFor={`${id}-bio`} className="block text-sm font-medium text-slate-700">
          {t('About you')}
        </label>
        <textarea
          id={`${id}-bio`}
          rows={3}
          maxLength={500}
          value={draft.bio}
          onChange={(event) => set('bio', event.target.value)}
          className="mt-1 block w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-[15px] shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('Year of birth')}
          type="number"
          min={1900}
          max={2100}
          value={draft.birthYear}
          hint={t('Other members see only your approximate age.')}
          onChange={(event) => set('birthYear', event.target.value)}
        />
        <SelectField label={t('Gender')} value={draft.gender} hint={t('Not shown on your profile. Choosing Woman lets you offer and book women-only rides; nobody checks it.')} onChange={(event) => set('gender', event.target.value as Gender | '')}>
          <option value="">{t('Not said')}</option>
          <option value="FEMALE">{t('Woman')}</option>
          <option value="MALE">{t('Man')}</option>
          <option value="OTHER">{t('Other')}</option>
        </SelectField>
        <SelectField label={t('Smoking in the car')} value={draft.smoking} onChange={(event) => set('smoking', event.target.value as YesNo)}>
          {yesNo}
        </SelectField>
        <SelectField label={t('Pets in the car')} value={draft.pets} onChange={(event) => set('pets', event.target.value as YesNo)}>
          {yesNo}
        </SelectField>
        <SelectField label={t('Music on the way')} value={draft.music} onChange={(event) => set('music', event.target.value as YesNo)}>
          {yesNo}
        </SelectField>
        <SelectField label={t('Conversation')} value={draft.chattiness} onChange={(event) => set('chattiness', event.target.value as Chattiness | '')}>
          <option value="">{t('Not said')}</option>
          <option value="QUIET">{t('I prefer a quiet ride')}</option>
          <option value="MODERATE">{t('Some conversation is nice')}</option>
          <option value="TALKATIVE">{t('I like to talk')}</option>
        </SelectField>
      </div>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? t('Saving…') : t('Save profile')}
      </Button>
    </form>
  );
}

/** One address to confirm: ask for a code, then type it in. */
function Confirm({ channel, label, address, confirmed }: { channel: 'email' | 'phone'; label: string; address: string | null; confirmed: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const request = useMutation({ mutationFn: () => api<void>(`/me/verification/${channel}/request`, { method: 'POST' }) });
  const confirm = useMutation({
    mutationFn: () => api<void>(`/me/verification/${channel}/confirm`, { method: 'POST', body: { code } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me', 'profile'] }),
  });
  // A different address starts again from nothing. The reset functions are stable, so this
  // runs only when the address changes.
  const { reset: resetRequest } = request;
  const { reset: resetConfirm } = confirm;
  useEffect(() => {
    setCode('');
    resetRequest();
    resetConfirm();
  }, [address, resetRequest, resetConfirm]);

  return (
    <div className="space-y-2 border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <p className="text-sm">
        <span className="font-medium">{label}</span> <span className="text-slate-600">{address ?? t('None given')}</span>{' '}
        {address && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confirmed ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
            {confirmed ? t('Confirmed') : t('Not confirmed')}
          </span>
        )}
      </p>
      {address && !confirmed && (
        <>
          {(request.error ?? confirm.error) && <Notice tone="error">{(request.error ?? confirm.error)!.message}</Notice>}
          {!request.isSuccess && (
            <Button tone="secondary" disabled={request.isPending} onClick={() => request.mutate()}>
              {request.isPending ? t('Sending…') : t('Send me a code')}
            </Button>
          )}
          {request.isSuccess && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (/^[0-9]{6}$/.test(code)) confirm.mutate();
              }}
            >
              <TextField
                label={t('6-digit code')}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              />
              <Button type="submit" disabled={code.length !== 6 || confirm.isPending}>
                {t('Confirm')}
              </Button>
            </form>
          )}
          {request.isSuccess && (
            <p className="text-sm text-slate-600">
              {t('This project sends no real email or SMS. The code was only written to the simulated outbox, which an administrator can read.')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Contacts() {
  const t = useT();
  const queryClient = useQueryClient();
  const contacts = useQuery({ queryKey: ['me', 'contacts'], queryFn: () => api<EmergencyContact[]>('/me/emergency-contacts') });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [phoneError, setPhoneError] = useState<string>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['me', 'contacts'] });
  const add = useMutation({
    mutationFn: () => api<EmergencyContact>('/me/emergency-contacts', { method: 'POST', body: { name, phone: phone.trim(), relation } }),
    onSuccess: () => {
      setName('');
      setPhone('');
      setRelation('');
      return refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/me/emergency-contacts/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
  const full = (contacts.data?.length ?? 0) >= MAX_CONTACTS;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {t('The people the emergency button is meant to tell. Text messages are simulated in this project, so today they would NOT be messaged.')}
      </p>
      <QueryState
        isPending={contacts.isPending}
        error={contacts.error}
        isEmpty={contacts.data?.length === 0}
        empty={t('You have no emergency contacts yet.')}
        icon={Contact}
        onRetry={() => void contacts.refetch()}
      />
      {remove.error && <Notice tone="error">{remove.error.message}</Notice>}
      {contacts.data && contacts.data.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {contacts.data.map((contact) => (
            <li key={contact.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-medium">{contact.name}</span> <span className="text-slate-600">{contact.phone}</span>
                {contact.relation && <span className="text-slate-500"> · {contact.relation}</span>}
              </span>
              <ConfirmButton
                label={t('Remove {name}', { name: contact.name })}
                confirmLabel={t('Yes, remove')}
                disabled={remove.isPending}
                onConfirm={() => remove.mutate(contact.id)}
              />
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className="text-sm text-slate-600">{t('You can have at most {n} emergency contacts.', { n: MAX_CONTACTS })}</p>
      ) : (
        <form
          className="grid gap-3 sm:grid-cols-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const bad = !PHONE.test(phone.trim());
            setPhoneError(bad ? PHONE_ERROR : undefined);
            if (!bad && name.trim()) add.mutate();
          }}
        >
          {add.error && (
            <div className="sm:col-span-3">
              <Notice tone="error">{add.error.message}</Notice>
            </div>
          )}
          <TextField label={t('Their name')} value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
          <TextField label={t('Their phone number')} type="tel" value={phone} error={phoneError} onChange={(event) => setPhone(event.target.value)} />
          <TextField label={t('Who they are to you (optional)')} value={relation} maxLength={50} onChange={(event) => setRelation(event.target.value)} />
          <div className="sm:col-span-3">
            <Button type="submit" disabled={!name.trim() || add.isPending}>
              {t('Add contact')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** The member's invitation code, who has used it, and what an invitation earns. */
function Invitations() {
  const t = useT();
  const referral = useQuery({
    queryKey: ['me', 'referral'],
    queryFn: () => api<{ code: string; signedUp: number; qualified: number }>('/me/referral'),
  });
  if (!referral.data) {
    return <QueryState isPending={referral.isPending} error={referral.error} isEmpty={false} empty="" onRetry={() => void referral.refetch()} />;
  }
  return (
    <div className="space-y-2 text-sm">
      <p>
        {t('Your invitation code')}{' '}
        <span className="font-mono text-lg font-semibold tracking-widest">{referral.data.code}</span>
      </p>
      <p className="text-slate-600">
        {t('{n} signed up with it; {q} of them have completed a trip.', { n: referral.data.signedUp, q: referral.data.qualified })}
      </p>
    </div>
  );
}

/**
 * Which identity document a driver says they hold (feature 7). Only the kind: there is no field
 * for a number or a copy. Staff may be asked to see the original, and only the result is kept.
 */
function IdDeclaration({ declared }: { declared: IdDocument | null }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<IdDocument | ''>(declared ?? '');
  const saved = (profile: MyProfile) => queryClient.setQueryData(['me', 'profile'], profile);
  const declare = useMutation({
    mutationFn: (document: IdDocument) => api<MyProfile>('/me/id-declaration', { method: 'PUT', body: { document } }),
    onSuccess: saved,
  });
  const withdraw = useMutation({
    mutationFn: () => api<MyProfile>('/me/id-declaration', { method: 'DELETE' }),
    onSuccess: (profile) => {
      saved(profile);
      setChoice('');
    },
  });
  const error = declare.error ?? withdraw.error;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">
        {t('You can say which identity document you hold. VAYORA never asks for its number or keeps a copy. Your profile says it was declared and not checked, until VAYORA staff have seen it.')}
      </p>
      {declared && <p>{t('You have declared: {document}.', { document: t(idDocumentLabels[declared]) })}</p>}
      {declared && <DocumentCheckStatus kind="IDENTITY" />}
      {error && <Notice tone="error">{error.message}</Notice>}
      <div className="flex flex-wrap items-end gap-3">
        <div className="max-w-xs">
          <SelectField label={t('Identity document')} value={choice} onChange={(event) => setChoice(event.target.value as IdDocument | '')}>
            <option value="">{t('Choose one')}</option>
            {(Object.keys(idDocumentLabels) as IdDocument[]).map((document) => (
              <option key={document} value={document}>
                {t(idDocumentLabels[document])}
              </option>
            ))}
          </SelectField>
        </div>
        <Button disabled={choice === '' || choice === declared || declare.isPending} onClick={() => choice && declare.mutate(choice)}>
          {t('Declare')}
        </Button>
        {declared && (
          <Button tone="secondary" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
            {t('Remove')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Whether copies of notifications go by email and SMS. In-app ones are always kept. */
function NotificationChoices({ emailConfirmed, phoneConfirmed }: { emailConfirmed: boolean; phoneConfirmed: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const choices = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api<{ email: boolean; sms: boolean }>('/notifications/preferences'),
  });
  const save = useMutation({
    mutationFn: (next: { email: boolean; sms: boolean }) => api<{ email: boolean; sms: boolean }>('/notifications/preferences', { method: 'PUT', body: next }),
    onSuccess: (saved) => queryClient.setQueryData(['notification-preferences'], saved),
  });
  if (!choices.data) {
    return <QueryState isPending={choices.isPending} error={choices.error} isEmpty={false} empty="" onRetry={() => void choices.refetch()} />;
  }
  const current = choices.data;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">
        {t('You always see notifications here. You can also have a copy sent to a confirmed email address or phone. In this project no email or SMS is really sent: copies go to the simulated outbox.')}
      </p>
      {save.error && <Notice tone="error">{save.error.message}</Notice>}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={current.email} disabled={save.isPending} onChange={(event) => save.mutate({ ...current, email: event.target.checked })} />
        {t('Email me a copy')}
      </label>
      {current.email && !emailConfirmed && <p className="text-amber-800">{t('Confirm your email address above, or no copy can be sent.')}</p>}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={current.sms} disabled={save.isPending} onChange={(event) => save.mutate({ ...current, sms: event.target.checked })} />
        {t('Text me a copy')}
      </label>
      {current.sms && !phoneConfirmed && <p className="text-amber-800">{t('Confirm your phone number above, or no copy can be sent.')}</p>}
      <div className="border-t border-slate-100 pt-3">
        <PushChoice />
      </div>
    </div>
  );
}

function PrivacySection() {
  const t = useT();
  const { logout } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = useMutation({
    mutationFn: () => api<void>('/me', { method: 'DELETE' }),
    onSuccess: () => {
      logout();
      window.location.href = '/';
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await download('/me/export', 'vayora-personal-data.json');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {t('Download a copy of your account, profile, rides, and bookings as a JSON file.')}
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <div>
        <Button tone="secondary" disabled={downloading} onClick={handleDownload}>
          {downloading ? t('Downloading…') : t('Download my data')}
        </Button>
      </div>
      <div className="border-t border-slate-100 pt-4">
        <p className="text-sm font-semibold text-slate-900">{t('Delete account')}</p>
        <p className="mt-1 text-sm text-slate-500">
          {t('Remove your personal details and sign out. This cannot be undone.')}
        </p>
        <div className="mt-3">
          <ConfirmButton
            label={t('Delete account')}
            confirmLabel={t('Yes, delete my account')}
            disabled={deleteAccount.isPending}
            onConfirm={() => deleteAccount.mutate()}
          >
            {t('All your personal information will be permanently deleted. Active rides or bookings must be finished first.')}
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}

/**
 * One row of a grouped list, as iOS's Settings lays them out: what it is and where it stands,
 * opening in place. A link to /account#<id> opens that row, so another screen can point at it.
 */
function SettingsRow({ id, icon: Icon, tint, title, status, children }: {
  id: string;
  icon: LucideIcon;
  /** The square behind the icon, as Settings colours each kind of row. */
  tint: string;
  title: string;
  /** Where it stands, shown at the row's end; nothing while unknown. */
  status?: string | null;
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash !== `#${id}` || !details.current) return;
    details.current.open = true;
    details.current.scrollIntoView?.({ block: 'start' });
  }, [hash, id]);
  return (
    <details ref={details} id={id} className="more scroll-mt-20 border-b border-slate-900/[0.06] last:border-0">
      <summary className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-teal-600/30">
        <span aria-hidden="true" className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg text-white ${tint}`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1 text-[16px] font-medium text-slate-900">{title}</span>
        {status && <span className="max-w-[45%] truncate text-[15px] text-slate-500">{status}</span>}
        <ChevronDown aria-hidden="true" className="more-chevron h-4 w-4 flex-none text-slate-400" />
      </summary>
      <section aria-label={title} className="px-4 pb-5 pt-1">
        {children}
      </section>
    </details>
  );
}

/** Rows grouped as Settings groups them, under a small heading. */
function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-slate-900/[0.04]">{children}</div>
    </div>
  );
}

const roleNames = { PASSENGER: msg('Passenger'), DRIVER: msg('Driver'), ADMIN: msg('Administrator') } as const;

/**
 * Who the member is, at the top of their account: photo, name, kind of account, and what is
 * confirmed, from the profile as the server has it. A member's page as others see it is a tap away.
 */
function AccountHeader({ profile }: { profile: MyProfile }) {
  const t = useT();
  const { user } = useAuth();
  if (!user) return null;
  const chip = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold';
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-slate-900/[0.04]">
      <div className="flex items-center gap-4">
        {/* Beside the name it shows, so no name of its own: "Your photo" is the one under Profile. */}
        <Photo path={`/users/${user.id}/photo`} alt="" initials={initialsOf(user.fullName)} size="h-16 w-16" />
        <div className="min-w-0">
          <p className="truncate text-[20px] font-bold tracking-tight text-slate-950">{user.fullName}</p>
          <p className="truncate text-sm text-slate-500">{[t(roleNames[user.role]), profile.email ?? profile.phone].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {profile.emailVerified && (
          <span className={`${chip} bg-emerald-100 text-emerald-800`}>
            <BadgeCheck aria-hidden="true" className="h-4 w-4" />
            {t('Email confirmed')}
          </span>
        )}
        {profile.phoneVerified && (
          <span className={`${chip} bg-emerald-100 text-emerald-800`}>
            <BadgeCheck aria-hidden="true" className="h-4 w-4" />
            {t('Phone confirmed')}
          </span>
        )}
        {!profile.emailVerified && !profile.phoneVerified && (
          // Through the router, so the row it points at opens as from any other link to it.
          <Link
            to="#contact"
            className={`${chip} min-h-9 bg-amber-100 text-amber-900 hover:bg-amber-200 touch:min-h-11 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/40`}
          >
            <CircleAlert aria-hidden="true" className="h-4 w-4" />
            {t('Confirm your email or phone')}
          </Link>
        )}
        {user.role !== 'ADMIN' && (
          <Link
            to={`/users/${user.id}`}
            className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-semibold text-teal-800 hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30"
          >
            {t('See your profile as others see it')}
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function AccountPage() {
  const t = useT();
  const { user } = useAuth();
  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: () => api<MyProfile>('/me/profile') });
  const mine = profile.data;
  // What each row says at its end. The same queries the rows use, so nothing is fetched twice.
  const member = user?.role !== 'ADMIN';
  const driver = user?.role === 'DRIVER';
  const contacts = useQuery({ queryKey: ['me', 'contacts'], queryFn: () => api<EmergencyContact[]>('/me/emergency-contacts'), enabled: member });
  const paying = useQuery({ queryKey: ['me', 'payment-details'], queryFn: () => api<DriverPaymentDetails>('/me/payment-details'), enabled: driver });
  const count = contacts.data?.length;

  return (
    <Page title={t('My account')}>
      <QueryState isPending={profile.isPending} error={profile.error} isEmpty={false} empty="" onRetry={() => void profile.refetch()} />
      {mine && (
        <>
          <AccountHeader profile={mine} />
          <SettingsGroup title={t('You')}>
            <SettingsRow id="profile" icon={UserRound} tint="bg-sky-900" title={t('Profile')} status={user?.fullName}>
              {user && (
                <div className="mb-4">
                  <PhotoEditor viewPath={`/users/${user.id}/photo`} changePath="/me/photo" alt={t('Your photo')} initials={initialsOf(user.fullName)} />
                </div>
              )}
              <ProfileForm profile={mine} />
            </SettingsRow>
            <SettingsRow
              id="contact"
              icon={Mail}
              tint="bg-teal-700"
              title={t('Email and phone')}
              status={mine.emailVerified || mine.phoneVerified ? t('Confirmed') : t('Not confirmed')}
            >
              <div className="space-y-4">
                <Confirm channel="email" label={t('Email')} address={mine.email} confirmed={mine.emailVerified} />
                <Confirm channel="phone" label={t('Phone')} address={mine.phone} confirmed={mine.phoneVerified} />
              </div>
            </SettingsRow>
          </SettingsGroup>
          {(member || driver) && (
            <SettingsGroup title={t('Safety')}>
              {member && (
                <SettingsRow
                  id="emergency-contacts"
                  icon={ShieldAlert}
                  tint="bg-danger"
                  title={t('Emergency contacts')}
                  status={count === undefined ? null : count === 0 ? t('None yet') : count === 1 ? t('{n} contact', { n: 1 }) : t('{n} contacts', { n: count })}
                >
                  <Contacts />
                </SettingsRow>
              )}
              {driver && (
                <SettingsRow
                  id="identity"
                  icon={IdCard}
                  tint="bg-slate-600"
                  title={t('Identity document')}
                  status={mine.declaredId ? t(idDocumentLabels[mine.declaredId]) : t('Not declared')}
                >
                  <IdDeclaration declared={mine.declaredId ?? null} />
                </SettingsRow>
              )}
            </SettingsGroup>
          )}
          {driver && (
            <SettingsGroup title={t('Payments')}>
              <SettingsRow
                id="payment"
                icon={Wallet}
                tint="bg-emerald-800"
                title={t('How passengers pay you')}
                status={paying.data ? (paying.data.upiId ?? (paying.data.hasQr ? t('QR code') : t('Cash only'))) : null}
              >
                <DriverPaymentEditor />
              </SettingsRow>
            </SettingsGroup>
          )}
          <SettingsGroup title={t('App')}>
            <SettingsRow id="notifications" icon={Bell} tint="bg-red-600" title={t('Notifications')}>
              <NotificationChoices emailConfirmed={mine.emailVerified} phoneConfirmed={mine.phoneVerified} />
            </SettingsRow>
            <SettingsRow id="invite" icon={Gift} tint="bg-amber-800" title={t('Invite friends')}>
              <Invitations />
            </SettingsRow>
          </SettingsGroup>
          <SettingsGroup title={t('Privacy and data')}>
            <SettingsRow id="privacy" icon={Shield} tint="bg-slate-700" title={t('Your data and account')}>
              <PrivacySection />
            </SettingsRow>
          </SettingsGroup>
        </>
      )}
    </Page>
  );
}
