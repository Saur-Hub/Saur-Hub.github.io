import { parseYear, isDuplicate } from '../assets/js/watchlist.js';

function assert(cond, message) {
  const res = document.createElement('div');
  res.className = 'test-result';
  if (cond) {
    res.innerHTML = `<span class="pass">PASS</span> ${message}`;
  } else {
    res.innerHTML = `<span class="fail">FAIL</span> ${message}`;
  }
  document.getElementById('results').appendChild(res);
  return !!cond;
}

function runTests() {
  document.getElementById('title').textContent = 'Watchlist helper tests (browser)';
  let passed = 0;
  let total = 0;

  // parseYear tests
  total++; if (assert(parseYear('2019') === 2019, 'parseYear("2019") -> 2019')) passed++;
  total++; if (assert(parseYear('2019–') === 2019, 'parseYear("2019–") -> 2019')) passed++;
  total++; if (assert(parseYear('1999-2001') === 1999, 'parseYear("1999-2001") -> 1999')) passed++;
  total++; if (assert(parseYear('N/A') === 0, 'parseYear("N/A") -> 0')) passed++;
  total++; if (assert(parseYear(null) === 0, 'parseYear(null) -> 0')) passed++;

  // isDuplicate tests
  const list = [
    { title: 'The Green Mile', year: '1999' },
    { title: 'Spider-Man', year: '2002' }
  ];

  total++; if (assert(isDuplicate(list, { title: 'The Green Mile', year: '1999' }) === true, 'isDuplicate finds exact duplicate')) passed++;
  total++; if (assert(isDuplicate(list, { title: 'The Green Mile', year: '2000' }) === false, 'isDuplicate rejects different year')) passed++;
  total++; if (assert(isDuplicate(list, { title: 'New Movie', year: '2020' }) === false, 'isDuplicate rejects new item')) passed++;

  const summary = document.createElement('div');
  summary.className = 'summary';
  summary.innerHTML = `<strong>${passed} / ${total} tests passed</strong>`;
  document.getElementById('results').appendChild(summary);
}

window.addEventListener('load', runTests);
