/// <reference types="nativewind/types" />

import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }

  interface TextProps {
    className?: string;
  }

  interface ImageProps {
    className?: string;
  }

  interface TextInputProps {
    className?: string;
  }

  interface PressableProps {
    className?: string;
  }

  interface TouchableOpacityProps {
    className?: string;
  }

  interface ScrollViewProps {
    className?: string;
  }

  interface ActivityIndicatorProps {
    className?: string;
  }
}

declare module 'expo-file-system/legacy' {
  export * from 'expo-file-system';
}
