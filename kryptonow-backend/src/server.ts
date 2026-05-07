import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({ logger: true });
const prisma = new PrismaClient();

// Register Security & CORS
fastify.register(cors, { origin: '*' });

// Register JWT Authentication
fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'super-secret-kryptonow-key-change-me',
});

// Health check route
fastify.get('/health', async (request, reply) => {
  return { status: 'online', service: 'KryptoNow API', timestamp: new Date() };
});

const start = async () => {
  try {
    await fastify.listen({ port: 8080, host: '0.0.0.0' });
    console.log(' KryptoNow Backend running at http://localhost:8080');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
