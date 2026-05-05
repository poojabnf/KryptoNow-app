import {
  GuardianAdded as GuardianAddedEvent,
  GuardianRemoved as GuardianRemovedEvent,
  RecoveryInitiated as RecoveryInitiatedEvent,
  RecoverySigned as RecoverySignedEvent,
  RecoveryExecuted as RecoveryExecutedEvent,
} from '../generated/GuardianRegistry/GuardianRegistry'
import {
  GuardianAdded, GuardianRemoved,
  RecoveryInitiated, RecoverySigned, RecoveryExecuted,
  SmartAccountConfig,
} from '../generated/schema'

export function handleGuardianAdded(event: GuardianAddedEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32())
  const e  = new GuardianAdded(id)
  e.smartAccount = event.params.smartAccount
  e.guardian     = event.params.guardian
  e.nickname     = event.params.nickname
  e.threshold    = event.params.threshold.toI32()
  e.timestamp    = event.params.timestamp
  e.blockNumber  = event.block.number
  e.txHash       = event.transaction.hash
  e.save()

  let cfg = SmartAccountConfig.load(event.params.smartAccount)
  if (!cfg) { cfg = new SmartAccountConfig(event.params.smartAccount); cfg.guardians = [] }
  const gs = cfg.guardians; gs.push(event.params.guardian)
  cfg.guardians = gs; cfg.threshold = event.params.threshold.toI32()
  cfg.updatedAt = event.block.timestamp; cfg.save()
}

export function handleGuardianRemoved(event: GuardianRemovedEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32())
  const e  = new GuardianRemoved(id)
  e.smartAccount = event.params.smartAccount
  e.guardian     = event.params.guardian
  e.timestamp    = event.params.timestamp
  e.blockNumber  = event.block.number
  e.txHash       = event.transaction.hash
  e.save()

  const cfg = SmartAccountConfig.load(event.params.smartAccount)
  if (cfg) {
    cfg.guardians = cfg.guardians.filter(g => g != event.params.guardian)
    cfg.updatedAt = event.block.timestamp; cfg.save()
  }
}

export function handleRecoveryInitiated(event: RecoveryInitiatedEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32())
  const e  = new RecoveryInitiated(id)
  e.smartAccount = event.params.smartAccount
  e.newOwner     = event.params.newOwner
  e.requestId    = event.params.requestId
  e.deadline     = event.params.deadline
  e.timestamp    = event.params.timestamp
  e.blockNumber  = event.block.number
  e.txHash       = event.transaction.hash
  e.save()
}

export function handleRecoverySigned(event: RecoverySignedEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32())
  const e  = new RecoverySigned(id)
  e.requestId   = event.params.requestId
  e.guardian    = event.params.guardian
  e.timestamp   = event.params.timestamp
  e.blockNumber = event.block.number
  e.txHash      = event.transaction.hash
  e.save()
}

export function handleRecoveryExecuted(event: RecoveryExecutedEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32())
  const e  = new RecoveryExecuted(id)
  e.requestId    = event.params.requestId
  e.smartAccount = event.params.smartAccount
  e.newOwner     = event.params.newOwner
  e.timestamp    = event.params.timestamp
  e.blockNumber  = event.block.number
  e.txHash       = event.transaction.hash
  e.save()
}
