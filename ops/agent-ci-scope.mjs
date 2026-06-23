#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const DOMAIN_PREFIX = {
  web: ['client/'],
  api: ['server/'],
  shared: ['shared/'],
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

function isAlwaysAllowed(file) {
  return ALWAYS_ALLOWED_FILES.has(file) || ALWAYS_ALLOWED_PREFIX.some((prefix) => file.startsWith(prefix))
}

function detectDomain(file) {
  for (const [domain, prefixes] of Object.entries(DOMAIN_PREFIX)) {
    if (prefixes.some((prefix) => file.startsWith(prefix))) return domain
  }
  return 'unknown'
}

const args = parseArgs(process.argv.slice(2))
const changedFiles = getChangedFiles(args.get('base'), args.get('head'))
const businessFiles = changedFiles.filter((file) => !isAlwaysAllowed(file))
const domains = new Set(businessFiles.map(detectDomain))

let scope = 'all'
let reason = '仅控制层、文档或项目级配置改动'

if (domains.size === 1) {
  const [domain] = [...domains]
  scope = domain === 'unknown' ? 'all' : domain
  reason = domain === 'unknown' ? '包含未知路径改动' : `单域改动: ${domain}`
} else if (domains.size > 1) {
  reason = `多域改动: ${[...domains].join(', ')}`
}

console.log(
  JSON.stringify(
    {
      scope,
      reason,
      changedFiles,
      businessFiles,
    },
    null,
    2,
  ),
)
