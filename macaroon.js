'use strict';

const sjcl = require('sjcl');
const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');
const varint = require('varint');

function toVarintBuf(number) {
  return Buffer.from(varint.encode(number));
}

const NONCELEN = 24;

const V2_TYPES = {
  LOCATION: 1,
  IDENTIFIER: 2,
  VID: 4,
  SIGNATURE: 6
};

/**
  Check that supplied value is a string and return it. Throws an
  error including the provided label if not.
  @param {String} val The value to assert as a string
  @param {String} label The value label.
  @return {String} The supplied value.
*/
function requireString(val, label) {
  if (typeof val !== 'string') {
    throw new Error(`${label} has the wrong type; want string got ${typeof val}.`);
  }
  return val;
}

/**
  Check that supplied value is a string or undefined or null. Throws
  an error including the provided label if not. Always returns a string
  (the empty string if undefined or null).

  @param {(String | null)} val The value to assert as a string
  @param {String} label The value label.
  @return {String} The supplied value or an empty string.
*/
function maybeString(val, label) {
  if (val === undefined || val === null) {
    return '';
  }
  return requireString(val, label);
}

/**
  Check that supplied value is a Uint8Array. Throws an error
  including the provided label if not.
  @param {Uint8Array} val The value to assert as a Uint8Array
  @param {Uint8Array} label The value label.
  @return {Uint8Array} The supplied value.
*/
function requireUint8Array(val, label) {
  if (!(val instanceof Uint8Array)) {
    throw new Error(`${label}, is not of type Uint8Array.`);
  }
  return val;
}

/**
  Converts a Uint8Array to a bitArray for use by nacl.
  @param {Uint8Array} arr The array to convert.
*/
function uint8ArrayToBitArray(arr) {
  return sjcl.codec.base64.toBits(nacl.util.encodeBase64(arr));
}

/**
  Converts a bitArray to a Uint8Array.
  @param {bitArray} arr The array to convert.
*/
function bitArrayToUint8Array(arr) {
  return nacl.util.decodeBase64(sjcl.codec.base64.fromBits(arr));
}

/**
  Converts a hex to Uint8Array
  @param {String} hex The hex value to convert.
  @return {Uint8Array} The resulting array.
*/
function hexToUint8Array(hex) {
  const arr = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return arr;
}

/**
  Generate a fixed length key for use as a nacl secretbox key.
  @param {Uint8Array} key The key to convert.
  @return {bitArray} sjcl compatibile bitArray.
*/
function makeKey(key) {
  const bitArray = uint8ArrayToBitArray(key);
  return keyedHash(
    sjcl.codec.utf8String.toBits('macaroons-key-generator'), bitArray);
}

/**
  Generate a hash using the supplied data.
  @param {bitArray} key
  @param {bitArray} data
  @return {bitArray} The keyed hash of the supplied data as a sjcl bitArray.
*/
function keyedHash(key, data) {
  const hash = new sjcl.misc.hmac(key, sjcl.hash.sha256);
  hash.update(data);
  return hash.digest();
}

/**
  Generate a hash keyed with key of both data objects.
  @param {bitArray} key
  @param {bitArray} d1
  @param {bitArray} d2
  @return {bitArray} The keyed hash of d1 and d2 as a sjcl bitArray.
*/
function keyedHash2(key, d1, d2) {
  if (d1 === null) {
    return keyedHash(key, d2);
  }
  const h1 = keyedHash(key, d1);
  const h2 = keyedHash(key, d2);
  return keyedHash(key, sjcl.bitArray.concat(h1, h2));
}

/**
  Generate a random nonce as Uint8Array.
  @return {Uint8Array} nonce.
*/
function newNonce() {
  const nonce = nacl.randomBytes(NONCELEN);
  // XXX provide a way to mock this out
  for (let i = 0; i < nonce.length; i++) {
    nonce[i] = 0;
  }
  return nonce;
};

/**
  Encrypt the given plaintext with the given key.
  @param {bitArray} key sjcl bitArray key.
  @param {bitArray} text paintext to encrypt as sjcl bitArray.
*/
function encrypt(key, text) {
  const nonce = newNonce();
  key = bitArrayToUint8Array(key);
  text = bitArrayToUint8Array(text);
  const data = nacl.secretbox(text, nonce, key);
  const ciphertext = new Uint8Array(nonce.length + data.length);
  ciphertext.set(nonce, 0);
  ciphertext.set(data, nonce.length);
  return uint8ArrayToBitArray(ciphertext);
}

