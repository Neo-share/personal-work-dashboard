#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const MAX_ROUNDS = Number.parseInt(process.env.AGENT_S4_MAX_ROUNDS ?? '3', 10)

function run(command, args) {
  console.log(`\n$ ${[command, ...args].join(' ')}`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  return result.status ?? 1
}

for (let round = 1; round <= MAX_ROUNDS; round += 1) {
  console.log(`\n[S4] mechanical loop round ${round}/${MAX_ROUNDS}`)

  const fixStatus = run('pnpm', ['agent:mechanical-fix'])
  if (fixStatus !== 0) {
    console.error(`[S4] mechanical fix failed in round ${round}`)
    continue
  }

  const gateStatus = run('pnpm', ['agent:gate'])
  if (gateStatus === 0) {
    console.log('[S4] gate passed')
    process.exit(0)
  }

  console.error(`[S4] gate failed in round ${round}`)
}

console.error(`[S4] mechanical loop failed after ${MAX_ROUNDS} rounds`)
process.exit(1)
