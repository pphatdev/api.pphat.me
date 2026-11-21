#!/bin/sh
set -e

echo "Applying pending D1 migrations (local)..."
npx wrangler d1 migrations apply api --local -y

# Optional: seed admin if ADMIN_EMAIL and ADMIN_PASSWORD are provided
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
    echo "Checking/upserting default admin user..."
    node scripts/create-admin.js || echo "Admin creation step skipped or already exists."
fi

echo "Starting Wrangler dev server on 0.0.0.0:8787..."
exec npx wrangler dev --ip 0.0.0.0 --port 8787
