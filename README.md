# profile
Personal website focused on getting hired as a software engineer.

## Overview
This repository now contains a modern React frontend and a NestJS backend. The
site is designed to showcase your experience, projects, and impact while making
it easy for hiring teams to contact you.

## Getting started
### Backend (NestJS)
```bash
cd backend
npm install
npm run start:dev
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to `http://localhost:3000`.

## Docker
Build and run the full stack (frontend assets served by NestJS):
```bash
docker build -t profile-app .
docker run --rm -p 3000:3000 \
  -e OPENAI_API_KEY=your_key \
  -e SERPAPI_API_KEY=your_key \
  profile-app
```

## Customizing content
- Update placeholder text in `frontend/src/App.jsx`.
- Edit metadata in `frontend/index.html`.
- Adjust styles in `frontend/src/index.css`.
- Add a resume at `frontend/public/resume.pdf` if you want Resume links to work.

## API
- `GET /api/health` returns a basic health payload.
- `POST /api/games/unemployedle/start` accepts a resume upload (multipart form).
- `POST /api/games/unemployedle/jobs` returns top 10 job matches.
- `POST /api/games/unemployedle/guess` accepts `{ gameId, letter }`.
- `GET /api/tools/resume-formatter/formats` returns available formats.
- `POST /api/tools/resume-formatter/format` formats a resume upload.

### Required environment variables
- `OPENAI_API_KEY`: used to rank verified job results.
- `SERPAPI_API_KEY`: used to search job boards and company career sites.

### Optional Cursor orchestrator integration
When enabled, backend error logs are sent to a cursor-orchestrator webhook to
create a Cursor agent with repository context.
- `CURSOR_ORCHESTRATOR_ENABLED`: set to `true` to enable the integration.
- `CURSOR_ORCHESTRATOR_WEBHOOK_URL`: webhook endpoint for cursor-orchestrator.
- `CURSOR_ORCHESTRATOR_TOKEN`: optional bearer token for the webhook.
- `CURSOR_ORCHESTRATOR_REPO_URL`: override the repository URL in payloads.
- `CURSOR_ORCHESTRATOR_REPO_REF`: override the branch or commit ref.
- `CURSOR_ORCHESTRATOR_SERVICE`: override the service name (defaults to backend).
- `CURSOR_ORCHESTRATOR_ENVIRONMENT`: override the environment (defaults to NODE_ENV).

## Games
The Unemployedle game lets a user upload a resume and play a hangman-style round
to reveal a company name for a curated job opening. Job sourcing and LLM
ranking are powered by ChatGPT in
`backend/src/games/unemployedle.service.ts`.

## Tools
The Resume Formatter accepts a resume upload and generates multiple downloadable
formats using simple templates in
`backend/src/tools/resume-formatter.service.ts`.

## Structure
- `frontend/`: React application (Vite).
- `backend/`: NestJS API.
- `AGENTS.md`: Guidance for AI agents working in this repository.
