import Fastify from 'fastify'
import cors    from '@fastify/cors'
import jwt     from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import { Expo } from 'expo-server-sdk'

dotenv.config()

// Fail fast on missing required config
if (!process.env.ADMIN_WALLET) {
  console.warn('[KryptoNow] ADMIN_WALLET env var not set — admin routes will be inaccessible')
}
if (!process.env.JWT_SECRET) {
  throw new Error('[KryptoNow] JWT_SECRET env var is required. Set a strong random value.')
}

const fastify = Fastify({ logger: true })
const prisma  = new PrismaClient()
const expo    = new Expo()

const ADMIN_WALLET = (process.env.ADMIN_WALLET ?? '').toLowerCase()
const LOG_TTL_DAYS = 15
const KYC_TTL_YEARS = 10

fastify.register(cors, { origin: '*' })
fastify.register(jwt,  { secret: process.env.JWT_SECRET })

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
async function appLog(level: 'info' | 'warn' | 'error', event: string, message: string, opts?: {
  wallet?: string; userId?: string; meta?: Record<string, unknown>
}) {
  const now      = new Date()
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + LOG_TTL_DAYS)
  await prisma.appLog.create({
    data: {
      level, event, message,
      wallet:    opts?.wallet,
      userId:    opts?.userId,
      meta:      opts?.meta ? JSON.stringify(opts.meta) : undefined,
      expiresAt,
    },
  }).catch(() => {})
}

function requireAdmin(request: any, reply: any) {
  const wallet = (request.headers['x-admin-wallet'] as string ?? '').toLowerCase()
  if (!ADMIN_WALLET || wallet !== ADMIN_WALLET) {
    reply.status(403).send({ error: 'Forbidden' })
    return false
  }
  return true
}

async function purgeExpiredLogs() {
  await prisma.appLog.deleteMany({ where: { expiresAt: { lte: new Date() } } })
}

// Run purge on startup and every hour
purgeExpiredLogs()
setInterval(purgeExpiredLogs, 60 * 60 * 1000)

// ─────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────
fastify.get('/health', async () => ({ status: 'online' }))

// ─────────────────────────────────────────────────────────────────────────────
// Device token registration (push notifications)
// ─────────────────────────────────────────────────────────────────────────────
fastify.post('/api/devices/register', async (request, reply) => {
  const { token, walletAddress } = request.body as any
  if (!token || !walletAddress) return reply.status(400).send({ error: 'Missing token or walletAddress' })
  try {
    await prisma.user.upsert({
      where:  { publicAddress: walletAddress },
      update: { expoPushToken: token },
      create: { publicAddress: walletAddress, nonce: '', expoPushToken: token },
    })
    return { ok: true }
  } catch (e: any) {
    await appLog('error', 'devices.register', e.message, { wallet: walletAddress })
    return reply.status(500).send({ error: 'Internal error' })
  }
})

