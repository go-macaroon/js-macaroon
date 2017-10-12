'use strict';

const test = require('tape');
const testUtils = require('./test-utils.js');
const m = require('../macaroon');

const bytesToBase64 = m.bytesToBase64;
const base64ToBytes = m.base64ToBytes;

const base64ToBytesTests = [{
  about:  'empty string',
  input:  '',
  expect: '',
}, {
  about:  'standard encoding, padded',
  input:  'Z29+IQ==',
  expect: 'go~!',
}, {
  about:  'URL encoding, padded',
  input:  'Z29-IQ==',
  expect: 'go~!',
}, {
  about:  'standard encoding, not padded',
  input:  'Z29+IQ',
  expect: 'go~!',
}, {
  about:  'URL encoding, not padded',
  input:  'Z29-IQ',
  expect: 'go~!',
}, {
  about:       'standard encoding, too much padding',
  input:       'Z29+IQ===',
  expectError: /TypeError: invalid encoding/,
}];

test('base64ToBytes', t => {
  base64ToBytesTests.forEach(test => {
    t.test('base64ToBytes: ' + test.about, t => {
      if (test.expectError) {
        t.throws(() => base64ToBytes(test.input), test.expectError);
      } else {
        t.deepEqual(base64ToBytes(test.input), testUtils.stringToBytes(test.expect));
      }
      t.end();
    });
  });
  t.end();
});


test('bytesToBase64', t => {
  t.equal(bytesToBase64(testUtils.stringToBytes('go~!')), 'Z29-IQ');
  t.end();
});

