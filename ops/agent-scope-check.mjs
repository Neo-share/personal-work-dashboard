#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const SCOPE_PREFIX = {
  web: ['client/'],
  api: ['server/'],
  backend: ['server/'],
  contract: ['shared/'],
  shared: ['shared/'],
  all: ['/'],
}

const ALWAYS_ALLOWED_PREFIX = [
  'agents/',
  'docs/',
  'ops/',
  '.github/',
  '.cursor/rules/',
  '.cursor/skills/workflow-driven-requirements/',
]

const ALWAYS_ALLOWED_FILES = new Set([
  'AGENTS.md',
  'ARCHITECTURE.md',
  'CLAUDE.md',
  'CODEX.md',
  'package.json',
  'pnpm-workspace.yaml',
])

function parseArgs(argv) {
  const args = new Map()
  for (const arg of argv) {
    const [key, value] = arg.startsWith('--') ? arg.slice(2).split('=') : [arg, 'true']
    args.set(key, value ?? 'true')
  }
  return args
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

function addLines(target, output) {
  for (const line of output.split('\n')) {
    const file = line.trim()
    if (file) target.add(file)
  }
}

function getChangedFiles(base, head) {
  const files = new Set()

  if (base && head) {
    addLines(files, git(['diff', '--name-only', `${base}...${head}`]))
  }

  addLines(files, git(['diff', '--cached', '--name-only']))
  addLines(files, git(['diff', '--name-only']))
  addLines(files, git(['ls-files', '--others', '--exclude-standard']))

  return [...files].sort()
}

function isAllowedFile(file, prefixes) {
  if (ALWAYS_ALLOWED_FILES.has(file)) return true
  if (ALWAYS_ALLOWED_PREFIX.some((prefix) => file.startsWith(prefix))) return true
  if (prefixes.includes('/')) return true
  return prefixes.some((prefix) => file.startsWith(prefix))
}

const args = parseArgs(process.argv.slice(2))
const scope = args.get('scope')
const base = args.get('base')
const head = args.get('head')

if (!scope || !SCOPE_PREFIX[scope]) {
  console.error(`未知 scope: ${scope ?? '(empty)'}`)
  console.error(`可选 scope: ${Object.keys(SCOPE_PREFIX).join(', ')}`)
  process.exit(1)
}

const changedFiles = getChangedFiles(base, head)
const disallowedFiles = changedFiles.filter((file) => !isAllowedFile(file, SCOPE_PREFIX[scope]))

if (disallowedFiles.length > 0) {
  console.error(`scope=${scope} 存在越界改动:`)
  for (const file of disallowedFiles) {
    console.error(`- ${file}`)
  }
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      scope,
      changedFiles,
    },
    null,
    2,
  ),
)
