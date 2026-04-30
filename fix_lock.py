from pathlib import Path

path = Path('C:/Kypra/kypra-app/hooks/useLock.ts')
src = path.read_text(encoding='utf-8')

if 'Platform' not in src:
    src = src.replace(
        "import * as SecureStore from 'expo-secure-store'",
        "import { Platform } from 'react-native'\nimport * as SecureStore from 'expo-secure-store'"
    )

old = 'const storedPin = await SecureStore.getItemAsync(PIN_KEY)'
new = "if (Platform.OS === 'web') { setLockState('unlocked'); return; }\n      const storedPin = await SecureStore.getItemAsync(PIN_KEY)"
src = src.replace(old, new)

path.write_text(src, encoding='utf-8')
print('DONE')
print('Bypass injected:', "Platform.OS === 'web'" in src)

