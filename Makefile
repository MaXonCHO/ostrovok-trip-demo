.PHONY: up down logs check seed
up:
	docker compose up --build
down:
	docker compose down
logs:
	docker compose logs -f app
check:
	npm run typecheck
	npm run lint
	npm test
seed:
	npx tsx scripts/seed.ts
