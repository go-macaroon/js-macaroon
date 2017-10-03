'use strict';

const test = require('tape');
const sjcl = require('sjcl');

const m = require('../macaroon');

test('should serialize binary format without caveats', t => {
  const macaroon = m.newMacaroon({
    rootKey: Buffer.from('this is the key'),
    identifier: 'keyid',
    location: 'http://example.org/'
  });

  t.equal(macaroon.serializeBinary().toString('base64'), 'AgETaHR0cDovL2V4YW1wbGUub3JnLwIFa2V5aWQAAAYgfN7nklEcW8b1KEhYBd/psk54XijiqZMB+dcRxgnjjvc=');
  t.end();
});

test('should serialize binary format with one caveat', t => {
  const macaroon = m.newMacaroon({
    rootKey: Buffer.from('this is the key'),
    identifier: 'keyid',
    location: 'http://example.org/'
  });
  macaroon.addFirstPartyCaveat('account = 3735928559');

  t.equal(macaroon.serializeBinary().toString('base64'), 'AgETaHR0cDovL2V4YW1wbGUub3JnLwIFa2V5aWQAAhRhY2NvdW50ID0gMzczNTkyODU1OQAABiD1SAf23G7fiL8PcwazgiVio2JTPb9zObphdl2kvSWdhw==');
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

  t.equal(macaroon.serializeBinary().toString('base64'), 'AgETaHR0cDovL2V4YW1wbGUub3JnLwIFa2V5aWQAAhRhY2NvdW50ID0gMzczNTkyODU1OQACDHVzZXIgPSBhbGljZQAABiBL6WfNHqDGsmuvakqU7psFsViG2guoXoxCqTyNDhJe/A==');
  t.end();
});

test('should deserialize binary format without caveats', t => {
  const macaroon = m.deserializeBinary('AgETaHR0cDovL2V4YW1wbGUub3JnLwIFa2V5aWQAAAYgfN7nklEcW8b1KEhYBd/psk54XijiqZMB+dcRxgnjjvc=');
  t.equal(macaroon._location, 'http://example.org/');
  t.equal(macaroon._identifier, 'keyid');
  t.equal(macaroon._caveats.length, 0);
  t.equals(sjcl.codec.base64.fromBits(macaroon._signature), 'fN7nklEcW8b1KEhYBd/psk54XijiqZMB+dcRxgnjjvc=');
  t.end();
});

test('should deserialize binary format with one caveat', t => {
  const macaroon = m.deserializeBinary('AgETaHR0cDovL2V4YW1wbGUub3JnLwIFa2V5aWQAAhRhY2NvdW50ID0gMzczNTkyODU1OQAABiD1SAf23G7fiL8PcwazgiVio2JTPb9zObphdl2kvSWdhw==');
  t.equal(macaroon._location, 'http://example.org/');
  t.equal(macaroon._identifier, 'keyid');
  t.equal(macaroon._caveats.length, 1);
  t.equal(macaroon._caveats[0]._identifier, 'account = 3735928559');
  t.ok(Buffer.from(sjcl.codec.base64.fromBits(macaroon._signature), 'base64').equals(Buffer.from('9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc', 'base64')));
  t.end();
});

test('should deserialize binary format with two caveats', t => {
  const macaroon = m.deserializeBinary('AgETaHR0cDovL2V4YW1wbGUub3JnLwIFa2V5aWQAAhRhY2NvdW50ID0gMzczNTkyODU1OQACDHVzZXIgPSBhbGljZQAABiBL6WfNHqDGsmuvakqU7psFsViG2guoXoxCqTyNDhJe/A==');
  t.equal(macaroon._location, 'http://example.org/');
  t.equal(macaroon._identifier, 'keyid');
  t.equal(macaroon._caveats.length, 2);
  t.equal(macaroon._caveats[0]._identifier, 'account = 3735928559');
  t.equal(macaroon._caveats[1]._identifier, 'user = alice');
  t.ok(Buffer.from(sjcl.codec.base64.fromBits(macaroon._signature), 'base64').equals(Buffer.from('S+lnzR6gxrJrr2pKlO6bBbFYhtoLqF6MQqk8jQ4SXvw=', 'base64')));
  t.end();
});
