import { buildExpectedKeyPoints, buildReferenceSampleAnswer, type Difficulty } from './question-reference';
import { buildJavaScriptInterviewCoreSeeds } from './javascript-interview-core-seeds';
import type { QuestionSeed } from './question-types';

export type { Difficulty } from './question-reference';
export type { QuestionSeed } from './question-types';

const STACK_TOPICS: Record<string, string[]> = {
  angular: ['change detection', 'dependency injection', 'rxjs', 'routing', 'forms', 'performance'],
  react: ['hooks', 'state management', 'render optimization', 'testing', 'accessibility', 'concurrency'],
  vue: ['reactivity', 'composition api', 'state management', 'routing', 'performance', 'testing'],
  ember: ['data layer', 'routing', 'services', 'components', 'testing', 'performance'],
  nodejs: ['event loop', 'streams', 'async patterns', 'security', 'scaling', 'error handling'],
  express: ['middleware', 'routing', 'validation', 'security', 'error handling', 'performance'],
  nextjs: ['ssr', 'ssg', 'api routes', 'caching', 'routing', 'optimization'],
  python: ['data structures', 'asyncio', 'testing', 'packaging', 'performance', 'web patterns'],
  java: ['collections', 'jvm', 'concurrency', 'spring', 'testing', 'performance'],
  dotnet: ['aspnet', 'dependency injection', 'linq', 'async', 'testing', 'performance'],
  javascript: [
    'lexical scope & closures',
    'this & functions',
    'async patterns',
    'prototypes & objects',
    'events & DOM',
    'modules & tooling',
  ],
};

const STEMS: Record<Difficulty, string[]> = {
  easy: [
    'Explain the core concept of {topic} in {stack} and give a small example.',
    'What common mistakes do beginners make with {topic} in {stack}?',
    'How would you debug a simple issue related to {topic} in a {stack} app?',
  ],
  medium: [
    'Design a production-ready approach for {topic} in {stack} with trade-offs.',
    'Given frequent regressions around {topic}, how would you improve reliability in {stack}?',
    'How would you test and monitor {topic} in a medium-scale {stack} service?',
  ],
  hard: [
    'You are seeing latency spikes under load. How would you redesign {topic} in {stack}?',
    'Propose an architecture-level strategy for {topic} in a multi-team {stack} codebase.',
    'What are the hardest edge cases for {topic} in {stack}, and how would you mitigate them?',
  ],
};

const QUESTION_TYPES: Array<'conceptual' | 'coding' | 'scenario'> = ['conceptual', 'coding', 'scenario'];

function titleCase(value: string): string {
  if (value.toLowerCase() === 'javascript') return 'JavaScript';
  return value
    .split(/[\s-]+/)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(' ');
}

function codingTemplateForStack(stack: string, topic: string): string {
  const banner = `// Stack: ${stack}\n// Topic: ${topic}\n`;
  if (stack === 'python') {
    return `# Stack: ${stack}\n# Topic: ${topic}
def solve(input_text: str) -> str:
    # TODO: implement
    return input_text.strip()

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))`;
  }
  if (stack === 'java') {
    return `${banner}import java.io.*;
public class Main {
    static String solve(String input) {
        // TODO: implement
        return input.trim();
    }
    public static void main(String[] args) throws Exception {
        String input = new String(System.in.readAllBytes());
        System.out.print(solve(input));
    }
}`;
  }
  if (stack === 'dotnet') {
    return `${banner}using System;
public class Program {
    static string Solve(string input) {
        // TODO: implement
        return input.Trim();
    }
    public static void Main() {
        Console.Write(Solve(Console.In.ReadToEnd()));
    }
}`;
  }
  if (stack === 'angular') {
    return `${banner}import * as fs from "fs";
function solve(input: string): string {
  // TODO: implement
  return input.trim();
}
console.log(solve(fs.readFileSync(0, "utf8")));`;
  }
  return `${banner}const fs = require("fs");
function solve(input) {
  // TODO: implement
  return input.trim();
}
process.stdout.write(String(solve(fs.readFileSync(0, "utf8"))));`;
}

function codingTestCasesForTopic(topic: string) {
  const normalizedTopic = (topic || '').toLowerCase();
  if (normalizedTopic.includes('sort')) {
    return [
      { label: 'Case 1', input: '3 1 2\n', expected_output: '1 2 3' },
      { label: 'Case 2', input: '10 5 7 1\n', expected_output: '1 5 7 10' },
    ];
  }
  if (normalizedTopic.includes('string')) {
    return [
      { label: 'Case 1', input: 'hello\n', expected_output: 'hello' },
      { label: 'Case 2', input: 'Interview Grill\n', expected_output: 'Interview Grill' },
    ];
  }
  return [
    { label: 'Case 1', input: 'sample input\n', expected_output: 'sample input' },
    { label: 'Case 2', input: 'another sample\n', expected_output: 'another sample' },
  ];
}

export function buildQuestionBank(): QuestionSeed[] {
  const stacks = Object.keys(STACK_TOPICS);
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
  const result: QuestionSeed[] = [];

  for (const stack of stacks) {
    const topics = STACK_TOPICS[stack];
    for (const difficulty of difficulties) {
      const stems = STEMS[difficulty];
      for (let i = 0; i < 36; i += 1) {
        const topic = topics[i % topics.length];
        const stem = stems[i % stems.length];
        const question = stem
          .replaceAll('{topic}', topic)
          .replaceAll('{stack}', titleCase(stack));
        const questionType = QUESTION_TYPES[i % QUESTION_TYPES.length];
        const isCoding = questionType === 'coding';
        result.push({
          id: `v2-${stack}-${difficulty}-${i + 1}`,
          stack,
          tech_stack: stack,
          difficulty,
          question_type: questionType,
          category: topic,
          topic,
          question,
          expected_key_points: buildExpectedKeyPoints(stack, topic, difficulty, questionType),
          hint: `Focus on practical ${stack} patterns and measurable outcomes for ${topic}.`,
          coding_template: isCoding ? codingTemplateForStack(stack, topic) : null,
          coding_test_cases: isCoding ? codingTestCasesForTopic(topic) : null,
          sample_answer: buildReferenceSampleAnswer(stack, topic, difficulty, questionType),
          tags: [stack, difficulty, topic, questionType],
          is_active: true,
        });
      }
    }
  }

  result.push(...buildJavaScriptInterviewCoreSeeds());

  return result;
}
