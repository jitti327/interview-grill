# DevGrill Backend

## Evaluation Modes

Use `EVAL_MODE` in `backend/.env` to control answer evaluation behavior.

- `ai_first` (recommended default): call Gemini first; if it fails (quota, key, or network), **automatically** score with the **DB reference model** so users always get feedback.
- `db_only`: always use the DB reference model (no AI calls; useful for outages or local dev).
- `ai_only`: Gemini only; if it fails, evaluation returns an error (no fallback).

Example:

```env
EVAL_MODE="ai_first"
```

## DB reference model (fallback)

When the AI path is skipped, scoring uses data stored on each `Question` row:

- **expected_key_points** and **sample_answer** (kept in sync by `POST /api/questions/seed` / `npm run seed-questions`)
- token overlap, partial phrase match, and answer length

Feedback text is tagged with `[evaluation_source: database_fallback]` so the UI can show **DB FALLBACK** vs **AI** when useful.
