import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const tokenCache = Platform.OS !== 'web'
  ? {
      getToken: (key: string) => SecureStore.getItemAsync(key),
      saveToken: (key: string, value: string) => SecureStore.setItemAsync(key, value),
      clearToken: (key: string) => SecureStore.deleteItemAsync(key),
    }
  : undefined;
