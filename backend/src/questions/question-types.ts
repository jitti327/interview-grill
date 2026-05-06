import type { Difficulty } from './question-reference';

export type QuestionSeed = {
  id: string;
  stack: string;
  tech_stack: string;
  difficulty: Difficulty;
  question_type: 'conceptual' | 'coding' | 'scenario';
  category: string;
  topic: string;
  question: string;
  expected_key_points: string[];
  hint: string;
  coding_template?: string | null;
  coding_test_cases?: Array<{ label: string; input: string; expected_output: string }> | null;
  sample_answer?: string[];
  tags: string[];
  is_active: boolean;
};
