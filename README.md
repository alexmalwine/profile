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

## Customizing content
- Update placeholder text in `frontend/src/App.jsx`.
- Edit metadata in `frontend/index.html`.
- Adjust styles in `frontend/src/index.css`.
- Add a resume at `frontend/public/resume.pdf` if you want Resume links to work.

## API
- `GET /api/health` returns a basic health payload.
- `POST /api/games/unemploydle/start` accepts a resume upload (multipart form).
- `POST /api/games/unemploydle/jobs` returns top 10 job matches.
- `POST /api/games/unemploydle/guess` accepts `{ gameId, letter }`.
- `GET /api/tools/resume-formatter/formats` returns available formats.
- `POST /api/tools/resume-formatter/format` formats a resume upload.

## Games
The Unemploydle game lets a user upload a resume and play a hangman-style round
to reveal a company name for a curated job opening. Job sourcing and LLM
ranking are currently mocked with sample data in
`backend/src/games/unemploydle.service.ts`.

## Tools
The Resume Formatter accepts a resume upload and generates multiple downloadable
formats using simple templates in
`backend/src/tools/resume-formatter.service.ts`.

## Structure
- `frontend/`: React application (Vite).
- `backend/`: NestJS API.
- `AGENTS.md`: Guidance for AI agents working in this repository.
