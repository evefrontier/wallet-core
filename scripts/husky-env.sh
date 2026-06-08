#!/usr/bin/env sh

setup_node() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    return 0
  fi

  . "$NVM_DIR/nvm.sh"

  if [ -n "${HUSKY_NODE_VERSION:-}" ]; then
    nvm use "$HUSKY_NODE_VERSION" --silent >/dev/null
  elif [ -f ".nvmrc" ]; then
    nvm use --silent >/dev/null
  fi
}

setup_bun() {
  if command -v bun >/dev/null 2>&1; then
    return 0
  fi

  BUN_SEARCH_PATHS="${HUSKY_BUN_PATHS:-/opt/homebrew/bin:/usr/local/bin:$HOME/.bun/bin}"
  OLD_IFS=$IFS
  IFS=:

  for dir in $BUN_SEARCH_PATHS; do
    if [ -x "$dir/bun" ]; then
      export PATH="$dir:$PATH"
      IFS=$OLD_IFS
      return 0
    fi
  done

  IFS=$OLD_IFS

  echo "bun not found. Install Bun or add it to PATH." >&2
  echo "Checked PATH and HUSKY_BUN_PATHS: $BUN_SEARCH_PATHS" >&2
  exit 127
}

setup_node
setup_bun
