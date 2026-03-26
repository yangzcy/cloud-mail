#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"

ADMIN_VALUE="${ADMIN_VALUE:-admin@email.snacktruckmall.shop}"
DOMAIN_VALUE="${DOMAIN_VALUE:-[\"emabl.snacktruckmall.shop\",\"emaal.snacktruckmall.shop\"]}"
PROJECT_LINK_VALUE="${PROJECT_LINK_VALUE:-false}"
LINUXDO_SWITCH_VALUE="${LINUXDO_SWITCH_VALUE:-false}"

cd "$ROOT_DIR"

npx wrangler deploy \
  -c wrangler.production.toml \
  --keep-vars \
  --var "admin:${ADMIN_VALUE}" \
  --var "domain:${DOMAIN_VALUE}" \
  --var "project_link:${PROJECT_LINK_VALUE}" \
  --var "linuxdo_switch:${LINUXDO_SWITCH_VALUE}"
