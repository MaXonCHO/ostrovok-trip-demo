.PHONY: up down logs check
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
