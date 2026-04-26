# PostgreSQL Database Access Steps

## 1) Start PostgreSQL (Docker)

```bash
docker compose up -d postgres
```

## 2) Verify the container is healthy

```bash
docker compose ps
```

## 3) Connect with `psql` from host

```bash
psql "postgresql://devgrill:devgrill@localhost:5433/devgrill"
```

## 4) Useful SQL commands

```sql
\dt
SELECT COUNT(*) FROM "Question";
SELECT stack, difficulty, COUNT(*) FROM "Question" GROUP BY stack, difficulty ORDER BY stack, difficulty;
SELECT id, email, role, created_at FROM "User" ORDER BY created_at DESC LIMIT 20;
SELECT id, tech_stack, difficulty, avg_score, status, created_at FROM "Session" ORDER BY created_at DESC LIMIT 20;
```

## 5) Seed questions into PostgreSQL

```bash
cd backend
npm run seed-questions
```

## 6) Optional Prisma Studio

```bash
cd backend
npm run prisma:studio
```

Open the local URL printed in terminal.
