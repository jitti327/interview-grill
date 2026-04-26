export type Difficulty = 'easy' | 'medium' | 'hard';

// Shared reference content for seeds + backfill. Keep phrases short enough for candidate answers to
// naturally contain keywords (DB fallback uses token overlap + sub-phrases).

const STACK_DISPLAY: Record<string, string> = {
  angular: 'Angular',
  react: 'React',
  vue: 'Vue',
  ember: 'Ember',
  nodejs: 'Node.js',
  express: 'Express',
  nextjs: 'Next.js',
  python: 'Python',
  java: 'Java',
  dotnet: '.NET',
};

function displayStack(stack: string): string {
  return STACK_DISPLAY[stack.toLowerCase()] || stack;
}

/** Topic-specific ideas (1–2 sentences each) to seed the DB and help offline scoring. */
function topicConceptLines(stack: string, topic: string, questionType: 'conceptual' | 'coding' | 'scenario'): string[] {
  const s = stack.toLowerCase();
  const t = (topic || '').toLowerCase();

  const line = (a: string, b: string) => [a, b];

  if (s === 'react' && t.includes('hook')) {
    return line(
      'Hooks let function components use state and lifecycle: useState for local state, useEffect for side effects, and dependency arrays to control when effects run.',
      'Rules of Hooks: only call at top level, follow naming (use*), and prefer custom hooks to reuse stateful logic.',
    );
  }
  if (s === 'react' && t.includes('state')) {
    return line(
      'Compare local state vs lifted state vs global (Context/Redux): choose the smallest place that can own the data.',
      'Avoid unnecessary re-renders: memo, useCallback/useMemo, and stable keys for lists.',
    );
  }
  if (s === 'nodejs' && t.includes('event loop')) {
    return line(
      'The event loop runs JavaScript on one thread while I/O is delegated: timers, I/O callbacks, and microtasks (Promises) interleave in defined phases.',
      'For CPU-heavy work, use worker threads or move work off the main thread so you do not block the loop.',
    );
  }
  if (s === 'nodejs' && t.includes('stream')) {
    return line(
      'Streams process data in chunks (Readable/Writable/Transform), reducing memory vs loading full buffers.',
      'Backpressure: pause/resume to avoid overwhelming slow consumers; pipe() wires streams safely.',
    );
  }
  if (s === 'express' && t.includes('middleware')) {
    return line(
      'Middleware is a pipeline: each function receives (req, res, next) and can end the response or call next().',
      'Order matters: put auth, parsing, and logging before routes; centralize error handlers at the end.',
    );
  }
  if (s === 'nextjs' && (t.includes('ssr') || t.includes('ssg'))) {
    return line(
      'SSR sends HTML on each request (good for fresh data); SSG bakes pages at build time (fast CDN, good for static content).',
      'Use incremental regeneration or hybrid patterns when you need both freshness and performance.',
    );
  }
  if (s === 'python' && t.includes('async')) {
    return line(
      'asyncio runs coroutines on one thread with an event loop; await hands control at I/O boundaries.',
      'Use asyncio.gather for concurrency; watch blocking calls — offload them with run_in_executor.',
    );
  }
  if (s === 'java' && t.includes('jvm')) {
    return line(
      'The JVM provides GC, JIT compilation, and bytecode portability; tuning involves heap, GC algorithm, and profiling.',
      'Understand classloading and memory model when debugging performance or class leaks.',
    );
  }
  if (questionType === 'coding') {
    return line(
      `I would read the problem, identify inputs/outputs, handle edge cases (empty input, max size), and implement a clear ${displayStack(
        s,
      )} solution with deterministic behavior.`,
      'Then I would run several tests: a happy path, at least one edge case, and an invalid/empty case.',
    );
  }
  if (questionType === 'scenario') {
    return line(
      'I would triage: impact, blast radius, and rollback; communicate status and open an incident if needed.',
      'After mitigation, capture a short postmortem: root cause, action items, and how to detect earlier next time.',
    );
  }
  return line(
    `I would state how ${t || 'this topic'} fits into ${displayStack(s)} in real systems and name the main parts involved.`,
    'I would give one concrete example (API, pattern, or failure mode) and mention trade-offs and how I would test or observe it.',
  );
}

