import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({ logger: true });
const prisma = new PrismaClient();

// Initialize Firebase (Requires serviceAccountKey.json in root)
if (process.env.FIREBASE_CONFIG_PATH) {
  admin.initializeApp({
    credential: admin.credential.cert(require(process.env.FIREBASE_CONFIG_PATH))
  });
}

fastify.register(cors, { origin: '*' });
fastify.register(jwt, { secret: process.env.JWT_SECRET || 'super-secret' });

// --- ALCHEMY WEBHOOK ROUTE ---
fastify.post('/webhooks/alchemy', async (request, reply) => {
  const { event } = request.body as any;
  
  if (!event || !event.activity) return { status: 'ignored' };

  for (const activity of event.activity) {
    const toAddress = activity.toAddress;
    const value = activity.value;
    const asset = activity.asset;

    // 1. Find the user in our DB
    const user = await prisma.user.findUnique({
      where: { publicAddress: toAddress }
    });

    // 2. If user exists and has a push token, send notification
    if (user?.fcmToken) {
      await admin.messaging().send({
        token: user.fcmToken,
        notification: {
          title: ' Funds Received!',
          body: `You just received ${amount} ${token} in your KryptoNow vault.`
        },
        data: { screen: 'History' }
      });
      console.log(`Push sent to ${token}`);
    }
  }

  return { status: 'success' };
});

fastify.get('/health', async () => ({ status: 'online' }));

fastify.listen({ port: 8080, host: '0.0.0.0' });


