FROM node:22-slim

# Install system utilities (curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Ensure directories for wrangler logs & state exist
RUN mkdir -p /root/.config/.wrangler /tmp/.wrangler

# Copy dependency manifests
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* package-lock.json* ./


# Install dependencies using pnpm (or npm fallback)
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else npm ci; fi

# Copy project files
COPY . .

# Grant execute permissions to entrypoint script
RUN chmod +x /app/docker-entrypoint.sh

# Expose Cloudflare Workers dev port
EXPOSE 8787

# Healthcheck
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8787/ || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
