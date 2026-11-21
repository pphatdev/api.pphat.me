.PHONY: help dev test migrate-local create-admin studio build up down restart logs ps status sh shell clean docker-dev docker-studio

# Default target: display help
help:
	@echo "Available commands for api.pphat.me:"
	@echo ""
	@echo "  Local Development (pnpm):"
	@echo "    make dev             Start local dev server (pnpm dev)"
	@echo "    make studio          Launch Drizzle Studio for local D1 (pnpm run db:studio)"
	@echo "    make test            Run test suite (pnpm test)"
	@echo "    make migrate-local   Apply local D1 migrations (pnpm run migrate:local)"
	@echo "    make create-admin    Seed default admin in local D1 (pnpm run db:create-admin)"
	@echo ""
	@echo "  Docker Compose:"
	@echo "    make up              Start all containers in background (api + studio)"
	@echo "    make docker-dev      Start containers in foreground (docker compose up)"
	@echo "    make docker-studio   Start Drizzle Studio in Docker (docker compose up studio)"
	@echo "    make build           Build or rebuild Docker images (docker compose build)"
	@echo "    make down            Stop and remove containers (docker compose down)"
	@echo "    make restart         Restart running containers (docker compose restart)"
	@echo "    make logs            Tail container logs in real time (docker compose logs -f)"
	@echo "    make ps              List running container status (docker compose ps)"
	@echo "    make shell           Open interactive shell inside api container"
	@echo "    make clean           Stop containers and remove volumes (wipes local D1 database)"
	@echo ""

# =============================================================================
# Local Development (Host with pnpm)
# =============================================================================

# Start local dev server
dev:
	pnpm dev

# Open Drizzle Studio for local D1 database
studio:
	pnpm run db:studio

# Run test suite
test:
	pnpm test

# Apply local D1 migrations
migrate-local:
	pnpm run migrate:local

# Seed admin user
create-admin:
	pnpm run db:create-admin

# =============================================================================
# Docker Compose Workflows
# =============================================================================

# Start services in the background (detached mode)
up:
	docker compose up -d

# Start services in the foreground with live logs (Ctrl+C to stop)
docker-dev:
	docker compose up

# Start Drizzle Studio in Docker
docker-studio:
	docker compose up studio

# Build or rebuild images
build:
	docker compose build

# Stop services
down:
	docker compose down

# Restart services
restart:
	docker compose restart

# Follow logs
logs:
	docker compose logs -f

# List container status
ps:
	docker compose ps

status: ps

# Open a shell in the running api container
sh:
	docker compose exec api sh

shell: sh

# Clean down with volume removal (removes SQLite data)
clean:
	docker compose down -v
