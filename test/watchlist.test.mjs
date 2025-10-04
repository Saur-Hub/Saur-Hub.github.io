import assert from 'assert/strict';
import { parseYear, isDuplicate } from '../assets/js/watchlist.js';

console.log('Running watchlist helper tests...');

// parseYear tests
assert.equal(parseYear('2019'), 2019, 'Should parse simple year');
assert.equal(parseYear('2019–'), 2019, 'Should parse range with dash');
assert.equal(parseYear('1999-2001'), 1999, 'Should parse range with hyphen');
assert.equal(parseYear('N/A'), 0, 'Non-year should return 0');
assert.equal(parseYear(null), 0, 'Null should return 0');

// isDuplicate tests
const list = [
  { title: 'The Green Mile', year: '1999' },
  { title: 'Spider-Man', year: '2002' }
];

assert.equal(isDuplicate(list, { title: 'The Green Mile', year: '1999' }), true, 'Exact duplicate should be true');
assert.equal(isDuplicate(list, { title: 'The Green Mile', year: '2000' }), false, 'Different year should be false');
assert.equal(isDuplicate(list, { title: 'New Movie', year: '2020' }), false, 'New item should be false');

console.log('All watchlist helper tests passed.');
