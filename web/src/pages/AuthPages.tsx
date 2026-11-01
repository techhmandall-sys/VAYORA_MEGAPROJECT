import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { GoogleSignIn } from '../components/google';
import { homeFor } from '../components/Layout';
import { Button, Card, Notice, Page, SelectField, TextField } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';
import { loginSchema, registerSchema, type LoginForm, type RegisterForm } from '../lib/schemas';

const CORRIDOR = 'M24 66 C 92 70, 104 22, 166 34 S 258 62, 296 20';

/** A road between two places with a car travelling it. Decoration only. */
function RouteHero() {
  const t = useT();
  const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#14b8a6] via-[#0f766e] to-[#134e4a] px-5 pb-4 pt-3 text-white shadow-float"
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <svg viewBox="0 0 320 86" className="relative h-24 w-full">
        <path d={CORRIDOR} fill="none" stroke="rgb(255 255 255 / 0.22)" strokeWidth="10" strokeLinecap="round" />
        <path d={CORRIDOR} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" className="animate-route-dash" />
        <circle cx="24" cy="66" r="6" fill="#fff" />
        <circle cx="296" cy="20" r="6" fill="#fff" />
        <circle r="5" fill="#fef08a" cx={still ? 166 : 0} cy={still ? 34 : 0}>
          {!still && <animateMotion dur="4.5s" repeatCount="indefinite" path={CORRIDOR} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.25 1" />}
        </circle>
      </svg>
      <div className="relative flex justify-between text-sm font-semibold tracking-wide">
        <span>{t('From')}</span>
        <span>{t('To')}</span>
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
    <div className="mx-auto max-w-md">
    <Page title={t('Sign in')}>
      <RouteHero />
      <Card>
        <form onSubmit={submit} noValidate className="space-y-4">
          {failure && <Notice tone="error">{failure}</Notice>}
          <TextField
            label={t('Email or phone number')}
            autoComplete="username"
            error={formState.errors.login?.message}
            {...register('login')}
          />
          <TextField
            label={t('Password')}
            type="password"
            autoComplete="current-password"
            error={formState.errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? t('Signing in…') : t('Sign in')}
          </Button>
        </form>
      </Card>
      <GoogleSignIn />
      <p className="text-sm text-slate-600">
        {t('New here?')}{' '}
        <Link to="/register" className="font-medium text-teal-800 underline">
          {t('Create an account')}
        </Link>
      </p>
    </Page>
    </div>
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

  return (
    <div className="mx-auto max-w-md">
    <Page title={t('Create an account')}>
      <RouteHero />
      <Card>
        <form onSubmit={submit} noValidate className="space-y-4">
          {failure && <Notice tone="error">{failure}</Notice>}
          <TextField label={t('Full name')} autoComplete="name" error={formState.errors.fullName?.message} {...register('fullName')} />
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">{t('Sign in with')}</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" value="email" {...register('method')} />
                {t('Email')}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" value="phone" {...register('method')} />
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
          <TextField
            label={t('Password')}
            type="password"
            autoComplete="new-password"
            hint={t('At least 8 characters.')}
            error={formState.errors.password?.message}
            {...register('password')}
          />
          <SelectField
            label={t('I want to')}
            defaultValue={role ?? ''}
            hint={t('An account is either a passenger or a driver. This cannot be changed later.')}
            error={formState.errors.role?.message}
            {...register('role')}
          >
            <option value="" disabled>
              {t('Choose one')}
            </option>
            <option value="PASSENGER">{t('Find rides as a passenger')}</option>
            <option value="DRIVER">{t('Offer rides as a driver')}</option>
          </SelectField>
          <TextField label={t('Invitation code (optional)')} autoComplete="off" {...register('referralCode')} />
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? t('Creating…') : t('Create account')}
          </Button>
        </form>
      </Card>
      <GoogleSignIn />
      <p className="text-sm text-slate-600">
        {t('Already have an account?')}{' '}
        <Link to="/login" className="font-medium text-teal-800 underline">
          {t('Sign in')}
        </Link>
      </p>
    </Page>
    </div>
  );
}
