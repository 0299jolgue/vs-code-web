#!/bin/sh
set -eu

PORT="${PORT:-80}"
HOST="${HOST:-0.0.0.0}"
DATA_DIR="${XDG_DATA_HOME:-/home/coder/.local/share}/code-server"
USER_DATA_DIR="${CODE_SERVER_USER_DATA_DIR:-$DATA_DIR}"
WORKSPACE="${WORKSPACE_DIR:-/home/coder/workspace}"
EXTENSIONS_DIR="${EXTENSIONS_DIR:-$DATA_DIR/extensions}"
PROXY_URI="${VSCODE_PROXY_URI:-./proxy/{{port}}/}"

mkdir -p "$WORKSPACE" "$USER_DATA_DIR/User" "$EXTENSIONS_DIR"
export VSCODE_PROXY_URI="$PROXY_URI"

# The workspace is intentionally empty on first boot, like a normal fresh VS Code window.
# The repo source stays outside the user's workspace.
install_extension() {
  ext="$1"
  # Avoid re-downloading an extension on every restart.
  if ! ls "$EXTENSIONS_DIR"/"${ext}"-* >/dev/null 2>&1; then
    code-server --user-data-dir "$USER_DATA_DIR" --extensions-dir "$EXTENSIONS_DIR" --install-extension "$ext" >/dev/null 2>&1 || true
  fi
}

# This fallback also makes the project work in Shard setups that run package.json/Procfile
# directly instead of using the Docker image.
install_extension "ritwickdey.LiveServer"
install_extension "ms-python.python"
install_extension "ms-python.vscode-pylance"
install_extension "dbaeumer.vscode-eslint"
install_extension "esbenp.prettier-vscode"
install_extension "redhat.vscode-yaml"
install_extension "golang.go"

set -- \
  --bind-addr "$HOST:$PORT" \
  --user-data-dir "$USER_DATA_DIR" \
  --extensions-dir "$EXTENSIONS_DIR" \
  --disable-telemetry \
  --disable-update-check \
  --disable-getting-started-override \
  --ignore-last-opened

if [ -n "${CODE_SERVER_PASSWORD:-}" ]; then
  set -- "$@" --auth password --password "$CODE_SERVER_PASSWORD"
else
  set -- "$@" --auth none
fi

exec code-server "$@" "$WORKSPACE"
