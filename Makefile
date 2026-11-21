.PHONY: help build up down restart logs ps status sh shell migrate create-admin test clean

# Default target: display help
help:
	@echo "Available commands for api.pphat.me Docker Compose:"
	@echo ""
	@echo "  make build         Build or rebuild Docker Compose images"
	@echo "  make up            Start containers in detached mode"
	@echo "  make down          Stop and remove containers"
	@echo "  make restart       Restart running containers"
	@echo "  make logs          Tail container logs in real time"
	@echo "  make ps            List running container status"
	@echo "  make shell         Open an interactive shell inside the api container"
	@echo "  make migrate       Run local D1 migrations inside the container"
	@echo "  make create-admin  Run admin creation script inside the container"
	@echo "  make test          Run the test suite inside the container"
	@echo "  make clean         Stop containers and remove volumes (wipes local D1 database)"
	@echo ""

# Build or rebuild images
build:
	docker compose build

# Start services in the background
up:
	docker compose up -d

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

# Run local D1 migrations in the container
migrate:
	docker compose exec api npx wrangler d1 migrations apply api --local -y

# Run admin initialization inside the container
create-admin:
	docker compose exec api node scripts/create-admin.js

# Run test suite inside the container
test:
	docker compose exec api npm test

# Clean down with volume removal (removes SQLite data)
clean:
	docker compose down -v
