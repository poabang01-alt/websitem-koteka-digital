const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { performance } = require('node:perf_hooks');
const { test } = require('node:test');
const vm = require('node:vm');

function analytics(traffic, DateClass = Date) {
  const source = readFileSync('public/admin/app.js', 'utf8');
  let constructions = 0, formats = 0;
  const sandbox = {
    traffic, Date: DateClass,
    Intl: { DateTimeFormat: function (...args) {
      constructions++;
      const formatter = new Intl.DateTimeFormat(...args);
      return { formatToParts(value) { formats++; return formatter.formatToParts(value); } };
    } },
  };
  const dates = source.slice(source.indexOf('const WIT_ZONE='), source.indexOf('const fmtTime='));
  const aggregation = source.slice(source.indexOf('function groupKey('), source.indexOf('function getTrafficMetrics('));
  vm.runInNewContext(dates + '\n' + aggregation + '\nglobalThis.api={aggregateTraffic,groupKey,dateISO};', sandbox);
  return { ...sandbox.api, get constructions() { return constructions; }, get formats() { return formats; } };
}

test('dashboard aggregates 5000 visits without rebuilding formatters or repeating date conversion', () => {
  const traffic = Array.from({ length: 5000 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 9, 1) + index * 60000).toISOString(),
    views: 1, session: 'visitor-' + index, channel: 'Direct', device: 'Desktop',
  }));
  const app = analytics(traffic);
  const filter = { granularity: 'hari', from: '2026-10-01', to: '2026-10-10', hour: 'all', channel: 'all', device: 'all' };
  const start = performance.now();
  const result = app.aggregateTraffic(filter);
  const firstMs = performance.now() - start;
  const formats = app.formats;
  const repeatStart = performance.now();
  const repeated = app.aggregateTraffic(filter);
  const repeatMs = performance.now() - repeatStart;
  console.log(JSON.stringify({ benchmark: '5000 synthetic visits', firstMs: Number(firstMs.toFixed(2)), repeatMs: Number(repeatMs.toFixed(2)), formatterConstructions: app.constructions, dateConversions: app.formats }));
  assert.equal(result.reduce((total, bucket) => total + bucket.views, 0), 5000);
  assert.equal(result.reduce((total, bucket) => total + bucket.unique, 0), 5000);
  assert.equal(JSON.stringify(repeated), JSON.stringify(result));
  assert.equal(app.constructions, 1, 'reuse one WIT formatter across all records and chart redraws');
  assert.ok(formats <= 5000, 'each timestamp should be converted at most once');
  assert.equal(app.formats, formats, 'unchanged traffic must reuse converted dates');
});

test('weekly analytics use WIT calendar boundaries even when the browser uses UTC', () => {
  class UTCDate extends Date {
    getDay() { return super.getUTCDay(); }
    getDate() { return super.getUTCDate(); }
    setDate(value) { return super.setUTCDate(value); }
    setHours(...values) { return super.setUTCHours(...values); }
  }
  const app = analytics([], UTCDate);
  assert.equal(app.dateISO('2026-10-25T16:00:00Z'), '2026-10-26');
  assert.equal(app.groupKey('2026-10-25T16:00:00Z', 'minggu'), '2026-10-26');
  assert.equal(app.groupKey('2026-10-25T14:00:00Z', 'minggu'), '2026-10-19');
});
