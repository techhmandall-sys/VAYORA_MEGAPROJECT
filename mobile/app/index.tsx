import { Redirect } from 'expo-router';

import { useAuth } from '../src/auth';

/** Each member starts on their own first screen: passengers search, drivers see their rides. */
export default function Index() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/sign-in" />;
  return <Redirect href={user.role === 'DRIVER' ? '/rides' : '/search'} />;
}
