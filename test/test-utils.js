'use strict';

const m = require('../macaroon');
const base64 = require('base64-js');
const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');

const strUint8Array = str => nacl.util.decodeUTF8(str);
module.exports.strUint8Array = strUint8Array;

module.exports.Uint8ArrayToHex = ua => {
  if (!(ua instanceof Uint8Array)) {
    throw new Error('invalid Uint8Array:' + ua);
  }
  let hex = '';
  for (var i = 0; i < ua.length; i++) {
    hex += (ua[i] < 16 ? '0' : '') + ua[i].toString(16);
  }
  return hex;
};

module.exports.never = () => 'condition is never true';

module.exports.base64ToBytes = s => {
  return base64.toByteArray(s);
};

module.exports.bytesToBase64 = bytes => {
  return base64.fromByteArray(bytes);
};

module.exports.bytes = a => {
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
module.exports.makeMacaroons = mspecs => {
  const macaroons = [];
  let i;
  for (i in mspecs) {
    let j;
    const mspec = mspecs[i];
    if (mspec.location === undefined) {
      mspec.location = '';
    }
    const macaroon = m.newMacaroon({
      rootKey: strUint8Array(mspec.rootKey),
      identifier: mspec.id,
      location: mspec.location
    });
    for (j in mspec.caveats) {
      const caveat = mspec.caveats[j];
      if (caveat.location !== undefined) {
        macaroon.addThirdPartyCaveat(
          strUint8Array(caveat.rootKey), caveat.condition, caveat.location);
      } else {
        macaroon.addFirstPartyCaveat(caveat.condition);
      }
    }
    macaroons.push(macaroon);
  }
  const primary = macaroons[0];
  const discharges = macaroons.slice(1);
  for (i in discharges) {
    discharges[i].bind(primary.signature);
  }
  return [strUint8Array(mspecs[0].rootKey), primary, discharges];
};
