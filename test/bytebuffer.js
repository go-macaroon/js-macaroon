'use strict';

const rewire = require('rewire');
const test = require('tape');

const m = rewire('../macaroon');
const testUtils = require('./test-utils');
const bytes = testUtils.bytes;
const varintTests = require('./varint');

const ByteBuffer = m.__get__('ByteBuffer');

test('ByteBuffer append single byte', t => {
  const buf = new ByteBuffer(0);
  buf.appendByte(123);
  t.equal(buf.bytes.toString(), '123');
  t.end();
});

test('ByteBuffer append 10 bytes byte', t => {
  const buf = new ByteBuffer(0);
  for(var i = 0; i < 10; i++) {
    buf.appendByte(i);
  }
  t.equal(buf.bytes.toString(), '0,1,2,3,4,5,6,7,8,9');
  t.end();
});

test('ByteBuffer append bytes', t => {
  const buf = new ByteBuffer(0);
  buf.appendBytes(bytes([3,1,4,1,5,9,3]));
  t.equal(buf.bytes.toString(), '3,1,4,1,5,9,3');
  t.end();
});

test('ByteBuffer appendUvarint', t => {
  varintTests.forEach(test => {
    const buf = new ByteBuffer(0);
    buf.appendUvarint(test[0]);
    t.deepEqual(buf.bytes, test[1], `test ${test[0]}`);
  });
  t.end();
});
