#!/bin/sh
set -e

# Ensure wrangler config / log directory exists in container
mkdir -p /root/.config/.wrangler /tmp/.wrangler

# If custom command arguments are provided, execute them directly
if [ $# -gt 0 ]; then
    exec "$@"
fi

echo "Applying pending D1 migrations (local)..."
if command -v pnpm >/dev/null 2>&1; then
    echo "y" | pnpm exec wrangler d1 migrations apply api --local -y || true
else
    echo "y" | npx wrangler d1 migrations apply api --local -y || true
fi

# Optional: seed admin if ADMIN_EMAIL and ADMIN_PASSWORD are provided
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
    echo "Checking/upserting default admin user..."
    node scripts/create-admin.js || echo "Admin creation step skipped or already exists."
fi

WRANGLER_FLAGS="--ip 0.0.0.0 --port 8787"

# If CLOUDFLARE_API_TOKEN is not configured, run with --local to prevent
# wrangler from crashing on remote AI binding proxy in non-interactive mode.
if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ "$CLOUDFLARE_API_TOKEN" = "# ★ secret" ]; then
    echo "CLOUDFLARE_API_TOKEN not set; running with --local to disable remote AI proxy..."
    WRANGLER_FLAGS="$WRANGLER_FLAGS --local"
fi

echo "Starting Wrangler dev server ($WRANGLER_FLAGS)..."
if command -v pnpm >/dev/null 2>&1; then
    exec pnpm exec wrangler dev $WRANGLER_FLAGS
else
    exec npx wrangler dev $WRANGLER_FLAGS
fi
