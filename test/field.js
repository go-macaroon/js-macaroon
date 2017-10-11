'use strict';

const rewire = require('rewire');
const test = require('tape');

const m = rewire('../macaroon');

const ByteReader = m.__get__('ByteReader');
const readFieldV2 = m.__get__('readFieldV2');

test('parse v2 field', t => {
  const tests = [{
    about: 'EOS packet',
    data:  [0x00],
    field: 0,
    expectPacket: [],
  }, {
    about: 'simple field',
    data:  [0x02, 0x03, 0x78, 0x79, 0x80],
    field: 2,
    expectPacket: [0x78, 0x79, 0x80],
  }, {
    about: 'unexpected field type',
    data: [0x02, 0x03, 0x78, 0x79, 0x80],
    field: 1,
    expectError: /Unexpected field type, got 2 want 1/,
  }, {
    about:       'empty buffer',
    data:        [],
    field: 2,
    expectError: /Read past end of buffer/,
  }, {
    about:       'varint out of range',
    data:        [0x02, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f],
    field: 2,
    expectError: /RangeError: Overflow error decoding varint/,
  }, {
    about:       'varint way out of range',
    data:        [0x02, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f],
    field: 2,
    expectError: /RangeError: Overflow error decoding varint/,
  }, {
    about:       'unterminated varint',
    data:        [0x02, 0x80],
    field: 2,
    expectError: /RangeError: Buffer too small decoding varint/,
  }, {
    about:       'field data too long',
    data:        [0x02, 0x02, 0x48],
    field: 2,
    expectError: /RangeError: Read past end of buffer/,
  }];
  tests.forEach(test => {
    t.test('parse v2 field: ' + test.about, t => {
      const r = new ByteReader(new Uint8Array(test.data));
      if (test.expectError) {
        t.throws(() => readFieldV2(r, test.field), test.expectError);
      } else {
        t.deepEqual(readFieldV2(r, test.field), test.expectPacket, test.about);
      }
      t.end();
    });
  });
  t.end();
});
