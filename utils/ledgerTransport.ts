// utils/ledgerTransport.ts
import { Platform } from 'react-native';

// Dynamically import transports so web doesn't crash on mobile modules and vice versa
export const getLedgerTransport = async () => {
  if (Platform.OS === 'web') {
    console.log(' Web detected: Initializing Ledger via WebHID...');
    const TransportWebHID = (await import('@ledgerhq/hw-transport-webhid')).default;
    // Check if the browser actually supports HID
    const isSupported = await TransportWebHID.isSupported();
    if (!isSupported) throw new Error('WebHID not supported in this browser.');
    
    return await TransportWebHID.create();
  } else {
    console.log(` ${Platform.OS} detected: Initializing Ledger via Bluetooth (BLE)...`);
    const TransportBLE = (await import('@ledgerhq/react-native-hw-transport-ble')).default;
    
    // In production, you would scan for devices here. 
    // TransportBLE.create() attempts to connect to the first available Ledger.
    return await TransportBLE.create();
  }
};
