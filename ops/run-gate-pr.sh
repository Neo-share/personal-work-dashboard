#!/usr/bin/env bash
set -euo pipefail

scope_json="$(node ops/agent-ci-scope.mjs --base="${BASE_REF:-origin/main}" --head="${HEAD_REF:-HEAD}")"
scope="$(node -e 'const fs = require("node:fs"); const input = fs.readFileSync(0, "utf8"); console.log(JSON.parse(input).scope)' <<< "$scope_json")"

echo "$scope_json"
pnpm "agent:scope:${scope}"
pnpm agent:gate
