import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVolcanoSnapshot } from './records.js';

test('volcano normalizer merges elevated notices over status features', () => {
  const rows = normalizeVolcanoSnapshot({
    features: [
      {
        geometry: { type: 'Point', coordinates: [-155.2, 19.4] },
        properties: {
          volcanoName: 'Kilauea',
          vnum: '332010',
          alertLevel: 'NORMAL',
          colorCode: 'GREEN',
        },
      },
    ],
    elevated: [
      {
        vName: 'Kilauea',
        vnum: '332010',
        lat: 19.4,
        long: -155.2,
        alertLevel: 'WATCH',
        colorCode: 'ORANGE',
        noticeSynopsis: 'Lava continues',
        noticeUrl: 'https://example.test/notice',
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].severity, 'watch');
  assert.equal(rows[0].elevated, true);
  assert.match(rows[0].summary, /Lava continues/);
});

test('volcano normalizer rejects empty unknown payloads', () => {
  assert.equal(normalizeVolcanoSnapshot({ hello: true }), null);
});
