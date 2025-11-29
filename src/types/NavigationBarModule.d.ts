declare module 'react-native' {
  interface NativeModulesStatic {
    NavigationBarModule: {
      setNavigationBarColor: (color: string) => void;
    };
  }
}

