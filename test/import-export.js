'use strict';

const test = require('tape');

const m = require('../macaroon');
const testUtils = require('./test-utils');

test('importMacaroon should import from a single object', t => {
  const obj = {
    location: 'a location',
    identifier: 'id 1',
    signature: 'e0831c334c600631bf7b860ca20c9930f584b077b8eac1f1e99c6a45d11a3d20',
    caveats: [
      {
        'cid': 'a caveat'
      }, {
        'cid': '3rd question',
        'vid': 'MMVAwhLcKvsgJS-SCTuhi9fMNYT9SjSePUX2q4z8y4_TpYfB82UCirA0ZICOdUb7ND_2',
        'cl': '3rd loc'
      },
    ],
  };

  const macaroon = m.importMacaroon(obj);
  t.equal(macaroon.location, 'a location');
  t.equal(testUtils.bytesToString(macaroon.identifier), 'id 1');
  t.equal(
    testUtils.bytesToHex(macaroon.signature),
    'e0831c334c600631bf7b860ca20c9930f584b077b8eac1f1e99c6a45d11a3d20');
  // Test that it round trips.
  const obj1 = macaroon.exportJSON();
  t.deepEqual(obj1, obj);
  t.end();
});

test('importMacaroons should import from an array', t => {
  const objs = [{
    location: 'a location',
    identifier: 'id 0',
    signature: '4579ad730bf3f819a299aaf63f04f5e897d80690c4c5814a1ae026a45989de7d',
  }, {
    location: 'a location',
    identifier: 'id 1',
    signature: '99b1c2dede0ce1cba0b632e3996e9924bdaee6287151600468644b92caf3761b',
  }];
  const macaroon = m.importMacaroons(objs);

  t.equal(macaroon.length, 2);
  t.equal(testUtils.bytesToString(macaroon[0].identifier), 'id 0');
  t.equal(testUtils.bytesToString(macaroon[1].identifier), 'id 1');

  t.deepEqual([
    macaroon[0].exportJSON(),
    macaroon[1].exportJSON()], objs);
  t.end();
});
