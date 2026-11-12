import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from './settings';
import { colors, radius } from './theme';
import type { BookingStatus, RideStatus } from './types';

// The pieces every screen is made of, in VAYORA's look: cards on a pale canvas, teal for the
// next step. Every word shown goes through the translation tables.

export function Screen({
  children,
  refreshing,
  onRefresh,
  edges = ['bottom'],
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: ('top' | 'bottom')[];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.heading} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      {children}
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  tone = 'primary',
  disabled,
  busy,
}: {
  title: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
}) {
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      style={({ pressed }) => [
        styles.button,
        tone === 'primary' && styles.primary,
        tone === 'secondary' && styles.secondary,
        tone === 'danger' && styles.dangerButton,
        pressed && !inactive && { opacity: 0.85 },
        inactive && { opacity: 0.5 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={tone === 'primary' ? '#fff' : colors.brand} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            tone === 'secondary' && { color: colors.brand },
            tone === 'danger' && { color: colors.danger },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  secure,
  keyboardType,
  placeholder,
  autoCapitalize = 'sentences',
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#9aa7b6"
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 84, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {children}
    </ScrollView>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const STATUS: Record<BookingStatus | RideStatus, [string, string, string]> = {
  PENDING: ['Waiting for the driver', colors.warnSoft, colors.warn],
  CONFIRMED: ['Confirmed', colors.okSoft, colors.ok],
  REJECTED: ['Declined by the driver', colors.line, colors.muted],
  CANCELLED: ['Cancelled', colors.line, colors.muted],
  COMPLETED: ['Completed', colors.brandSoft, colors.brand],
  NO_SHOW: ['Did not board', colors.dangerSoft, colors.danger],
  SCHEDULED: ['Scheduled', colors.infoSoft, colors.info],
  IN_PROGRESS: ['On the road', colors.warnSoft, colors.warn],
};

export function StatusBadge({ status }: { status: BookingStatus | RideStatus }) {
  const t = useT();
  const [label, background, color] = STATUS[status];
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color }]}>{t(label)}</Text>
    </View>
  );
}

/** A message from the server or the app, translated when the tables know it. */
export function Notice({ text, tone = 'error' }: { text: string | null | undefined; tone?: 'error' | 'success' | 'info' }) {
  const t = useT();
  if (!text) return null;
  const [background, color] =
    tone === 'error' ? [colors.dangerSoft, colors.danger] : tone === 'success' ? [colors.okSoft, colors.ok] : [colors.infoSoft, colors.info];
  return (
    <View style={[styles.notice, { backgroundColor: background }]} accessibilityLiveRegion="polite">
      <Text style={{ color, fontSize: 14, lineHeight: 20 }}>{t(text)}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: 32, alignItems: 'center' }}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    gap: 8,
    shadowColor: '#0b1220',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardPressed: { opacity: 0.9 },
  button: {
    minHeight: 50,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primary: { backgroundColor: colors.brand },
  secondary: { backgroundColor: colors.brandSoft },
  dangerButton: { backgroundColor: colors.dangerSoft },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  field: { gap: 0 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipTextSelected: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  notice: { borderRadius: radius.control, padding: 12 },
  empty: { padding: 24, alignItems: 'center' },
});
