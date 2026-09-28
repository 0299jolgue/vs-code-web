#!/bin/sh
set -eu

PORT="${PORT:-80}"
HOST="${HOST:-0.0.0.0}"
DATA_DIR="${XDG_DATA_HOME:-/home/coder/.local/share}/code-server"
USER_DATA_DIR="${CODE_SERVER_USER_DATA_DIR:-$DATA_DIR}"
WORKSPACE="${WORKSPACE_DIR:-/home/coder/workspace}"
PROXY_URI="${VSCODE_PROXY_URI:-./proxy/{{port}}/}"

mkdir -p "$WORKSPACE" "$USER_DATA_DIR/User"

# Keep the workspace empty on first boot. Do not seed demo source files.
# The directory is deliberately separate from the repository source copied into the image.
if [ -n "${CODE_SERVER_PASSWORD:-}" ]; then
  AUTH_ARGS="--auth password --password $CODE_SERVER_PASSWORD"
else
  AUTH_ARGS="--auth none"
fi

exec code-server \
  --bind-addr "$HOST:$PORT" \
  --user-data-dir "$USER_DATA_DIR" \
  --extensions-dir "$DATA_DIR/extensions" \
  --disable-telemetry \
  --disable-update-check \
  --disable-getting-started-override \
  --ignore-last-opened \
  "$WORKSPACE"
