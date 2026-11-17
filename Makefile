.PHONY: up migrate seed dev check test rls
up:        ## start local Postgres
	docker compose up -d db
migrate:   ## apply database migrations
	npm run migrate
seed:      ## load synthetic demo data
	npm run seed
dev:       ## run the API with reload
	npm run dev
test:      ## unit + integration tests (needs Postgres)
	npm test
rls:       ## row-level security tests
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/test/rls_test.sql
check:     ## everything CI runs
	npm run typecheck && npm test
