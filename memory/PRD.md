# DevGrill AI - Interview Preparation Platform

## Architecture
- **Backend**: NestJS (TypeScript) — Modules/Services/Controllers
- **Frontend**: React + Tailwind + Shadcn UI + Framer Motion + Recharts
- **Database**: MongoDB via @nestjs/mongoose
- **AI**: Gemini via @google/generative-ai (2.5-flash/pro/2.0-flash fallback)
- **Auth**: JWT httpOnly cookies via @nestjs/jwt
- **Docs**: Swagger/OpenAPI at /api/docs

## All Implemented Features
- NestJS backend with clean module architecture
- JWT Auth (register/login/logout/me/refresh) + admin seeding
- AI Interview Engine (dynamic question generation, answer eval, grilling)
- Adaptive difficulty (beginner=guided, intermediate=moderate, advanced=aggressive)
- Monaco Code Editor with smart language detection per tech stack
- Timed interview mode with countdown + auto-submit on time-up
- Performance Dashboard (radar chart, score trends, weak topics bar chart)
- Session Comparison view (side-by-side)
- Leaderboard / Rankings (user rankings by avg score)
- AI Coach Study Plan (AI-generated weekly study plan from weak areas)
- Question Bookmarks
- Shareable Session Report with print/PDF support
- Swagger/OpenAPI documentation
- Dark brutalist UI (Outfit + JetBrains Mono, yellow accents)

## Build Commands
- Backend build: cd /app/backend && npx nest build
- Backend restart: sudo supervisorctl restart backend
