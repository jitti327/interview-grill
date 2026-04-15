# DevGrill AI - Interview Preparation Platform

## Architecture
- **Backend**: NestJS (TypeScript) — Modules/Services/Controllers
- **Frontend**: React + Tailwind + Shadcn UI + Framer Motion + Recharts + Monaco Editor
- **Database**: MongoDB via @nestjs/mongoose (users, sessions, rounds, bookmarks, notifications)
- **AI**: Gemini via @google/generative-ai (2.5-flash/pro/2.0-flash fallback + retry)
- **Auth**: JWT httpOnly cookies via @nestjs/jwt
- **Docs**: Swagger/OpenAPI at /api/docs

## All Implemented Features
- NestJS backend (Modules: Auth, Interview, Dashboard, Bookmarks, Notifications, AI)
- JWT Auth (register/login/logout/me/refresh) + admin seeding
- AI Interview Engine (dynamic question generation, answer evaluation, adaptive grilling)
- SSE Streaming for real-time AI evaluation feedback (typing animation)
- Monaco Code Editor with smart language detection (Python/Java/C#/TypeScript/JS)
- Timed interview mode with countdown + auto-submit on time-up
- Performance Dashboard (radar chart, score trends, weak topics bar chart)
- Session Comparison view (side-by-side)
- Leaderboard / Rankings (user rankings by avg score)
- AI Coach Study Plan (AI-generated weekly plan from weak areas)
- In-App Notification System (bell icon, unread count, weekly summaries, achievements)
- Question Bookmarks
- Shareable Session Report with print/PDF support
- Swagger/OpenAPI documentation
- Dark brutalist UI (Outfit + JetBrains Mono, yellow accents on void black)

## All API Endpoints (25+)
Auth: register, login, logout, me, refresh
Sessions: create, list, get, complete
Interview: question, evaluate, evaluate-stream (SSE)
Dashboard: overview, skill-radar, trend, category-stats, weak-topics
Leaderboard, Coach/Study-Plan, Comparison
Bookmarks: create, list, delete
Notifications: list, count, mark-read, mark-all-read, weekly-summary
