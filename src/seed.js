import { seed } from './seed-core.js';

const reset = process.argv.includes('--reset');
const result = seed({ reset });
console.log(reset ? 'seed (reset) done' : 'seed done', result);
