#!/usr/bin/env bash
# Atualiza a main local com origin/main, incorpora origin/main em lucasandrade
# e faz push de lucasandrade. No fim volta à branch em que estavas.
#
# Uso: ./scripts/sync-lucasandrade.sh
#      bash scripts/sync-lucasandrade.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "[sync-lucasandrade] Erro: não é um repositório git." >&2
  exit 1
fi

START_BRANCH="$(git branch --show-current)"
STASHED=0

if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  echo "[sync-lucasandrade] Árvore de trabalho com alterações — guardando stash…"
  git stash push -m "sync-lucasandrade autostash $(date +%Y%m%d-%H%M%S)"
  STASHED=1
fi

echo "[sync-lucasandrade] fetch origin…"
git fetch origin

echo "[sync-lucasandrade] atualizar main…"
git checkout main
git pull origin main

echo "[sync-lucasandrade] atualizar lucasandrade com origin/main…"
git checkout lucasandrade
git merge origin/main --no-edit

echo "[sync-lucasandrade] push origin lucasandrade…"
git push origin lucasandrade

echo "[sync-lucasandrade] voltar para ${START_BRANCH}…"
git checkout "$START_BRANCH"

if [[ "$STASHED" == 1 ]]; then
  echo "[sync-lucasandrade] reaplicar stash…"
  git stash pop
fi

echo "[sync-lucasandrade] Concluído."
