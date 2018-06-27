'use strict';

const m = require('../macaroon');

const util = require('util');

const utf8Encoder = new util.TextEncoder();
const utf8Decoder = new util.TextDecoder('utf-8', {fatal : true});

const bytesToString = b => utf8Decoder.decode(b);
const stringToBytes = s => utf8Encoder.encode(s);

const bytesToHex = ua => {
  if (!(ua instanceof Uint8Array)) {
    throw new Error('invalid Uint8Array:' + ua);
  }
  let hex = '';
  for (var i = 0; i < ua.length; i++) {
    hex += (ua[i] < 16 ? '0' : '') + ua[i].toString(16);
  }
  return hex;
};

const never = () => 'condition is never true';

const base64ToBytes = m.base64ToBytes;

const bytesToBase64 = m.bytesToBase64;

const bytes = a => {
  return new Uint8Array(a);
};

/**
  Make a set of macaroons from the given macaroon spec.
  Each macaroon specification is an object holding:
    - rootKey: the root key (string)
    - id: the macaroon id (string)
    - caveats: an array of caveats to add to the macaroon, (see below)
    - location: the location of the macaroon (string)
  Each caveat is specified with an object holding:
    - rootKey: the caveat root key (string, optional)
    - location: the caveat location (string, optional)
    - condition: the caveat condition (string)
*/
const makeMacaroons = mspecs => {
  const macaroons = [];
  let i;
  for (i in mspecs) {
    let j;
    const mspec = mspecs[i];
    if (mspec.location === undefined) {
      mspec.location = '';
    }
    const macaroon = m.newMacaroon({
      rootKey: mspec.rootKey,
      identifier: mspec.id,
      location: mspec.location
    });
    for (j in mspec.caveats) {
      const caveat = mspec.caveats[j];
      if (caveat.location !== undefined) {
        macaroon.addThirdPartyCaveat(
          caveat.rootKey, caveat.condition, caveat.location);
      } else {
        macaroon.addFirstPartyCaveat(caveat.condition);
      }
    }
    macaroons.push(macaroon);
  }
  const primary = macaroons[0];
  const discharges = macaroons.slice(1);
  for (i in discharges) {
    discharges[i].bindToRoot(primary.signature);
  }
  return [mspecs[0].rootKey, primary, discharges];
};

module.exports = {
  bytesToString,
  stringToBytes,
  bytesToHex,
  base64ToBytes,
  bytesToBase64,
  never,
  bytes,
  makeMacaroons,
};
