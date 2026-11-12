import { Alert, Platform } from 'react-native';

/**
 * Asks before something that cannot be undone. On a phone, the system dialog; in a browser,
 * where React Native's Alert does nothing, the browser's own.
 */
export function confirmAction(title: string, message: string, yes: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: no, style: 'cancel', onPress: () => resolve(false) },
      { text: yes, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