/**
  Decrypts the given cyphertest
  @param {bitArray} key An sjcl bitArray.
  @param {bitArray} ciphertext An sjcl bitArray as returned by encrypt.
*/
function decrypt(key, ciphertext) {
  key = bitArrayToUint8Array(key);
  ciphertext = bitArrayToUint8Array(ciphertext);
  const nonce = ciphertext.slice(0, NONCELEN);
  ciphertext = ciphertext.slice(NONCELEN);
  var text = nacl.secretbox.open(ciphertext, nonce, key);
  if (text === false) {
    throw new Error('decryption failed');
  }
  return uint8ArrayToBitArray(text);
}

const zeroKey = sjcl.codec.hex.toBits('0'.repeat(64));

/**
  Bind a given macaroon to the given signature of its parent macaroon. If the
  keys already match then it will return the rootSig.
  @param {bitArray} rootSig
  @param {bitArray} dischargeSig
  @return {bitArray} The bound macaroon.
*/
function bindForRequest(rootSig, dischargeSig) {
  if (sjcl.bitArray.equal(rootSig, dischargeSig)) {
    return rootSig;
  }
  return keyedHash2(zeroKey, rootSig, dischargeSig);
}

const Macaroon = class Macaroon {
  /**
    Create a new Macaroon with the given root key, identifier, location
    and signature.
    @param {Object} The necessary values to generate a macaroon.
      It contains the following fields:
        identifier: {String}
        location:   {String}
        caveats:    {Array}
        signature:  {bitarray}
  */
  constructor({identifier, location, caveats, signature}) {
    this._location = location;
    this._identifier = identifier;
    this._signature = signature;
    this._caveats = caveats;
  }

  get location() {
    return this._location;
  }

  get identifier() {
    return this._identifier;
  }

  get signature() {
    return bitArrayToUint8Array(this._signature);
  }

  /**
    Adds a first or third party caveat.
    @param {String} caveatId
    @param {bitArray} verificationId For a first party caveat, must be null
      otherwise must be bitArray.
    @param {String} location For a first party caveat, must be null otherwise
      must be String.
  */
  addCaveat(caveatId, verificationId, location) {
    const caveat = {
      _identifier: requireString(caveatId, 'Macaroon caveat id'),
      _vid: null,
      _location: null,
    };
    if (verificationId !== null) {
      caveat._location = requireString(location, 'Macaroon caveat location');
      caveat._vid = uint8ArrayToBitArray(
        requireUint8Array(verificationId, 'Macaroon caveat verification id'));
    }
    this._caveats.push(caveat);
    this._signature = keyedHash2(
      this._signature, caveat._vid, sjcl.codec.utf8String.toBits(caveatId));
  }

  /**
    Adds a third party caveat to the macaroon. Using the given shared root key,
    caveat id and location hint. The caveat id should encode the root key in
    some way, either by encrypting it with a key known to the third party or by
    holding a reference to it stored in the third party's storage.
    @param {bitArray} rootKey
    @param {String} caveatId
    @param {String} location
  */
  addThirdPartyCaveat(rootKey, caveatId, location) {
    const verificationId = bitArrayToUint8Array(
      encrypt(this._signature,
        makeKey(requireUint8Array(rootKey, 'Caveat root key'))));
    this.addCaveat(
      requireString(caveatId, 'Caveat id'),
      verificationId,
      requireString(location, 'Caveat location'));
  }

  /**
    Adds a caveat that will be verified by the target service.
    @param {String} caveatId
  */
  addFirstPartyCaveat(caveatId) {
    this.addCaveat(caveatId, null, null);
  }

  /**
    Sets the macaroon signature to one bound to the given signature.
    This must be called on discharge macaroons with the primary
    macaroon's signature before sending the macaroons in a request.
    @param {Uint8Array} sig
  */
  bind(sig) {
    sig = uint8ArrayToBitArray(sig);
    this._signature = bindForRequest(sig, this._signature);
  }

  /**
    Returns a copy of the macaroon. Any caveats added to the returned macaroon
    will not effect the original.
    @return {Macaroon} The cloned macaroon.
  */
  clone() {
    return new Macaroon({
      signature: this._signature,
      identifier: this._identifier,
      location: this._location,
      caveats: this._caveats.slice()
    });
  }

  /**
    Returns a JSON compatible object representation of this macaroon.
    @return {Object} JSON compatible representation of this macaroon.
  */
  exportAsJSONObject() {
    const obj = {
      identifier: this.identifier,
      signature: sjcl.codec.hex.fromBits(this._signature),
    };
    if (this.location) {
      obj.location = this.location;
    }
    if (this._caveats.length > 0) {
      obj.caveats = this._caveats.map(caveat => {
        const caveatObj = {
          cid: caveat._identifier
        };
        if (caveat._vid !== null) {
          // Use URL encoding and do not append "=" characters.
          caveatObj.vid = sjcl.codec.base64.fromBits(caveat._vid, true, true);
          caveatObj.cl = caveat._location;
        }
        return caveatObj;
      });
    }
    return obj;
  }

  /**
   * Serializes the macaroon using the v2 binary format.
   * @return {Buffer} Serialized macaroon
   */
  serializeBinary() {
    const EOS = Buffer.from([0]);

    const version = Buffer.from([2]);

    const bufs = [
      version,
    ];

    if (this._location) {
      const locationBuf = Buffer.from(this._location);
      bufs.push(toVarintBuf(V2_TYPES.LOCATION));
      bufs.push(toVarintBuf(locationBuf.length));
      bufs.push(locationBuf);
    }

    const identifierBuf = Buffer.from(this._identifier);
    bufs.push(toVarintBuf(V2_TYPES.IDENTIFIER));
    bufs.push(toVarintBuf(identifierBuf.length));
    bufs.push(identifierBuf);

    bufs.push(EOS);

    for (let caveat of this._caveats) {
      if (caveat._location) {
        bufs.push(toVarintBuf(V2_TYPES.LOCATION));
        const caveatLocationBuf = Buffer.from(caveat._location);
        bufs.push(toVarintBuf(caveatLocationBuf.length));
        bufs.push(caveatLocationBuf);
      }

      bufs.push(toVarintBuf(V2_TYPES.IDENTIFIER));
      const caveatIdentifierBuf = Buffer.from(caveat._identifier);
      bufs.push(toVarintBuf(caveatIdentifierBuf.length));
      bufs.push(caveatIdentifierBuf);

      if (caveat._vid) {
        bufs.push(toVarintBuf(V2_TYPES.VID));
        // TODO better way to convert from sjcl bitArry to Buffer?
        const caveatVidBuf = Buffer.from(sjcl.codec.hex.fromBits(caveat._vid), 'hex');
        bufs.push(toVarintBuf(caveatVidBuf.length));
        bufs.push(caveatVidBuf);
      }

      bufs.push(EOS);
    }

    bufs.push(EOS);
    // TODO better way to convert from sjcl bitArry to Buffer?
    bufs.push(toVarintBuf(V2_TYPES.SIGNATURE));
    const signatureBuf = Buffer.from(sjcl.codec.hex.fromBits(this._signature), 'hex');
    bufs.push(toVarintBuf(signatureBuf.length));
    bufs.push(signatureBuf);

    return Buffer.concat(bufs);
  }

  /**
    Verifies that the macaroon is valid. Throws exception if verification fails.
    @param {bitArray} rootKey Must be the same that the macaroon was
      originally created with.
    @param {Function} check Called to verify each first-party caveat. It
      is passed the condition to check (a string) and should return an error if the condition
      is not met, or null if satisfied.
    @param {Array} discharges
  */
  verify(rootKey, check, discharges = []) {
    rootKey = makeKey(rootKey);
    const used = discharges.map(d => 0);

    this._verify(this._signature, rootKey, check, discharges, used);

    discharges.forEach((dm, i) => {
      if (used[i] === 0) {
        throw new Error(
          `discharge macaroon ${JSON.stringify(dm.identifier)} was not used`);
      }
      if (used[i] !== 1) {
        // Should be impossible because of check in verify, but be defensive.
        throw new Error(
          `discharge macaroon ${JSON.stringify(dm.identifier)} was used more than once`);
      }
    });
  }
  _verify(rootSig, rootKey, check, discharges, used) {
    let caveatSig = keyedHash(
      rootKey, sjcl.codec.utf8String.toBits(this.identifier));
    this._caveats.forEach(caveat => {
      if (caveat._vid !== null) {
        const cavKey = decrypt(caveatSig, caveat._vid);
        let found = false;
        let di, dm;
        for (di = 0; di < discharges.length; di++) {
          dm = discharges[di];
          if (dm.identifier !== caveat._identifier) {
            continue;
          }
          found = true;
          // It's important that we do this before calling _verify,
          // as it prevents potentially infinite recursion.
          used[di]++;
          if (used[di] > 1) {
            throw new Error(
              `discharge macaroon ${JSON.stringify(dm.identifier)} was used more than once`);
          }
          dm._verify(rootSig, cavKey, check, discharges, used);
          break;
        }
        if (!found) {
          throw new Error(
            `cannot find discharge macaroon for caveat ${JSON.stringify(caveat._identifier)}`);
        }
      } else {
        const err = check(caveat._identifier);
        if (err) {
          throw new Error(err);
        }
      }
      caveatSig = keyedHash2(caveatSig, caveat._vid, caveat._identifier);
    });
    const boundSig = bindForRequest(rootSig, caveatSig);
    if (!sjcl.bitArray.equal(boundSig, this._signature)) {
      throw new Error('signature mismatch after caveat verification');
    }
  }

};

