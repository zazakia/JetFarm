import React from 'react';
import { View, Text } from 'react-native';

const Toast = () => <View style={{ display: 'none' }} />;

// Mock the static methods for Web
(Toast as any).show = (options: any) => {
    console.log('[Toast Web]', options.text1, options.text2);
    // Future improvement: Implement a simple web-native toast overlay here
};

(Toast as any).hide = () => {};

export default Toast;
