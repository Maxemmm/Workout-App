// Confirmation native (Alert) → Promise<boolean>
import { Alert } from 'react-native';
import type { Confirm } from './types';

export const confirm: Confirm = ({ title, message, confirmLabel, cancelLabel, destructive }) =>
  new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