/**
  Returns macaroon instances based on the JSON-decoded object
  in the argument. If this is passed an array, it will decode
  all the macaroons in the array.
  @param {Object|Array} obj A deserialized JSON macaroon or an array of them.
  @return {Macaroon}
*/
const importFromJSONObject = function(obj) {
  if (Array.isArray(obj)) {
    return obj.map(val => importFromJSONObject(val));
  }
  let caveats = [];
  if (obj.caveats !== undefined) {
    caveats = obj.caveats.map(caveat => {
      const _caveat = {
        _identifier: requireString(caveat.cid, 'Caveat id'),
        _location: null,
        _vid: null
      };
      if (caveat.cl !== undefined) {
        _caveat._location = requireString(caveat.cl, 'Caveat location');
      }
      if (caveat.vid !== undefined) {
        _caveat._vid = sjcl.codec.base64.toBits(requireString(caveat.vid, 'Caveat verification id'), true);
      }
      return _caveat;
    });
  }
  return new Macaroon({
    signature: uint8ArrayToBitArray(hexToUint8Array(obj.signature)),
    location: maybeString(obj.location, 'Macaroon location'),
    identifier: requireString(obj.identifier, 'Macaroon identifier'),
    caveats: caveats,
  });
};

function readTypeLengthValue(buf, offset, expectedType) {
  let o = offset;
  const type = varint.decode(buf, o);
  if (expectedType && type !== V2_TYPES[expectedType]) {
    throw new Error('Expected ' + expectedType + ' at position: ' + o + ' (found: ' + type + ')');
  }
  o += varint.decode.bytes;
  const lengthLength = varint.decode(buf, o);
  o += varint.decode.bytes;
  const value = buf.slice(o, o + lengthLength);
  return {
    type,
    value,
    bytes: o + lengthLength - offset
  };
}

