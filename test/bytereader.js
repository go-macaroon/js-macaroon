'use strict';

const rewire = require('rewire');
const test = require('tape');

const m = rewire('../macaroon');
const testUtils = require('./test-utils');
const bytes = testUtils.bytes;

const ByteReader = m.__get__('ByteReader');

const varintTests = require('./varint');

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
