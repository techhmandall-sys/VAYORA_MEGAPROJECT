import { zodResolver } from '@hookform/resolvers/zod';
import { Car, Check, Search, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import heroNarrow from '../assets/khandala-900.webp';
import { GoogleSignIn } from '../components/google';
import { homeFor } from '../components/Layout';
import { useLargeTitle } from '../components/pageTitle';
import { Button, More, Notice, PasswordField, TextField } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';
import { loginSchema, registerSchema, type LoginForm, type RegisterForm } from '../lib/schemas';

/**
 * Signing in and signing up, beside the brand: the front page's road and promise next to the
 * form on a wide screen, as a strip above it on a phone, so the form comes first there.
 */
function AuthShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  const t = useT();
  const heading = useLargeTitle(title);
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] bg-surface shadow-float ring-1 ring-slate-900/[0.04] lg:grid-cols-[1fr_1.1fr]">
      <div className="relative isolate overflow-hidden bg-navy px-6 py-6 text-white sm:px-8 lg:py-10">
        <img src={heroNarrow} alt="" decoding="async" className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_center]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-navy/85 via-navy/70 to-navy/95" />
        {/* On a phone the header already says it. */}
        <p className="hidden text-[20px] font-extrabold tracking-tight lg:block">VAYORA</p>
        <p className="text-[26px] font-extrabold leading-tight tracking-tight lg:mt-10 lg:text-[34px]">{t('Your Journey. Shared Better.')}</p>
        <ul className="mt-8 hidden space-y-3 lg:block">
          {[t('Pay the driver directly, in cash or by UPI'), t('Keep the whole fare: VAYORA charges nothing'), t('Every screen in English, Hindi and Marathi, receipts included.')].map((point) => (
            <li key={point} className="flex items-start gap-2.5 text-[15px] leading-snug text-white/90">
              <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white/20">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className="px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
        <h1 ref={heading} className="text-[28px] font-bold leading-tight tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-500">{lead}</p>
        <div className="mt-6 space-y-5">{children}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const t = useT();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [failure, setFailure] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = handleSubmit(async (form) => {
    setFailure(null);
    try {
      const signedIn = await login(form);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? homeFor(signedIn.role), { replace: true });
    } catch (error) {
      setFailure((error as Error).message);
    }
  });

  return (
    <AuthShell title={t('Sign in')} lead={t('Welcome back. Your bookings and rides are where you left them.')}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {failure && <Notice tone="error">{failure}</Notice>}
        <TextField label={t('Email or phone number')} autoComplete="username" error={formState.errors.login?.message} {...register('login')} />
        <PasswordField label={t('Password')} autoComplete="current-password" error={formState.errors.password?.message} {...register('password')} />
        <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? t('Signing in…') : t('Sign in')}
        </Button>
      </form>
      <GoogleSignIn />
      <p className="text-sm text-slate-600">
        {t('New here?')}{' '}
        <Link to="/register" className="font-semibold text-teal-800 underline underline-offset-2">
          {t('Create an account')}
        </Link>
      </p>
    </AuthShell>
  );
}

/** One of the two kinds of account, as a card to choose: the choice cannot be changed later. */
function RoleCard({ icon: Icon, title, body, input }: { icon: LucideIcon; title: string; body: string; input: ReactNode }) {
  return (
    <label className="relative flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-surface p-4 transition-[border-color,box-shadow,background-color] hover:border-slate-300 has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50 has-[:checked]:shadow-[0_0_0_1px_rgb(var(--teal-600))] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-teal-600/30">
      {input}
      <span aria-hidden="true" className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{body}</span>
      </span>
    </label>
  );
}

export function RegisterPage() {
  const t = useT();
  const { user, register: signUp } = useAuth();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);
  // The front page's "Offer a ride" arrives with ?as=driver, so the choice is already made.
  const as = useSearchParams()[0].get('as');
  const role = as === 'driver' ? 'DRIVER' : as === 'passenger' ? 'PASSENGER' : undefined;
  const { register, handleSubmit, formState, watch } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { method: 'email', role },
  });
  const method = watch('method');

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = handleSubmit(async (form) => {
    setFailure(null);
    try {
      const created = await signUp(form);
      navigate(homeFor(created.role), { replace: true });
    } catch (error) {
      setFailure((error as Error).message);
    }
  });

  // A segment of the email-or-phone switch: a radio, drawn as one half of a pill.
  const segment =
    'flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-semibold text-slate-600 transition-colors has-[:checked]:bg-surface has-[:checked]:text-slate-900 has-[:checked]:shadow-sm has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-teal-600/30';

  return (
    <AuthShell title={t('Create an account')} lead={t('It is free to join.')}>
      <form onSubmit={submit} noValidate className="space-y-5">
        {failure && <Notice tone="error">{failure}</Notice>}
        <fieldset className="space-y-2" aria-describedby="role-hint">
          <legend className="text-[13px] font-medium text-slate-600">{t('I want to')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <RoleCard
              icon={Search}
              title={t('Find rides as a passenger')}
              body={t('Pay only for the stretch you ride')}
              input={<input type="radio" value="PASSENGER" className="sr-only" {...register('role')} />}
            />
            <RoleCard
              icon={Car}
              title={t('Offer rides as a driver')}
              body={t('Keep the whole fare: VAYORA charges nothing')}
              input={<input type="radio" value="DRIVER" className="sr-only" {...register('role')} />}
            />
          </div>
          <p id="role-hint" className="text-[13px] leading-snug text-slate-500">
            {t('An account is either a passenger or a driver. This cannot be changed later.')}
          </p>
          {formState.errors.role?.message && <p className="animate-fade-in text-[13px] font-medium text-red-700">{t(formState.errors.role.message)}</p>}
        </fieldset>
        <TextField label={t('Full name')} autoComplete="name" error={formState.errors.fullName?.message} {...register('fullName')} />
        <fieldset className="space-y-1.5">
          <legend className="text-[13px] font-medium text-slate-600">{t('Sign in with')}</legend>
          <div className="flex gap-1 rounded-full bg-slate-900/[0.06] p-1">
            <label className={segment}>
              <input type="radio" value="email" className="sr-only" {...register('method')} />
              {t('Email')}
            </label>
            <label className={segment}>
              <input type="radio" value="phone" className="sr-only" {...register('method')} />
              {t('Phone number')}
            </label>
          </div>
        </fieldset>
        {method === 'phone' ? (
          <TextField
            key="phone"
            label={t('Phone number')}
            type="tel"
            autoComplete="tel"
            hint={t('You will be asked to confirm it with a code. In this project no SMS is really sent.')}
            error={formState.errors.phone?.message}
            {...register('phone')}
          />
        ) : (
          <TextField key="email" label={t('Email')} type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        )}
        <PasswordField
          label={t('Password')}
          autoComplete="new-password"
          hint={t('At least 8 characters.')}
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <More label={t('Have an invitation code?')}>
          <TextField label={t('Invitation code (optional)')} autoComplete="off" {...register('referralCode')} />
        </More>
        <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? t('Creating…') : t('Create account')}
        </Button>
      </form>
      <GoogleSignIn />
      <p className="text-sm text-slate-600">
        {t('Already have an account?')}{' '}
        <Link to="/login" className="font-semibold text-teal-800 underline underline-offset-2">
          {t('Sign in')}
        </Link>
      </p>
    </AuthShell>
  );
}