/**
 * Deserialize a macaroon from the v2 binary format
 * @param {Buffer|Base64-Encoded String} serializedMacaroon
 * @return {Macaroon}
 */
const deserializeBinary = function(serializedMacaroon) {
  const buf = Buffer.from(serializedMacaroon, 'base64');
  let offset = 0;

  const version = buf.readUInt8(offset++);
  if (version !== 2) {
    throw new Error('Only version 2 is supported');
  }

  let location = '';
  const next = readTypeLengthValue(buf, offset);
  if (next.type === V2_TYPES.LOCATION) {
    location = next.value.toString();
    offset += next.bytes;
  }

  const identifierRead = readTypeLengthValue(buf, offset, 'IDENTIFIER');
  const identifier = identifierRead.value.toString();
  offset += identifierRead.bytes;

  offset++; // EOS

  const caveats = [];
  if (buf.readUInt8(offset) !== 0) {
    while (offset < buf.length) {
      let caveatLocation;
      let caveatIdentifier;
      let caveatVid;
      const caveatLocationOrIdentifier = readTypeLengthValue(buf, offset);
      if (caveatLocationOrIdentifier.type === V2_TYPES.LOCATION) {
        caveatLocation = caveatLocationOrIdentifier.value.toString();
        offset += caveatLocationOrIdentifier.bytes;
      }

      const caveatIdentifierRead = readTypeLengthValue(buf, offset, 'IDENTIFIER');
      caveatIdentifier = caveatIdentifierRead.value.toString();
      offset += caveatIdentifierRead.bytes;

      // If location is set, vid is also required
      if (typeof caveatLocation === 'string') {
        const caveatVidRead = readTypeLengthValue(buf, offset, 'VID');
        caveatVid = sjcl.codec.hex.toBits(caveatVidRead.value.toString('hex'));
        offset += caveatVidRead.bytes;
      }

      offset++; // EOS

      caveats.push({
        _location: caveatLocation,
        _identifier: caveatIdentifier,
        _vid: caveatVid
      });

      // Check if the next thing is an EOS
      if (buf.readUInt8(offset) === 0) {
        break;
      }
    }
  }

  offset++; // EOS

  const signatureRead = readTypeLengthValue(buf, offset, 'SIGNATURE');
  const signature = sjcl.codec.hex.toBits(signatureRead.value.toString('hex'));

  return new Macaroon({
    identifier,
    location,
    signature,
    caveats
  });
};

