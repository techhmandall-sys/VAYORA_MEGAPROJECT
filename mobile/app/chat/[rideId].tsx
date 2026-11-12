import * as Location from 'expo-location';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { Socket } from 'socket.io-client';

import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { formatTime } from '../../src/format';
import { ask, connectGateway, type Answer } from '../../src/realtime';
import { RideMap } from '../../src/RideMap';
import { gatewayUrlFor, useSettings } from '../../src/settings';
import { colors, radius } from '../../src/theme';
import type { ChatMessage, LivePoint, Ride } from '../../src/types';
import { Button, Muted, Notice, Row } from '../../src/ui';
import { useLoad } from '../../src/useLoad';

interface Joined extends Answer {
  role?: string;
  rideStatus?: string;
  messages?: ChatMessage[];
  location?: LivePoint | null;
}

// The gateway's refusals, in words a person reads.
const REFUSED: Record<string, string> = {
  not_a_member: 'Only the driver and passengers with a confirmed booking can open this chat.',
  rate_limited: 'Slow down: wait a few seconds before sending more.',
  not_joined: 'Reconnecting to the chat. Try again in a moment.',
  invalid: 'A message is 1 to 500 characters.',
  server_error: 'The chat is not working right now. Try again later.',
};

/** A ride's chat, and where its driver is: a passenger follows, the driver shares. */
export default function Chat() {
  const { t, apiUrl } = useSettings();
  const { user, token } = useAuth();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const id = Number(rideId);
  const { data: ride } = useLoad(() => api<Ride>(`/rides/${id}`), [id]);

  const socket = useRef<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [driver, setDriver] = useState<{ lat: number; lon: number } | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sharing, setSharing] = useState(false);
  const list = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (!token) return;
    const s = connectGateway(gatewayUrlFor(apiUrl), token);
    socket.current = s;
    const join = async () => {
      try {
        const joined = await ask<Joined>(s, 'ride:join', { rideId: id });
        if (!joined.ok) return setError(REFUSED[joined.error ?? ''] ?? REFUSED.server_error);
        setError(null);
        setConnected(true);
        setMessages(joined.messages ?? []);
        if (joined.location) setDriver({ lat: joined.location.lat, lon: joined.location.lon });
      } catch {
        setError(REFUSED.server_error);
      }
    };
    s.on('connect', join);
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => {
      setConnected(false);
      setError('Cannot reach the chat. Check your connection and try again.');
    });
    s.on('chat:message', (message: ChatMessage) =>
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message])),
    );
    s.on('location', (point: LivePoint) => setDriver({ lat: point.lat, lon: point.lon }));
    return () => {
      s.emit('ride:leave', { rideId: id });
      s.disconnect();
      socket.current = null;
    };
  }, [apiUrl, token, id]);

  // A driver on the road shares their position while this screen is open, as the web app does.
  useEffect(() => {
    if (!sharing) return;
    let watch: Location.LocationSubscription | null = null;
    let stopped = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setSharing(false);
        setError('VAYORA needs your location to share it. Allow it in the phone settings.');
        return;
      }
      if (stopped) return;
      watch = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (position) => {
          const point = { lat: position.coords.latitude, lon: position.coords.longitude };
          setDriver(point);
          socket.current?.emit('location:update', { rideId: id, ...point });
        },
      );
    })();
    return () => {
      stopped = true;
      watch?.remove();
    };
  }, [sharing, id]);

  useEffect(() => {
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !socket.current) return;
    try {
      const answer = await ask<Answer>(socket.current, 'chat:send', { rideId: id, text: body });
      if (!answer.ok) return setError(REFUSED[answer.error ?? ''] ?? REFUSED.server_error);
      setText('');
      setError(null);
    } catch {
      setError(REFUSED.server_error);
    }
  };

  const stops = useMemo(() => ride?.stops.map(({ name, lat, lon }) => ({ name, lat, lon })) ?? [], [ride]);
  const canShare = user?.role === 'DRIVER' && ride?.status === 'IN_PROGRESS';

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: t('Messages') }} />
      <View style={styles.top}>
        {ride ? <RideMap stops={stops} path={ride.path} driver={driver} height={190} /> : null}
        {canShare ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.share}>{t('Share my position with passengers')}</Text>
            <Switch value={sharing} onValueChange={setSharing} trackColor={{ true: colors.brand, false: colors.line }} />
          </Row>
        ) : null}
        {!canShare && user?.role === 'PASSENGER' ? (
          <Muted>{driver ? t("The driver's position, as they last shared it.") : t('The driver shares their position once the ride is on the road.')}</Muted>
        ) : null}
        <Notice text={error} />
      </View>
      <ScrollView ref={list} style={styles.list} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {messages.length === 0 ? <Muted>{t('Message everyone on this ride')}</Muted> : null}
        {messages.map((message) => {
          const mine = message.senderId === user?.id;
          return (
            <View key={message.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              {!mine ? <Text style={styles.sender}>{message.senderName}</Text> : null}
              <Text style={[styles.body, mine && { color: '#fff' }]}>{message.text}</Text>
              <Text style={[styles.time, mine && { color: '#d1fae5' }]}>{formatTime(message.sentAt)}</Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('Message everyone on this ride')}
          placeholderTextColor="#9aa7b6"
          accessibilityLabel={t('Message everyone on this ride')}
          style={styles.input}
          maxLength={500}
          multiline
        />
        <View style={{ width: 92 }}>
          <Button title={t('Send')} onPress={send} disabled={!connected || !text.trim()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  top: { padding: 12, gap: 8 },
  share: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  list: { flex: 1 },
  bubble: { maxWidth: '82%', borderRadius: radius.control, padding: 10, gap: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.brand },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  sender: { fontSize: 12, fontWeight: '700', color: colors.brand },
  body: { fontSize: 15, color: colors.text },
  time: { fontSize: 11, color: colors.muted, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
});