// ─────────────────────────────────────────────────────────────
// Client log ingestion
// ─────────────────────────────────────────────────────────────
fastify.post('/api/log', async (request, reply) => {
  const { level, event, message, wallet, meta } = request.body as any
  if (!level || !event || !message) return reply.status(400).send({ error: 'Missing fields' })
  const allowed = ['info', 'warn', 'error']
  await appLog(allowed.includes(level) ? level : 'info', event, message, { wallet, meta })
  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// Referral
// ─────────────────────────────────────────────────────────────
fastify.post('/api/referral/generate', async (request, reply) => {
  const { walletAddress, code } = request.body as any
  if (!walletAddress || !code) return reply.status(400).send({ error: 'Missing fields' })

  try {
    await prisma.user.upsert({
      where:  { publicAddress: walletAddress },
      update: { referralCode: code },
      create: { publicAddress: walletAddress, nonce: '', referralCode: code },
    })
    await appLog('info', 'referral.generate', `Code ${code} registered`, { wallet: walletAddress })
    return { ok: true, code }
  } catch (e: any) {
    await appLog('error', 'referral.generate', e.message, { wallet: walletAddress })
    return reply.status(500).send({ error: 'Internal error' })
  }
})

fastify.get('/api/referral/stats', async (request, reply) => {
  const { walletAddress } = request.query as any
  if (!walletAddress) return reply.status(400).send({ error: 'Missing walletAddress' })

  try {
    const user = await prisma.user.findUnique({
      where:   { publicAddress: walletAddress },
      include: { referralsMade: true },
    })
    if (!user) return { referrals: [], totalEarned: 0, pending: 0 }

    const referrals = user.referralsMade.map(r => ({
      id:       r.id,
      name:     r.refereeName ?? 'User',
      joinedAt: r.createdAt.toISOString(),
      status:   r.status,
      reward:   r.rewardAmount,
    }))
    const totalEarned = user.referralsMade.filter(r => r.status === 'rewarded').reduce((s, r) => s + r.rewardAmount, 0)
    const pending     = user.referralsMade.filter(r => r.status === 'pending').reduce((s, r) => s + r.rewardAmount, 0)
    return { referrals, totalEarned, pending }
  } catch (e: any) {
    await appLog('error', 'referral.stats', e.message, { wallet: walletAddress })
    return reply.status(500).send({ error: 'Internal error' })
  }
})

fastify.post('/api/referral/apply', async (request, reply) => {
  const { walletAddress, code, name } = request.body as any
  if (!walletAddress || !code) return reply.status(400).send({ error: 'Missing fields' })

  try {
    const referrer = await prisma.user.findFirst({ where: { referralCode: code } })
    if (!referrer) return reply.status(404).send({ error: 'Invalid referral code' })
    if (referrer.publicAddress.toLowerCase() === walletAddress.toLowerCase())
      return reply.status(400).send({ error: 'Self-referral not permitted' })

    const referee = await prisma.user.upsert({
      where:  { publicAddress: walletAddress },
      update: { appliedCode: code },
      create: { publicAddress: walletAddress, nonce: '', appliedCode: code },
    })

    await prisma.referral.create({
      data: { referrerId: referrer.id, refereeAddr: walletAddress, refereeName: name ?? null },
    })

    await appLog('info', 'referral.apply', `${walletAddress} used code ${code}`, { wallet: walletAddress })
    return { ok: true, bonusAmount: 100 }
  } catch (e: any) {
    await appLog('error', 'referral.apply', e.message, { wallet: walletAddress })
    return reply.status(500).send({ error: 'Internal error' })
  }
})

// ─────────────────────────────────────────────────────────────
// KYC
// ─────────────────────────────────────────────────────────────
fastify.post('/api/kyc/submit', async (request, reply) => {
  const { walletAddress, country, docType, docNumber, fullName, dob } = request.body as any
  if (!walletAddress || !country || !docType || !docNumber || !fullName || !dob)
    return reply.status(400).send({ error: 'Missing required fields' })

  // Basic date validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob))
    return reply.status(400).send({ error: 'Invalid date format (YYYY-MM-DD)' })

  try {
    const user = await prisma.user.upsert({
      where:  { publicAddress: walletAddress },
      update: { kycStatus: 'pending', country, firstName: fullName.split(' ')[0] },
      create: { publicAddress: walletAddress, nonce: '', kycStatus: 'pending', country },
    })

    const retainUntil = new Date()
    retainUntil.setFullYear(retainUntil.getFullYear() + KYC_TTL_YEARS)

    await prisma.kYCRecord.create({
      data: { userId: user.id, walletAddr: walletAddress, country, docType, docNumber, fullName, dob, retainUntil },
    })

    await appLog('info', 'kyc.submit', `KYC submitted: ${docType}`, { wallet: walletAddress, userId: user.id })
    return { ok: true, status: 'pending' }
  } catch (e: any) {
    await appLog('error', 'kyc.submit', e.message, { wallet: walletAddress })
    return reply.status(500).send({ error: 'Internal error' })
  }
})

fastify.get('/api/kyc/status', async (request, reply) => {
  const { walletAddress } = request.query as any
  if (!walletAddress) return reply.status(400).send({ error: 'Missing walletAddress' })
  const user = await prisma.user.findUnique({ where: { publicAddress: walletAddress } })
  return { status: user?.kycStatus ?? 'none' }
})

// ─────────────────────────────────────────────────────────────
// Admin routes
// ─────────────────────────────────────────────────────────────
fastify.get('/admin/stats', async (request, reply) => {
  if (!requireAdmin(request, reply)) return

  const [totalUsers, kycPending, kycVerified, logsToday, errorCount, referralsTotal] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { kycStatus: 'pending' } }),
    prisma.user.count({ where: { kycStatus: 'verified' } }),
    prisma.appLog.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
    prisma.appLog.count({ where: { level: 'error', createdAt: { gte: new Date(Date.now() - 86400000) } } }),
    prisma.referral.count(),
  ])
  return { totalUsers, kycPending, kycVerified, logsToday, errorCount, referralsTotal }
})