/**
  Create a new Macaroon with the given root key, identifier, location
  and signature.
  @param {Object} The necessary values to generate a macaroon.
    It contains the following fields:
      identifier: {String}
      location:   {String} (optional)
      rootKey:    {Uint8Array}
  @return {Macaroon} The new macaroon
*/
const newMacaroon = function({identifier, location, rootKey} = {}) {
  return new Macaroon({
    identifier: requireString(identifier, 'Macaroon identifier'),
    location: maybeString(location, 'Macaroon location'),
    signature: keyedHash(
        makeKey(
          requireUint8Array(rootKey, 'Macaroon root key')),
          sjcl.codec.utf8String.toBits(identifier)),
    caveats: [],
  });
};

/**
  Gathers discharge macaroons for all third party caveats in the supplied
  macaroon (and any subsequent caveats required by those) calling getDischarge
  to acquire each discharge macaroon.
  @param {Macaroon} macaroon
  @param {Function} getDischarge is called with 5 arguments.
    macaroon.location {String}
    caveat.location {String}
    caveat.id {String}
    success {Function}
    failure {Function}
  @param {Function} onOk Called with an array argument holding the macaroon
    as the first element followed by all the discharge macaroons. All the
    discharge macaroons will be bound to the primary macaroon.
  @param {Function} onError Called if an error occurs during discharge.
*/
const dischargeMacaroon = function (macaroon, getDischarge, onOk, onError) {
  const primarySig = macaroon.signature;
  const discharges = [macaroon];
  let pendingCount = 0;
  let errorCalled = false;
  const firstPartyLocation = macaroon.location;
  let dischargeCaveats;
  const dischargedCallback = dm => {
    if (errorCalled) {
      return;
    }
    dm.bind(primarySig);
    discharges.push(dm);
    pendingCount--;
    dischargeCaveats(dm);
  };
  const dischargedErrorCallback = err => {
    if (!errorCalled) {
      onError(err);
      errorCalled = true;
    }
  };
  dischargeCaveats = m => {
    let cav, i;
    for (i = 0; i < m._caveats.length; i++) {
      cav = m._caveats[i];
      if (cav._vid === null) {
        continue;
      }
      getDischarge(
        firstPartyLocation,
        cav._location,
        cav._identifier,
        dischargedCallback,
        dischargedErrorCallback
      );
      pendingCount++;
    }
    if (pendingCount === 0) {
      onOk(discharges);
      return;
    }
  };
  dischargeCaveats(macaroon);
};

module.exports = {
  importFromJSONObject,
  newMacaroon,
  dischargeMacaroon,
  deserializeBinary
};
