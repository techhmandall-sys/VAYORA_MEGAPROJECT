import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useAuth } from '../../src/auth';
import { useT } from '../../src/settings';
import { colors } from '../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const icon =
  (name: IconName) =>
  ({ color, size }: { color: unknown; size: number }) => (
    <Ionicons name={name} color={typeof color === 'string' ? color : colors.muted} size={size} />
  );

/** A passenger's tabs or a driver's: each sees only their own. */
export default function TabsLayout() {
  const t = useT();
  const { user } = useAuth();
  if (!user) return <Redirect href="/sign-in" />;
  const driver = user.role === 'DRIVER';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.canvas },
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="search" options={{ title: t('Find a ride'), href: driver ? null : undefined, tabBarIcon: icon('search') }} />
      <Tabs.Screen
        name="bookings"
        options={{ title: t('My bookings'), href: driver ? null : undefined, tabBarIcon: icon('ticket-outline') }}
      />
      <Tabs.Screen name="rides" options={{ title: t('My rides'), href: driver ? undefined : null, tabBarIcon: icon('car-outline') }} />
      <Tabs.Screen
        name="publish"
        options={{ title: t('Publish a ride'), href: driver ? undefined : null, tabBarIcon: icon('add-circle-outline') }}
      />
      <Tabs.Screen name="notifications" options={{ title: t('Notifications'), tabBarIcon: icon('notifications-outline') }} />
      <Tabs.Screen name="account" options={{ title: t('Account'), tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
