'use strict';

const test = require('tape');

const m = require('../macaroon');
const testUtils = require('./test-utils');

test('should be created with the expected signature', t => {
  const rootKey = testUtils.strUint8Array('secret');
  const macaroon = new m.Macaroon({
    rootKey,
    identifier: 'some id',
    location: 'a location'
  });
  t.equal(macaroon.location, 'a location');
  t.equal(macaroon.identifier, 'some id');
  t.equal(
    testUtils.Uint8ArrayToHex(macaroon.signature),
    'd916ce6f9b62dc4a080ce5d4a660956471f19b860da4242b0852727331c1033d');

  const obj = macaroon.exportAsObject();
  t.deepEqual(obj, {
    location: 'a location',
    identifier: 'some id',
    signature: 'd916ce6f9b62dc4a080ce5d4a660956471f19b860da4242b0852727331c1033d',
    caveats: [],
  });

  macaroon.verify(rootKey, testUtils.never);
  t.end();
});

test('should fail when newMacaroon called with bad args', t => {
  t.throws(() => {
    new m.Macaroon({
      rootKey: null, identifier: 'some id', location: 'a location'});
  }, 'Macaroon root key, is not of type Uint8Array.');
  t.throws(() => {
    new m.Macaroon({
      rootKey: 'invalid', identifier: 'some id', location: 'a location'});
  }, 'Macaroon root key, is not of type Uint8Array.');
  t.throws(() => {
    m.Macaroon(5, 'some id', 'a location');
  }, 'Macaroon root key, is not of type Uint8Array.');

  var key = testUtils.strUint8Array('key');
  t.throws(() => {
    new m.Macaroon(key, null, 'a location');
  }, 'Macaroon identifier, is not of type string.');
  t.throws(() => {
    new m.Macaroon(key, 5, 'a location');
  }, 'Macaroon identifier, is not of type string.');
  t.throws(() => {
    new m.Macaroon(key, key, 'a location');
  }, 'Macaroon identifier, is not of type string.');

  t.throws(() => {
    new m.Macaroon(key, 'id', null);
  }, 'Macaroon location, is not of type string.');
  t.throws(() => {
    new m.Macaroon(key, 'id', 5);
  }, 'Macaroon location, is not of type string.');
  t.throws(() => {
    new m.Macaroon(key, 'id', key);
  }, 'Macaroon location, is not of type string.');
  t.end();
});

test('should allow adding first party caveats', t => {
  const rootKey = testUtils.strUint8Array('secret');
  const macaroon = new m.Macaroon({
    rootKey,
    identifier: 'some id',
    location: 'a location'
  });
  const caveats = ['a caveat', 'another caveat'];
  const trueCaveats = {};
  const tested = {};
  for (let i = 0; i < caveats.length; i++) {
    macaroon.addFirstPartyCaveat(caveats[i]);
    trueCaveats[caveats[i]] = true;
  }
  t.equal(
    testUtils.Uint8ArrayToHex(macaroon.signature),
    'c934e6af642ee55a4e4cfc56e07706cf1c6c94dc2192e5582943cddd88dc99d8');
  const obj = macaroon.exportAsObject();
  t.deepEqual(obj, {
    location: 'a location',
    identifier: 'some id',
    signature: 'c934e6af642ee55a4e4cfc56e07706cf1c6c94dc2192e5582943cddd88dc99d8',
    caveats: [{
      cid: 'a caveat',
    }, {
      cid: 'another caveat',
    }],
  });
  const check = caveat => {
    tested[caveat] = true;
    if (!trueCaveats[caveat]) {
      return 'condition not met';
    }
  };
  macaroon.verify(rootKey, check);
  t.deepEqual(tested, trueCaveats);

  macaroon.addFirstPartyCaveat('not met');
  t.throws(() => {
    macaroon.verify(rootKey, check);
  }, 'condition not met');

  t.equal(tested['not met'], true);
  t.end();
});

test('should allow adding a third party caveat', t => {
  const rootKey = testUtils.strUint8Array('secret');
  const macaroon = new m.Macaroon({
    rootKey, identifier: 'some id', location: 'a location'
  });
  const dischargeRootKey = testUtils.strUint8Array('shared root key');
  const thirdPartyCaveatId = '3rd party caveat';
  macaroon.addThirdPartyCaveat(
    dischargeRootKey, thirdPartyCaveatId, 'remote.com');

  const dm = new m.Macaroon({
    rootKey: dischargeRootKey,
    identifier: thirdPartyCaveatId,
    location: 'remote location'
  });
  dm.bind(macaroon.signature);
  macaroon.verify(rootKey, testUtils.never, [dm]);
  t.end();
});

test('should allow binding to another macaroon', t => {
  const rootKey = testUtils.strUint8Array('secret');
  const macaroon = new m.Macaroon({
    rootKey, identifier: 'some id', location: 'a location'
  });
  const otherSig = testUtils.strUint8Array('another sig');
  macaroon.bind(otherSig);
  t.equal(
    testUtils.Uint8ArrayToHex(macaroon.signature),
    'bba29be9ed9485a594f678adad69b7071c2f353308933355fc81cfad601b8277');
  t.end();
});
