-- AlterTable
ALTER TABLE "Question"
ADD COLUMN "coding_template" TEXT,
ADD COLUMN "coding_test_cases" JSONB;

-- AlterTable
ALTER TABLE "Round"
ADD COLUMN "coding_template" TEXT,
ADD COLUMN "coding_test_cases" JSONB;
