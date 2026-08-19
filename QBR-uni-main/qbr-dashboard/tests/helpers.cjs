const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

class MemoryStorage {
  constructor(initial) {
    this.data = Object.assign({}, initial || {});
    this.failWrites = false;
  }

  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null;
  }

  setItem(key, value) {
    if (this.failWrites) {
      const error = new Error('Storage quota exceeded');
      error.name = 'QuotaExceededError';
      throw error;
    }
    this.data[key] = String(value);
  }

  removeItem(key) { delete this.data[key]; }
  clear() { this.data = {}; }
}

function createContext(options) {
  options = options || {};
  const context = {
    console: options.console || console,
    setTimeout,
    clearTimeout,
    Blob: global.Blob,
    URL: global.URL,
    localStorage: options.localStorage || new MemoryStorage(),
    document: options.document || {
      body: { appendChild() {}, removeChild() {} },
      createElement() { return { click() {}, set href(v) {}, set download(v) {} }; }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  return context;
}

function loadScript(context, relativePath) {
  const filename = path.join(ROOT, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  vm.runInContext(source, context, { filename });
  return context;
}

function loadParserContext() {
  const context = createContext();
  context.Store = {
    SCHEMA: {
      required: ['Date', 'Category', 'Metric', 'Value'],
      optional: ['Unit', 'Direction', 'Status', 'Version', 'CaseID', 'Owner', 'Target', 'Notes']
    }
  };
  loadScript(context, 'vendor/papaparse.min.js');
  loadScript(context, 'js/parser.js');
  return context;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { ROOT, MemoryStorage, createContext, loadScript, loadParserContext, plain };
