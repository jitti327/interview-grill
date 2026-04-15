# DevGrill AI - Interview Preparation Platform

## Problem Statement
AI-powered Interview Preparation Platform for developers with tech stack-based prep paths, AI interview engine (Gemini), grilling system, performance tracking & dashboard.

## Architecture
- **Backend**: FastAPI + MongoDB + Gemini AI (emergentintegrations)
- **Frontend**: React + Tailwind CSS + Shadcn UI + Framer Motion + Recharts
- **Database**: MongoDB (collections: sessions, rounds)
- **AI**: Gemini 2.5 Flash (with fallback to 2.5 Pro, 2.0 Flash)

## What's Been Implemented (Feb 2026)
- Landing page with dark brutalist design, hero section, category cards
- Interview setup page (category, tech stack, difficulty, question count)
- AI-powered interview room with terminal-style chat interface
- Real-time question generation and answer evaluation via Gemini
- Adaptive grilling system (beginner=gentle, intermediate=moderate, advanced=aggressive)
- Score tracking per question (0-10) with verdict system
- Feedback with strengths, weaknesses, follow-up grilling, improvement suggestions
- Performance dashboard with stats, skill radar chart, score trend chart
- Session history with tab filtering (all/completed/active)
- Retry logic with model fallback for AI reliability
- Responsive design with smooth animations

## Tech Stacks Supported
- Frontend: React, Angular, Vue, Ember
- Backend: Node.js, Java, .NET, Python
- Full Stack, System Design, DSA

## Prioritized Backlog
### P0 (Critical)
- All core features implemented and working

### P1 (High Priority)
- User authentication/profiles for persistent history
- Code editor integration for coding questions
- Session comparison view (side-by-side performance)

### P2 (Medium Priority)
- Spaced repetition for weak areas
- Leaderboard / competitive mode
- Export session as PDF report
- Timed interview mode
- Bookmarking difficult questions