function difficultyNuance(d: Difficulty, questionType: 'conceptual' | 'coding' | 'scenario'): string {
  if (questionType === 'coding' && d === 'hard') {
    return 'For a hard coding question, I would discuss time/space complexity and consider an alternative approach if the first fails scale tests.';
  }
  if (d === 'easy') {
    return 'I would keep the explanation focused: define terms, one example, and one gotcha beginners hit.';
  }
  if (d === 'hard') {
    return 'I would go deeper on scale, failure modes, observability (metrics, logs, traces), and operational trade-offs.';
  }
  return 'I would connect the concept to a realistic team workflow: code review, tests, and how we would validate the behavior.';
}

export function buildExpectedKeyPoints(
  stack: string,
  topic: string,
  difficulty: Difficulty,
  questionType: 'conceptual' | 'coding' | 'scenario',
): string[] {
  const t = (topic || 'general').toLowerCase();
  const st = displayStack(stack);
  const s = stack.toLowerCase();

  const topicKeywords: string[] = [];
  if (s === 'react' && t.includes('hook')) {
    topicKeywords.push('useState', 'useEffect', 'rules of hooks', 'dependency');
  } else if (s === 'react' && t.includes('render')) {
    topicKeywords.push('re-render', 'memo', 'useMemo', 'useCallback');
  } else if (s === 'nodejs' && t.includes('event loop')) {
    topicKeywords.push('event loop', 'microtask', 'macrotask', 'libuv');
  } else if (s === 'nodejs' && t.includes('stream')) {
    topicKeywords.push('stream', 'backpressure', 'pipe', 'chunk');
  } else if (s === 'express' && t.includes('middleware')) {
    topicKeywords.push('middleware', 'next()', 'order', 'error handler');
  } else if (s === 'nextjs' && (t.includes('ssr') || t.includes('ssg') || t.includes('caching'))) {
    topicKeywords.push('SSR', 'SSG', 'cache', 'revalidation');
  } else {
    topicKeywords.push(t, st);
  }

  if (questionType === 'coding') {
    return [
      'edge cases and invalid input',
      'clear algorithm or structure',
      'test cases or dry run',
      'readability and naming',
      topicKeywords[0] || t,
    ].filter(Boolean) as string[];
  }
  if (questionType === 'scenario') {
    return [
      'impact and blast radius',
      'mitigation or rollback',
      'communication to stakeholders',
      'postmortem or follow-up actions',
    ];
  }
  if (difficulty === 'hard') {
    return [
      ...topicKeywords.slice(0, 3),
      'production trade-offs',
      'failure modes or observability',
    ].filter(Boolean) as string[];
  }
  return [
    ...topicKeywords.slice(0, 2),
    'concrete example',
    'why it matters in production',
  ].filter(Boolean) as string[];
}

export function buildReferenceSampleAnswer(
  stack: string,
  topic: string,
  difficulty: Difficulty,
  questionType: 'conceptual' | 'coding' | 'scenario',
): string[] {
  const st = displayStack(stack);
  const t = topic || 'this area';
  const [a, b] = topicConceptLines(stack, topic, questionType);
  const out = [
    `Opening: In ${st}, ${t} matters in production. I would start with a tight definition, then a concrete example.`,
    `Depth: ${a}`,
    `Depth: ${b}`,
    `Practice: I would add how I would validate the approach — tests, monitoring, or profiling — appropriate to the question.${difficultyNuance(
      difficulty,
      questionType,
    )}`,
  ];
  if (questionType === 'coding') {
    out.splice(1, 0, `Structure: For code, I would name inputs/outputs, handle edge cases first on paper, then implement and run cases including failure inputs.`);
  }
  return out;
}
