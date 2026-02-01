# AGENTS.md

Guidance for AI agents working in this repository.

## Repository overview
- Purpose: Personal site focused on getting hired as a software engineer.
- Frontend: React (Vite) in `frontend/`.
- Backend: NestJS API in `backend/`.
- Primary docs: README.md.

## Setup
- Backend: `cd backend && npm install && npm run start:dev`
- Frontend: `cd frontend && npm install && npm run dev`
- The frontend proxies `/api` to `http://localhost:3000`.

## Development workflow
- Keep changes small and focused.
- Prefer clear, descriptive commit messages.
- Run any available tests and linters before committing.

## Testing
- Frontend: `npm run lint` (from `frontend/`).
- Backend: `npm run test` or `npm run test:e2e` (from `backend/`).

## Notes for agents
- Avoid inventing commands. If new tooling is added, document it here.
- The Unemploydle game uses mocked job data and ranking in
  `backend/src/games/unemploydle.service.ts`. Replace with real integrations
  when available.
