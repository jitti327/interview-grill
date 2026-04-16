import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QuestionsService } from '../questions/questions.service';
import { v4 as uuidv4 } from 'uuid';

async function addMoreQuestions() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const questionsService = app.get(QuestionsService);

  const additionalQuestions = [
    // More JavaScript Questions
    {
      id: uuidv4(),
      tech_stack: 'javascript',
      difficulty: 'beginner',
      question_type: 'conceptual',
      category: 'arrays',
      topic: 'methods',
      question: 'What is the difference between map() and forEach() in JavaScript arrays?',
      expected_key_points: [
        'map() returns a new array',
        'forEach() returns undefined',
        'map() is chainable',
        'forEach() is for side effects',
        'map() transforms elements'
      ],
      hint: 'Think about return values and chaining',
      sample_answer: [
        'map() returns a new transformed array and can be chained',
        'forEach() executes a function for each element but returns undefined',
        'Use map() when you need a new array, forEach() for side effects'
      ],
      tags: ['arrays', 'methods', 'functional'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'javascript',
      difficulty: 'beginner',
      question_type: 'coding',
      category: 'loops',
      topic: 'iteration',
      question: 'Write a function that sums all numbers in an array using a for loop.',
      expected_key_points: [
        'For loop syntax',
        'Array iteration',
        'Accumulator variable',
        'Return statement'
      ],
      hint: 'Use a variable to keep track of the running total',
      sample_answer: [
        'function sumArray(arr) {',
        '  let sum = 0;',
        '  for (let i = 0; i < arr.length; i++) {',
        '    sum += arr[i];',
        '  }',
        '  return sum;',
        '}'
      ],
      tags: ['loops', 'arrays', 'iteration'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'javascript',
      difficulty: 'intermediate',
      question_type: 'conceptual',
      category: 'async',
      topic: 'async-await',
      question: 'Explain the difference between async/await and promises with .then()',
      expected_key_points: [
        'Syntactic sugar over promises',
        'Better error handling with try/catch',
        'Sequential code appearance',
        'Easier to read and maintain',
        'Both return promises'
      ],
      hint: 'Think about how async/await makes asynchronous code look synchronous',
      sample_answer: [
        'async/await is syntactic sugar over promises',
        'Allows writing async code that looks synchronous',
        'Better error handling with try/catch vs .catch()',
        'Both approaches ultimately return promises',
        'async/await is generally more readable'
      ],
      tags: ['async', 'promises', 'es6'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'javascript',
      difficulty: 'intermediate',
      question_type: 'coding',
      category: 'objects',
      topic: 'destructuring',
      question: 'Use object destructuring to extract name and age from: { name: "John", age: 30, city: "NYC" }',
      expected_key_points: [
        'Object destructuring syntax',
        'Variable assignment from object properties',
        'Default values',
        'Nested destructuring'
      ],
      hint: 'Use curly braces on the left side of assignment',
      sample_answer: [
        'const { name, age } = { name: "John", age: 30, city: "NYC" };',
        'console.log(name); // "John"',
        'console.log(age); // 30'
      ],
      tags: ['destructuring', 'objects', 'es6'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'javascript',
      difficulty: 'advanced',
      question_type: 'conceptual',
      category: 'memory',
      topic: 'garbage-collection',
      question: 'How does garbage collection work in JavaScript and what are memory leaks?',
      expected_key_points: [
        'Automatic memory management',
        'Mark-and-sweep algorithm',
        'Reference counting',
        'Common causes of memory leaks',
        'Event listeners and closures as leak sources'
      ],
      hint: 'Think about how JavaScript automatically manages memory',
      sample_answer: [
        'JavaScript uses automatic garbage collection',
        'Mark-and-sweep algorithm identifies unreachable objects',
        'Memory leaks occur when references are kept unintentionally',
        'Common causes: event listeners, closures, global variables',
        'Use WeakMap/WeakSet for large temporary data'
      ],
      tags: ['memory', 'garbage-collection', 'performance'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'javascript',
      difficulty: 'advanced',
      question_type: 'coding',
      category: 'algorithms',
      topic: 'optimization',
      question: 'Implement a memoization function that caches results of expensive function calls.',
      expected_key_points: [
        'Closure for cache storage',
        'Function wrapping',
        'Cache key generation',
        'Performance optimization',
        'Handling multiple arguments'
      ],
      hint: 'Use a closure to store cached results',
      sample_answer: [
        'function memoize(fn) {',
        '  const cache = new Map();',
        '  return function(...args) {',
        '    const key = JSON.stringify(args);',
        '    if (cache.has(key)) return cache.get(key);',
        '    const result = fn.apply(this, args);',
        '    cache.set(key, result);',
        '    return result;',
        '  };',
        '}'
      ],
      tags: ['memoization', 'performance', 'closures'],
      is_active: true
    },

    // More React Questions
    {
      id: uuidv4(),
      tech_stack: 'react',
      difficulty: 'beginner',
      question_type: 'conceptual',
      category: 'state',
      topic: 'useState',
      question: 'When should you use useState vs a regular variable in React?',
      expected_key_points: [
        'useState triggers re-renders',
        'Regular variables don\'t persist',
        'State management for component data',
        'Performance implications',
        'Component lifecycle'
      ],
      hint: 'Think about what makes React components re-render',
      sample_answer: [
        'Use useState for data that changes over time',
        'Regular variables reset on each render',
        'useState triggers re-renders when updated',
        'Use regular variables for calculations that don\'t need to trigger renders'
      ],
      tags: ['useState', 'state', 're-renders'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'react',
      difficulty: 'intermediate',
      question_type: 'coding',
      category: 'forms',
      topic: 'controlled-components',
      question: 'Create a controlled input component with validation for email format.',
      expected_key_points: [
        'Controlled component pattern',
        'useState for form state',
        'Event handlers',
        'Input validation',
        'Error display'
      ],
      hint: 'Use value and onChange props to control the input',
      sample_answer: [
        'function EmailInput() {',
        '  const [email, setEmail] = useState("");',
        '  const [error, setError] = useState("");',
        '  const handleChange = (e) => {',
        '    const value = e.target.value;',
        '    setEmail(value);',
        '    setError(/@/.test(value) ? "" : "Invalid email");',
        '  };',
        '  return (',
        '    <input value={email} onChange={handleChange} />',
        '    {error && <span>{error}</span>',
        '  );',
        '}'
      ],
      tags: ['forms', 'controlled-components', 'validation'],
      is_active: true
    },
    {
      id: uuidv4(),
      tech_stack: 'react',
      difficulty: 'advanced',
      question_type: 'scenario',
      category: 'performance',
      topic: 'optimization',
      question: 'Your React app has slow renders. Describe steps to identify and fix performance bottlenecks.',
      expected_key_points: [
        'React DevTools Profiler',
        'Component memoization',
        'Virtual scrolling',
        'Code splitting',
        'State optimization'
      ],
      hint: 'Think about React DevTools and optimization patterns',
      sample_answer: [
        'Use React DevTools Profiler to identify slow components',
        'Apply React.memo to prevent unnecessary re-renders',
        'Use useMemo for expensive calculations',
        'Implement virtual scrolling for large lists',
        'Use React.lazy for code splitting',
        'Optimize state structure to minimize updates'
      ],
      tags: ['performance', 'optimization', 'profiling'],
      is_active: true
    }
  ];

  try {
    console.log('Adding more questions...');
    for (const question of additionalQuestions) {
      await questionsService.createQuestion(question);
    }
    console.log(`Successfully added ${additionalQuestions.length} more questions`);
  } catch (error) {
    console.error('Error adding questions:', error);
  } finally {
    await app.close();
  }
}

addMoreQuestions();
