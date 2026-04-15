# DevGrill AI - Interview Preparation Platform

## Problem Statement
AI-powered Interview Preparation Platform for developers with tech stack-based prep, AI interview engine, grilling system, performance tracking & dashboard.

## Architecture (Updated Feb 2026)
- **Backend**: NestJS (TypeScript) — Migrated from Python/FastAPI
  - Modules: Auth, Interview, Dashboard, Bookmarks, AI
  - Services + Controllers pattern per NestJS best practices
  - Port 8001, /api global prefix
- **Frontend**: React + Tailwind CSS + Shadcn UI + Framer Motion + Recharts
- **Database**: MongoDB via @nestjs/mongoose (collections: users, sessions, rounds, bookmarks)
- **AI**: Gemini via @google/generative-ai (2.5-flash → 2.5-pro → 2.0-flash fallback)
- **Auth**: JWT httpOnly cookies via @nestjs/jwt

## What's Been Implemented
- NestJS backend with clean module architecture
- JWT auth (register/login/logout/me/refresh) with admin seeding
- AI interview engine with dynamic question generation
- Adaptive grilling (beginner/intermediate/advanced)
- Monaco code editor for coding questions
- Timed interview mode with countdown timer
- Performance dashboard (radar, trends, weak topics)
- Session comparison view
- Question bookmarks
- Shareable session report with print/PDF support
- Dark brutalist UI (Outfit + JetBrains Mono fonts)

## Prioritized Backlog
### P1
- Code editor language detection per tech stack
- Spaced repetition for weak areas
- Leaderboard / competitive mode

### P2
- Export report as styled PDF
- Timed mode auto-submit on time-up
- WebSocket for real-time AI streaming
