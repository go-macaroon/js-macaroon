'use strict';

const rewire = require('rewire');
const test = require('tape');

const m = rewire('../macaroon');
const testUtils = require('./test-utils');
const bytes = testUtils.bytes;

const ByteBuffer = m.__get__('ByteBuffer');
const ByteReader = m.__get__('ByteReader');


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

const varintTests = [
  [2147483648, [128, 128, 128, 128, 8]],
  [2147483649, [129, 128, 128, 128, 8]],
  [4294967295, [255, 255, 255, 255, 15]],
  [0, [0]],
  [1, [1]],
  [2, [2]],
  [10, [10]],
  [20, [20]],
  [63, [63]],
  [64, [64]],
  [65, [65]],
  [127, [127]],
  [128, [128, 1]],
  [129, [129, 1]],
  [255, [255, 1]],
  [256, [128, 2]],
  [257, [129, 2]],
  [2147483647, [255, 255, 255, 255, 7]],
];

test('ByteBuffer appendUvarint', t => {
  varintTests.forEach(test => {
    const buf = new ByteBuffer(0);
    buf.appendUvarint(test[0]);
    t.deepEqual(buf.bytes, test[1], `test ${test[0]}`);
  });
  t.end();
});

test('ByteReader read byte', t => {
  const r = new ByteReader(bytes([0, 1, 2, 3]));
  t.equal(r.length, 4);
  for(var i = 0; i < 4; i++) {
    t.equal(r.readByte(), i, `byte ${i}`);
  }
  t.throws(function() {
    r.readByte();
  }, RangeError);
  t.end();
});

test('ByteReader read bytes', t => {
  const r = new ByteReader(bytes([0, 1, 2, 3, 4, 5]));
  t.equal(r.readByte(), 0);
  t.deepEqual(r.readN(3), bytes([1,2,3]));
  t.throws(function() {
    r.readN(3);
  }, RangeError);
  t.end();
});

test('ByteReader readUvarint', t => {
  varintTests.forEach(test => {
    const r = new ByteReader(bytes([99].concat(test[1])));
    // Read one byte at the start so we are dealing with a non-zero
    // index.
    r.readByte();
    const len0 = r.length;
    const x = r.readUvarint();
    t.equal(x, test[0], `test ${test[0]}`);
    // Check that we've read the expected number of bytes.
    t.equal(len0 - r.length, test[1].length);
  });
  t.end();
});

test('ByteReader readUvarint out of bounds', t => {
  const r = new ByteReader(bytes([]));
  t.throws(function() {
    r.readUvarint();
  }, RangeError);
  // Try all the tests with one less byte than there should be.
  varintTests.forEach(test => {
    const r = new ByteReader(test[1].slice(0, test[1].length-1));
    t.throws(function() {
      r.readUvarint();
    }, RangeError);
  });
  t.end();
});
