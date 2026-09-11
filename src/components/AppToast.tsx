import React from 'react';
import { Platform, View } from 'react-native';

type ToastOptions = {
  text1?: string;
  text2?: string;
};

const WebToast = () => <View style={{ display: 'none' }} />;

(WebToast as any).show = (options: ToastOptions) => {
  console.log('[Toast Web]', options?.text1, options?.text2);
};

(WebToast as any).hide = () => {};

let ToastComponent: any = WebToast;

if (Platform.OS !== 'web' && process.env.NODE_ENV !== 'test') {
  try {
    ToastComponent = require('react-native-toast-message').default;
  } catch {
    ToastComponent = WebToast;
  }
}

export default ToastComponent;
