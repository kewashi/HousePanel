#!/usr/bin/env bash
set -euo pipefail

WORKDIR="${WORKDIR:-$(cd "$(dirname "$0")" && pwd)}"
PYTHON_APP="${PYTHON_APP:-hpsidecar.py}"
NODE_APP="${NODE_APP:-hpserver.js}"
HP_VENV="${HP_VENV:-$HOME/venvs/housepanel}"
NODE_BIN="${NODE_BIN:-node}"
PYTHON_BIN="${HP_VENV}/bin/python"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "Missing virtualenv python at: ${PYTHON_BIN}" >&2
  echo "Create it with: python3 -m venv ${HP_VENV}" >&2
  exit 1
fi

if [[ ! -f "${WORKDIR}/${PYTHON_APP}" ]]; then
  echo "Missing sidecar app: ${WORKDIR}/${PYTHON_APP}" >&2
  exit 1
fi

if [[ ! -f "${WORKDIR}/${NODE_APP}" ]]; then
  echo "Missing node app: ${WORKDIR}/${NODE_APP}" >&2
  exit 1
fi

cleanup() {
  if [[ -n "${PY_PID:-}" ]]; then kill "${PY_PID}" 2>/dev/null || true; fi
  if [[ -n "${NODE_PID:-}" ]]; then kill "${NODE_PID}" 2>/dev/null || true; fi
  wait || true
}
trap cleanup EXIT INT TERM

cd "${WORKDIR}"

"${PYTHON_BIN}" "${PYTHON_APP}" &
PY_PID=$!

"${NODE_BIN}" "${NODE_APP}" &
NODE_PID=$!

# If either process exits, shut both down so systemd can restart the service.
wait -n "${PY_PID}" "${NODE_PID}"
exit 1
