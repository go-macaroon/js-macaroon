'use strict';

const test = require('tape');
const testUtils = require('./test-utils');

const m = require('../macaroon');

const base64ToBytes = testUtils.base64ToBytes;
const bytesToBase64 = testUtils.bytesToBase64;

test('should serialize binary format without caveats', t => {
  const macaroon = m.newMacaroon({
    rootKey: Buffer.from('this is the key'),
    identifier: 'keyid',
    location: 'http://example.org/'
  });

  t.equal(bytesToBase64(macaroon.serializeBinary()), 'AgETaHR0cDovL2V4YW1wbGUub3JnLwIFa2V5aWQAAAYgfN7nklEcW8b1KEhYBd/psk54XijiqZMB+dcRxgnjjvc=');
  t.end();
});

test('should serialize binary format with one caveat', t => {
  console.log('test: should serialize binary format with one caveat');
  const macaroon = m.newMacaroon({
    rootKey: Buffer.from('this is the key'),
    identifier: 'keyid',
    location: 'http://example.org/'
  });
  macaroon.addFirstPartyCaveat('account = 3735928559');
  t.equal(bytesToBase64(macaroon.serializeBinary()), 'AgETaHR0cDovL2V4YW1wbGUub3JnLwIFa2V5aWQAAhRhY2NvdW50ID0gMzczNTkyODU1OQAABiD1SAf23G7fiL8PcwazgiVio2JTPb9zObphdl2kvSWdhw==');
  t.end();
});

test('should serialize binary format with two caveats', t => {
  const macaroon = m.newMacaroon({
    rootKey: Buffer.from('this is the key'),
    identifier: 'keyid',
    location: 'http://example.org/'
  });
  macaroon.addFirstPartyCaveat('account = 3735928559');
  macaroon.addFirstPartyCaveat('user = alice');

  t.equal(bytesToBase64(macaroon.serializeBinary()), 'AgETaHR0cDovL2V4YW1wbGUub3JnLwIFa2V5aWQAAhRhY2NvdW50ID0gMzczNTkyODU1OQACDHVzZXIgPSBhbGljZQAABiBL6WfNHqDGsmuvakqU7psFsViG2guoXoxCqTyNDhJe/A==');
  t.end();
});

test('should deserialize binary format without caveats', t => {
  const macaroon = m.deserializeBinary(base64ToBytes('AgETaHR0cDovL2V4YW1wbGUub3JnLwIFa2V5aWQAAAYgfN7nklEcW8b1KEhYBd/psk54XijiqZMB+dcRxgnjjvc='));
  t.equal(macaroon.location, 'http://example.org/');
  t.equal(macaroon.identifier, 'keyid');
  t.equal(macaroon._caveats.length, 0);
  t.equals(bytesToBase64(macaroon.signature), 'fN7nklEcW8b1KEhYBd/psk54XijiqZMB+dcRxgnjjvc=');
  t.end();
});

test('should deserialize binary format with one caveat', t => {
  const macaroon = m.deserializeBinary(base64ToBytes('AgETaHR0cDovL2V4YW1wbGUub3JnLwIFa2V5aWQAAhRhY2NvdW50ID0gMzczNTkyODU1OQAABiD1SAf23G7fiL8PcwazgiVio2JTPb9zObphdl2kvSWdhw=='));
  t.equal(macaroon._location, 'http://example.org/');
  t.equal(macaroon._identifier, 'keyid');
  t.equal(macaroon._caveats.length, 1);
  t.equal(macaroon._caveats[0]._identifier, 'account = 3735928559');
  t.equal(bytesToBase64(macaroon.signature), '9UgH9txu34i/D3MGs4IlYqNiUz2/czm6YXZdpL0lnYc=');
  t.end();
});

test('should deserialize binary format with two caveats', t => {
  const macaroon = m.deserializeBinary(base64ToBytes('AgETaHR0cDovL2V4YW1wbGUub3JnLwIFa2V5aWQAAhRhY2NvdW50ID0gMzczNTkyODU1OQACDHVzZXIgPSBhbGljZQAABiBL6WfNHqDGsmuvakqU7psFsViG2guoXoxCqTyNDhJe/A=='));
  t.equal(macaroon._location, 'http://example.org/');
  t.equal(macaroon._identifier, 'keyid');
  t.equal(macaroon._caveats.length, 2);
  t.equal(macaroon._caveats[0]._identifier, 'account = 3735928559');
  t.equal(macaroon._caveats[1]._identifier, 'user = alice');
  t.equal(bytesToBase64(macaroon.signature), 'S+lnzR6gxrJrr2pKlO6bBbFYhtoLqF6MQqk8jQ4SXvw=');
  t.end();
});
