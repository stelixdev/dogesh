function detectType(query) {
  if (/^[\d\s\+\-\*\/\(\)\.\%\^]+$/.test(query.trim())) return 'math';
  return 'search';
}

module.exports = detectType;
