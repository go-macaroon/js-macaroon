'use strict';

const test = require('tape');

const m = require('../macaroon');
const testUtils = require('./test-utils');

test('should be created with the expected signature', t => {
  const macaroon = m.newMacaroon({
    version: 1,
    rootKey: 'secret',
    identifier: 'some id',
    location: 'a location'
  });
  t.equal(macaroon.location, 'a location');
  t.equal(testUtils.bytesToString(macaroon.identifier), 'some id');
  t.equal(
    testUtils.bytesToHex(macaroon.signature),
    'd916ce6f9b62dc4a080ce5d4a660956471f19b860da4242b0852727331c1033d');

  const obj = macaroon.exportJSON();
  t.deepEqual(obj, {
    location: 'a location',
    identifier: 'some id',
    signature: 'd916ce6f9b62dc4a080ce5d4a660956471f19b860da4242b0852727331c1033d',
  });

  macaroon.verify('secret', testUtils.never);
  t.end();
});

test('should fail when newMacaroon called with bad args', t => {
  t.throws(() => {
    m.newMacaroon({
      rootKey: null,
      identifier: 'some id',
      location: 'a location',
    });
  }, /TypeError: Macaroon root key has the wrong type; want string or Uint8Array, got object./);
  t.throws(() => {
    m.newMacaroon({
      rootKey: 5,
      identifier: 'some id',
      location: 'a location',
    });
  }, /TypeError: Macaroon root key has the wrong type; want string or Uint8Array, got number./);

  var key = testUtils.stringToBytes('key');
  t.throws(() => {
    m.newMacaroon({
      rootKey: key,
      identifier: null,
      location: 'a location',
    });
  }, /TypeError: Macaroon identifier has the wrong type; want string or Uint8Array, got object./);
  t.throws(() => {
    m.newMacaroon({
      rootKey: key,
      identifier: 5,
      location: 'a location',
    });
  }, /TypeError: Macaroon identifier has the wrong type; want string or Uint8Array, got number./);
  t.throws(() => {
    m.newMacaroon({
      rootKey: key,
      identifier: 'id',
      location: 5,
    });
  }, /TypeError: Macaroon location has the wrong type; want string, got number./);
  t.throws(() => {
    m.newMacaroon({
      rootKey: key,
      identifier: 'id',
      location: key,
    });
  }, /TypeError: Macaroon location has the wrong type; want string, got object./);
  t.end();
});

test('should allow adding first party caveats', t => {
  const rootKey = 'secret';
  const macaroon = m.newMacaroon({
    version: 1,
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
    testUtils.bytesToHex(macaroon.signature),
    'c934e6af642ee55a4e4cfc56e07706cf1c6c94dc2192e5582943cddd88dc99d8');
  const obj = macaroon.exportJSON();
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
  }, /caveat check failed \(not met\): condition not met/);

  t.equal(tested['not met'], true);
  t.end();
});

test('should allow adding a third party caveat', t => {
  const rootKey = 'secret';
  const macaroon = m.newMacaroon({
    rootKey,
    identifier: 'some id',
    location: 'a location',
  });
  const dischargeRootKey = 'shared root key';
  const thirdPartyCaveatId = '3rd party caveat';
  macaroon.addThirdPartyCaveat(
    dischargeRootKey, thirdPartyCaveatId, 'remote.com');

  const dm = m.newMacaroon({
    rootKey: dischargeRootKey,
    identifier: thirdPartyCaveatId,
    location: 'remote location',
  });

  dm.bindToRoot(macaroon.signature);
  macaroon.verify(rootKey, testUtils.never, [dm]);
  t.end();
});

test('should allow binding to another macaroon', t => {
  const macaroon = m.newMacaroon({
    rootKey: 'secret',
    identifier: 'some id',
  });
  macaroon.bindToRoot(testUtils.stringToBytes('another sig'));
  t.equal(
    testUtils.bytesToHex(macaroon.signature),
    'bba29be9ed9485a594f678adad69b7071c2f353308933355fc81cfad601b8277');
  t.end();
});
