const test = require('node:test');
const assert = require('node:assert/strict');
const { MemoryStorage, createContext, loadScript, plain } = require('./helpers.cjs');

function loadStore(storage) {
  const quietConsole = { log() {}, warn() {}, error() {}, info() {} };
  const context = createContext({ localStorage: storage, console: quietConsole });
  loadScript(context, 'js/store.js');
  return context.Store;
}

const sampleRow = { Date: '2026-08-18', Category: 'Cases', Metric: 'Open', Value: 3 };

test('store starts with all categories and persists accepted rows', () => {
  const storage = new MemoryStorage();
  const Store = loadStore(storage);
  assert.equal(Store.getCategories().length, 8);
  Store.setCategoryData('tac', [sampleRow], { fileName: 'tac.csv' });
  assert.equal(Store.getRows('tac').length, 1);
  assert.match(storage.getItem(Store.STORAGE_KEY), /tac\.csv/);
});

test('failed persistence preserves the previous in-memory and saved state', () => {
  const storage = new MemoryStorage();
  const Store = loadStore(storage);
  Store.setCategoryData('tac', [sampleRow], { fileName: 'first.csv' });
  const before = storage.getItem(Store.STORAGE_KEY);
  storage.failWrites = true;
  assert.throws(() => Store.setCategoryData('tac', [sampleRow, sampleRow], { fileName: 'second.csv' }), /Storage quota exceeded/);
  assert.equal(Store.getRows('tac').length, 1);
  assert.equal(storage.getItem(Store.STORAGE_KEY), before);
});

test('corrupt primary state restores a valid backup and reports a warning', () => {
  const backup = {
    version: 1,
    updatedAt: '2026-08-18T00:00:00.000Z',
    data: { tac: { rows: [sampleRow], meta: { fileName: 'backup.csv' } } }
  };
  const storage = new MemoryStorage({
    qbr_dashboard_state_v1: '{invalid',
    qbr_dashboard_state_v1_backup: JSON.stringify(backup)
  });
  const Store = loadStore(storage);
  assert.equal(Store.getRows('tac').length, 1);
  assert.match(Store.getLoadWarning(), /backup was restored/);
  assert.equal(JSON.parse(storage.getItem(Store.STORAGE_KEY)).data.tac.meta.fileName, 'backup.csv');
});

test('clear all removes rows and the recovery backup', () => {
  const storage = new MemoryStorage();
  const Store = loadStore(storage);
  Store.setCategoryData('tac', [sampleRow], { fileName: 'tac.csv' });
  Store.clearAll();
  assert.equal(Store.totalRows(), 0);
  assert.equal(storage.getItem(Store.STORAGE_KEY + '_backup'), null);
  assert.equal(plain(Store.getRows('tac')).length, 0);
});
