const test = require('node:test');
const assert = require('node:assert/strict');
const { loadParserContext, plain } = require('./helpers.cjs');

test('parser accepts and normalises a valid row', () => {
  const { Parser } = loadParserContext();
  const result = Parser.parseString('Date,Category,Metric,Value,Unit,Target,Direction,Status\n2026-08-18,Cases,Open Cases,"1,200",count,1500,higher,');
  assert.equal(result.ok, true);
  assert.equal(result.rows[0].Value, 1200);
  assert.equal(result.rows[0].Status, 'amber');
  assert.equal(result.rows[0].Direction, 'higher');
});

test('parser rejects missing headers and invalid required row values', () => {
  const { Parser } = loadParserContext();
  const missing = Parser.parseString('Date,Metric,Value\n2026-08-18,Cases,2');
  assert.equal(missing.ok, false);
  assert.deepEqual(plain(missing.validation.missing), ['Category']);

  const badDate = Parser.parseString('Date,Category,Metric,Value\n2026-13-40,Cases,Open Cases,2');
  assert.equal(badDate.ok, false);
  assert.match(badDate.errors.join(' '), /Row 2: Date must be a real date/);

  const badValue = Parser.parseString('Date,Category,Metric,Value\n2026-08-18,Cases,Open Cases,abc');
  assert.equal(badValue.ok, false);
  assert.match(badValue.errors.join(' '), /Row 2: Value must be a valid number/);

  const invalidOnly = Parser.parseString('Date,Category,Metric,Value\n,,,abc');
  assert.equal(invalidOnly.ok, false);
  assert.match(invalidOnly.errors.join(' '), /Date is required/);
  assert.match(invalidOnly.errors.join(' '), /Value must be a valid number/);
});

test('parser validates optional target, status and direction values', () => {
  const { Parser } = loadParserContext();
  const result = Parser.parseString('Date,Category,Metric,Value,Target,Status,Direction\n2026-08-18,Cases,Open Cases,3,none,orange,sideways');
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /Target must be a valid number/);
  assert.match(result.errors.join(' '), /Status must be red, amber or green/);
  assert.match(result.errors.join(' '), /Direction must be higher or lower/);
});

test('status derivation is direction-aware and safe for zero targets', () => {
  const { Parser } = loadParserContext();
  assert.equal(Parser.deriveStatus(80, 100, 'higher'), 'amber');
  assert.equal(Parser.deriveStatus(79, 100, 'higher'), 'red');
  assert.equal(Parser.deriveStatus(100, 100, 'higher'), 'green');
  assert.equal(Parser.deriveStatus(100, 100, 'lower'), 'green');
  assert.equal(Parser.deriveStatus(120, 100, 'lower'), 'amber');
  assert.equal(Parser.deriveStatus(126, 100, 'lower'), 'red');
  assert.equal(Parser.deriveStatus(3, 0, 'lower'), 'red');
  assert.equal(Parser.deriveStatus(0, 0, 'lower'), 'green');
  assert.equal(Parser.deriveStatus(3, 0, ''), '');
});

test('blank direction does not assume that higher is better', () => {
  const { Parser } = loadParserContext();
  const result = Parser.parseString('Date,Category,Metric,Value,Target\n2026-08-18,Cases,Open Cases,3,5');
  assert.equal(result.ok, true);
  assert.equal(result.rows[0].Status, '');
});

test('number parsing remains tolerant but rejects trailing text', () => {
  const { Parser } = loadParserContext();
  assert.equal(Parser.parseNumber('$1.2k'), 1200);
  assert.equal(Parser.parseNumber('85%'), 85);
  assert.equal(Parser.parseNumber('-12.5'), -12.5);
  assert.equal(Parser.parseNumber('12cases'), null);
});

test('RTF content is rejected with corrective guidance', () => {
  const { Parser } = loadParserContext();
  const result = Parser.parseString('{\\rtf1 invalid}');
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /Rich Text Format/);
});
