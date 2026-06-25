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
  console.log(`\n[S4] dev gate loop round ${round}/${MAX_ROUNDS}`)

  const gateStatus = run('pnpm', ['agent:gate:dev'])
  if (gateStatus === 0) {
    console.log('[S4] dev gate passed')
    process.exit(0)
  }

  console.error(`[S4] dev gate failed in round ${round}`)
}

console.error(`[S4] dev gate loop failed after ${MAX_ROUNDS} rounds`)
process.exit(1)
