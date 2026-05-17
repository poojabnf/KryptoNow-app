// utils/pushApi.ts
export const registerPushTokenWithBackend = async (walletAddress: string, fcmToken: string) => {
  try {
    const BACKEND_URL = 'http://192.168.1.4:8080/register-push';

    console.log(` Registering push token for ${walletAddress}...`);

    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicAddress: walletAddress,
        fcmToken: fcmToken,
      }),
    });

    const data = await response.json();
    
    if (data.status === 'registered') {
      console.log(' Successfully linked FCM token to vault:', data.address);
    } else {
      console.error(' Backend registration failed:', data);
    }
  } catch (error) {
    console.error(' Network error registering push token:', error);
  }
};