fastify.get('/admin/logs', async (request, reply) => {
  if (!requireAdmin(request, reply)) return
  const { level, limit = '200' } = request.query as any
  const where = level && level !== 'all' ? { level } : {}
  const logs = await prisma.appLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take:    parseInt(limit),
  })
  return { logs }
})

fastify.get('/admin/kyc/queue', async (request, reply) => {
  if (!requireAdmin(request, reply)) return
  const { status } = request.query as any
  const where = status && status !== 'all' ? { status } : {}
  const records = await prisma.kYCRecord.findMany({ where, orderBy: { submittedAt: 'desc' } })
  return { records }
})

fastify.post('/admin/kyc/:id/review', async (request, reply) => {
  if (!requireAdmin(request, reply)) return
  const { id }     = request.params as any
  const { action } = request.body   as any
  if (!['verified', 'rejected'].includes(action))
    return reply.status(400).send({ error: 'Invalid action' })

  const record = await prisma.kYCRecord.update({
    where: { id },
    data:  { status: action, reviewedAt: new Date() },
  })
  await prisma.user.update({
    where: { id: record.userId },
    data:  { kycStatus: action },
  })
  await appLog('info', 'kyc.review', `KYC ${action} by admin`, { wallet: record.walletAddr, userId: record.userId })

  // Notify user via Expo push if they have a token
  const user = await prisma.user.findUnique({ where: { id: record.userId } })
  if (user?.expoPushToken && Expo.isExpoPushToken(user.expoPushToken)) {
    expo.sendPushNotificationsAsync([{
      to:    user.expoPushToken,
      title: action === 'verified' ? 'KYC Approved!' : 'KYC Update',
      body:  action === 'verified'
        ? 'Your identity has been verified. Deposits and withdrawals are now enabled.'
        : 'Your KYC submission needs attention. Please resubmit with valid documents.',
      data:  { screen: 'kyc' },
    }]).catch(() => {})
  }

  return { ok: true, status: action }
})

fastify.get('/admin/users', async (request, reply) => {
  if (!requireAdmin(request, reply)) return
  const { search } = request.query as any
  const where = search ? {
    OR: [
      { publicAddress: { contains: search } },
      { firstName:     { contains: search } },
      { lastName:      { contains: search } },
    ],
  } : {}
  const users = await prisma.user.findMany({
    where,
    orderBy:  { createdAt: 'desc' },
    take:     500,
    include:  { _count: { select: { referralsMade: true } } },
  })
  return {
    users: users.map(u => ({
      id:        u.id,
      wallet:    u.publicAddress,
      name:      [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || '',
      country:   u.country ?? '',
      kycStatus: u.kycStatus,
      referrals: u._count.referralsMade,
      joinedAt:  u.createdAt.toISOString(),
    })),
  }
})

// ─────────────────────────────────────────────────────────────
// Alchemy webhook (push notification on transfer received)
// ─────────────────────────────────────────────────────────────
fastify.post('/webhooks/alchemy', async (request, reply) => {
  const { event } = request.body as any
  if (!event?.activity) return { status: 'ignored' }

  for (const activity of event.activity) {
    const user = await prisma.user.findUnique({ where: { publicAddress: activity.toAddress } })
    if (user?.expoPushToken && Expo.isExpoPushToken(user.expoPushToken)) {
      expo.sendPushNotificationsAsync([{
        to:    user.expoPushToken,
        title: 'Funds Received!',
        body:  `You received ${activity.value} ${activity.asset} in your KryptoNow wallet.`,
        data:  { screen: 'dashboard' },
      }]).catch(() => {})
    }
  }
  return { status: 'success' }
})

fastify.listen({ port: 8080, host: '0.0.0.0' })
