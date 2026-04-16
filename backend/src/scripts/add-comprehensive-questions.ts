import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QuestionsService } from '../questions/questions.service';
import { v4 as uuidv4 } from 'uuid';

async function addComprehensiveQuestions() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const questionsService = app.get(QuestionsService);

  const comprehensiveQuestions = [
    // JavaScript - More Beginner Questions
    {
      id: uuidv4(),
      tech_stack: 'javascript',
      difficulty: 'beginner',
      question_type: 'conceptual',
      category: 'operators',
      topic: 'comparison',
      question: 'What is the difference between == and === in JavaScript?',
      expected_key_points: [
        '== does type coercion',
        '=== checks strict equality',
        '=== compares both value and type',
        '== can lead to unexpected results'
      ],
      hint: 'Think about type conversion',
      sample_answer: [
        '== performs type coercion before comparison',
        '=== checks strict equality without type coercion',
        'Use === for safer comparisons'
      ],
      tags: ['operators', 'equality', 'type-coercion'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'javascript',
      difficulty: 'beginner',
      question_type: 'coding',
      category: 'functions',
      topic: 'arrow-functions',
      question: 'Convert this function to arrow function: function add(a, b) { return a + b; }',
      expected_key_points: [
        'Arrow function syntax',
        'Implicit return for single expressions',
        'No function keyword needed',
        'No this binding in arrow functions'
      ],
      hint: 'Use => syntax and remove return keyword',
      sample_answer: [
        'const add = (a, b) => a + b;',
        'Or even shorter: const add = (a, b) => a + b'
      ],
      tags: ['arrow-functions', 'es6', 'functions'],
      is_active: true
    },

    // JavaScript - More Intermediate Questions
    {
      id: uuidv4(),
      tech_stack: 'javascript',
      difficulty: 'intermediate',
      question_type: 'conceptual',
      category: 'scope',
      topic: 'closures',
      question: 'Explain closures in JavaScript with a practical example',
      expected_key_points: [
        'Function remembers outer scope',
        'Private variables simulation',
        'Memory management implications',
        'Common use cases'
      ],
      hint: 'Think about functions returning functions',
      sample_answer: [
        'function createCounter() {',
        '  let count = 0;',
        '  return function() { return ++count; };',
        '}',
        'const counter = createCounter();',
        'console.log(counter()); // 1'
      ],
      tags: ['closures', 'scope', 'functions'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'javascript',
      difficulty: 'intermediate',
      question_type: 'coding',
      category: 'arrays',
      topic: 'methods',
      question: 'Implement a function that removes duplicates from an array without using Set',
      expected_key_points: [
        'Array iteration and filtering',
        'Index checking or includes usage',
        'Creating new array with unique values',
        'Time complexity considerations'
      ],
      hint: 'Use filter() and indexOf() or includes()',
      sample_answer: [
        'function removeDuplicates(arr) {',
        '  return arr.filter((item, index) => arr.indexOf(item) === index);',
        '}'
      ],
      tags: ['arrays', 'methods', 'algorithms'],
      is_active: true
    },

    // JavaScript - More Advanced Questions
    {
      id: uuidv4(),
      tech_stack: 'javascript',
      difficulty: 'advanced',
      question_type: 'conceptual',
      category: 'prototypes',
      topic: 'inheritance',
      question: 'Explain prototypal inheritance vs classical inheritance',
      expected_key_points: [
        'Prototype chain lookup',
        'Object.create() vs new keyword',
        'Constructor functions',
        'ES6 classes as syntactic sugar',
        'Performance implications'
      ],
      hint: 'Think about how JavaScript objects inherit properties',
      sample_answer: [
        'Prototypal inheritance uses prototype chain for property lookup',
        'Classical inheritance uses class-based inheritance',
        'ES6 classes are syntactic sugar over prototypes',
        'Object.create() sets up prototype chain directly'
      ],
      tags: ['prototypes', 'inheritance', 'oop'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'javascript',
      difficulty: 'advanced',
      question_type: 'coding',
      category: 'async',
      topic: 'patterns',
      question: 'Implement a function that limits concurrent promises to a maximum number',
      expected_key_points: [
        'Promise management',
        'Concurrency control',
        'Queue implementation',
        'Error handling',
        'Resource management'
      ],
      hint: 'Use a queue and track running promises',
      sample_answer: [
        'async function limitConcurrency(tasks, limit) {',
        '  const results = [];',
        '  const executing = [];',
        '  for (const task of tasks) {',
        '    const promise = task();',
        '    results.push(promise);',
        '    if (executing.length >= limit) {',
        '      await Promise.race(executing);',
        '    }',
        '    executing.push(promise);',
        '  }',
        '  return Promise.all(results);',
        '}'
      ],
      tags: ['promises', 'concurrency', 'async'],
      is_active: true
    },

    // React - More Beginner Questions
    {
      id: uuidv4(),
      tech_stack: 'react',
      difficulty: 'beginner',
      question_type: 'conceptual',
      category: 'components',
      topic: 'lifecycle',
      question: 'What happens during component mounting in React?',
      expected_key_points: [
        'Component creation',
        'DOM insertion',
        'useEffect with empty dependency array',
        'Component lifecycle order',
        'Side effects execution'
      ],
      hint: 'Think about when component first appears on screen',
      sample_answer: [
        'React creates component instance',
        'Component renders to virtual DOM',
        'Real DOM is updated',
        'useEffect with [] runs after mount',
        'Side effects can be executed safely'
      ],
      tags: ['lifecycle', 'mounting', 'useEffect'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'react',
      difficulty: 'beginner',
      question_type: 'coding',
      category: 'components',
      topic: 'conditional-rendering',
      question: 'Create a component that shows "Loading..." when isLoading is true, otherwise shows children',
      expected_key_points: [
        'Conditional rendering with ternary operator',
        'Props usage',
        'Component composition',
        'Boolean prop handling'
      ],
      hint: 'Use ternary operator or logical AND operator',
      sample_answer: [
        'function LoadingWrapper({ isLoading, children }) {',
        '  return isLoading ? <div>Loading...</div> : children;',
        '}'
      ],
      tags: ['conditional-rendering', 'props', 'components'],
      is_active: true
    },

    // React - More Intermediate Questions
    {
      id: uuidv4(),
      tech_stack: 'react',
      difficulty: 'intermediate',
      question_type: 'conceptual',
      category: 'performance',
      topic: 're-renders',
      question: 'What causes unnecessary re-renders in React and how to prevent them?',
      expected_key_points: [
        'Object/array prop recreation',
        'Inline function definitions',
        'Missing dependencies in useEffect',
        'React.memo and useCallback usage',
        'Component composition patterns'
      ],
      hint: 'Think about reference equality and dependency arrays',
      sample_answer: [
        'New object/array props on each render cause re-renders',
        'Inline functions create new references each render',
        'Use React.memo to prevent prop-based re-renders',
        'Use useCallback to memoize event handlers',
        'Add all dependencies to useEffect array'
      ],
      tags: ['performance', 're-renders', 'optimization'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'react',
      difficulty: 'intermediate',
      question_type: 'coding',
      category: 'hooks',
      topic: 'useContext',
      question: 'Create a theme context and a component that uses it',
      expected_key_points: [
        'Context creation with createContext',
        'Provider component setup',
        'useContext hook usage',
        'Value consumption',
        'Default values'
      ],
      hint: 'Use createContext and useContext hooks',
      sample_answer: [
        'const ThemeContext = createContext("light");',
        'function ThemeProvider({ children, theme }) {',
        '  return (',
        '    <ThemeContext.Provider value={theme}>',
        '      {children}',
        '    </ThemeContext.Provider>',
        '  );',
        '}',
        'function useTheme() {',
        '  return useContext(ThemeContext);',
        '}'
      ],
      tags: ['context', 'useContext', 'global-state'],
      is_active: true
    },

    // React - More Advanced Questions
    {
      id: uuidv4(),
      tech_stack: 'react',
      difficulty: 'advanced',
      question_type: 'conceptual',
      category: 'architecture',
      topic: 'state-management',
      question: 'Compare different state management approaches in React applications',
      expected_key_points: [
        'Local component state',
        'Context API limitations',
        'External libraries (Redux, Zustand)',
        'Server state management',
        'Performance and scalability considerations'
      ],
      hint: 'Think about when to use different state solutions',
      sample_answer: [
        'Local state: Simple, component-specific data',
        'Context API: Good for medium complexity, global theme/user',
        'Redux: Complex state, dev tools, middleware',
        'Zustand: Lightweight alternative to Redux',
        'Server state: React Query, SWR for caching'
      ],
      tags: ['state-management', 'architecture', 'scalability'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'react',
      difficulty: 'advanced',
      question_type: 'coding',
      category: 'advanced-hooks',
      topic: 'custom-hooks',
      question: 'Create a useDebounce hook that delays function execution',
      expected_key_points: [
        'useRef for timer reference',
        'useEffect for setup/cleanup',
        'Debounce logic implementation',
        'Dependency array management',
        'Function stability'
      ],
      hint: 'Use setTimeout and clearTimeout in useEffect',
      sample_answer: [
        'function useDebounce(callback, delay) {',
        '  const timeoutRef = useRef();',
        '  useEffect(() => {',
        '    return () => clearTimeout(timeoutRef.current);',
        '  }, []);',
        '  return useCallback((...args) => {',
        '    clearTimeout(timeoutRef.current);',
        '    timeoutRef.current = setTimeout(() => callback(...args), delay);',
        '  }, [callback, delay]);',
        '}'
      ],
      tags: ['custom-hooks', 'performance', 'debounce'],
      is_active: true
    },

    // Node.js Questions
    {
      id: uuidv4(),
      tech_stack: 'nodejs',
      difficulty: 'beginner',
      question_type: 'conceptual',
      category: 'fundamentals',
      topic: 'event-loop',
      question: 'What is the Node.js event loop?',
      expected_key_points: [
        'Single-threaded nature',
        'Non-blocking I/O',
        'Call stack and task queue',
        'Microtasks vs macrotasks',
        'Phases of event loop'
      ],
      hint: 'Think about how Node handles asynchronous operations',
      sample_answer: [
        'Event loop enables non-blocking I/O in single-threaded Node',
        'Processes tasks from call stack, then task queue',
        'Microtasks (promises) have priority over macrotasks',
        'Phases: timers, I/O callbacks, poll, check, close callbacks'
      ],
      tags: ['event-loop', 'async', 'fundamentals'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'nodejs',
      difficulty: 'intermediate',
      question_type: 'coding',
      category: 'streams',
      topic: 'file-operations',
      question: 'Write a Node.js script that reads a large file line by line using streams',
      expected_key_points: [
        'fs.createReadStream usage',
        'Readable stream events',
        'Line-by-line processing',
        'Memory efficiency',
        'Error handling'
      ],
      hint: 'Use readline module with streams',
      sample_answer: [
        'const fs = require("fs");',
        'const readline = require("readline");',
        'const readInterface = readline.createInterface({',
        '  input: fs.createReadStream("large-file.txt"),',
        '});',
        'readInterface.on("line", (line) => {',
        '  console.log("Line:", line);',
        '});'
      ],
      tags: ['streams', 'file-system', 'performance'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'nodejs',
      difficulty: 'advanced',
      question_type: 'scenario',
      category: 'architecture',
      topic: 'scalability',
      question: 'How would you design a scalable Node.js API for handling 10,000 concurrent requests?',
      expected_key_points: [
        'Cluster mode utilization',
        'Load balancing strategies',
        'Connection pooling',
        'Caching layers',
        'Monitoring and metrics',
        'Graceful degradation'
      ],
      hint: 'Think about horizontal scaling and resource management',
      sample_answer: [
        'Use Node.js cluster to utilize all CPU cores',
        'Implement reverse proxy (nginx) for load balancing',
        'Use connection pooling for database connections',
        'Add Redis caching layer for frequently accessed data',
        'Implement rate limiting and circuit breakers',
        'Monitor with PM2 and add health checks'
      ],
      tags: ['scalability', 'architecture', 'performance'],
      is_active: true
    },

    // Python Questions
    {
      id: uuidv4(),
      tech_stack: 'python',
      difficulty: 'beginner',
      question_type: 'conceptual',
      category: 'basics',
      topic: 'data-types',
      question: 'What are the main built-in data types in Python?',
      expected_key_points: [
        'Immutable types: int, float, str, bool, tuple',
        'Mutable types: list, dict, set',
        'Type checking with isinstance()',
        'Dynamic typing nature',
        'None type for absence of value'
      ],
      hint: 'Think about mutable vs immutable types',
      sample_answer: [
        'Immutable: int, float, str, bool, tuple, frozenset',
        'Mutable: list, dict, set, bytearray',
        'Use isinstance() for type checking',
        'None represents absence of value'
      ],
      tags: ['data-types', 'basics', 'typing'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'python',
      difficulty: 'intermediate',
      question_type: 'coding',
      category: 'functions',
      topic: 'decorators',
      question: 'Create a simple timer decorator that measures function execution time',
      expected_key_points: [
        'Decorator syntax and structure',
        'Wrapper function implementation',
        'Time measurement using time module',
        'Preserving function metadata',
        'Returning original function result'
      ],
      hint: 'Use @ syntax and wrapper function',
      sample_answer: [
        'import time',
        'def timer(func):',
        '  def wrapper(*args, **kwargs):',
        '    start = time.time()',
        '    result = func(*args, **kwargs)',
        '    end = time.time()',
        '    print(f"{func.__name__} took {end-start:.2f}s")',
        '    return result',
        '  return wrapper',
        '@timer',
        'def slow_function():',
        '  time.sleep(1)',
        '  return "Done"'
      ],
      tags: ['decorators', 'functions', 'performance'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'python',
      difficulty: 'advanced',
      question_type: 'scenario',
      category: 'concurrency',
      topic: 'async-programming',
      question: 'Design a system to process multiple API requests concurrently with rate limiting',
      expected_key_points: [
        'asyncio event loop',
        'Semaphore for rate limiting',
        'Concurrent request handling',
        'Error handling and retries',
        'Result aggregation'
      ],
      hint: 'Think about asyncio.Semaphore and gather',
      sample_answer: [
        'import asyncio, aiohttp',
        'async def fetch_with_semaphore(semaphore, url):',
        '  async with semaphore:',
        '    async with aiohttp.ClientSession() as session:',
        '      async with session.get(url) as response:',
        '        return await response.json()',
        'async def process_urls(urls, max_concurrent=5):',
        '  semaphore = asyncio.Semaphore(max_concurrent)',
        '  tasks = [fetch_with_semaphore(semaphore, url) for url in urls]',
        '  return await asyncio.gather(*tasks)'
      ],
      tags: ['asyncio', 'concurrency', 'rate-limiting'],
      is_active: true
    }
  ];

  try {
    console.log('Adding comprehensive questions...');
    for (const question of comprehensiveQuestions) {
      await questionsService.createQuestion(question);
    }
    console.log(`Successfully added ${comprehensiveQuestions.length} comprehensive questions`);
  } catch (error) {
    console.error('Error adding questions:', error);
  } finally {
    await app.close();
  }
}

addComprehensiveQuestions();
