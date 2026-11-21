FROM node:22-slim

# Install system utilities (curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies required for wrangler & typescript)
RUN npm ci

# Copy project files
COPY . .

# Grant execute permissions to entrypoint script
RUN chmod +x /app/docker-entrypoint.sh

# Expose Cloudflare Workers dev port
EXPOSE 8787

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8787/ || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
