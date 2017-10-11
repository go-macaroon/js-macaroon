'use strict';

const sjcl = require('sjcl');
const nacl = require('tweetnacl');
const textEncoding = require('text-encoding');
nacl.util = require('tweetnacl-util');
const utf8Encoder = new textEncoding.TextEncoder('utf-8');
const utf8Decoder = new textEncoding.TextDecoder('utf-8', {fatal: true});

const NONCELEN = 24;

const FIELD_EOS = 0;
const FIELD_LOCATION = 1;
const FIELD_IDENTIFIER = 2;
const FIELD_VID = 4;
const FIELD_SIGNATURE = 6;

/**
 * The maximum integer that can be manipulated with
 * JS bitwise operations.
 */
const maxInt = Math.pow(2, 32)-1;

const ByteBuffer = class ByteBuffer {
  /**
   * Create a new ByteBuffer. A ByteBuffer holds
   * a Uint8Array that it grows when written to.
   * @param {int} The initial capacity of the buffer.
   */
  constructor(capacity) {
    this._buf = new Uint8Array(capacity);
    this._length = 0;
  }
  /**
   * Append several bytes to the buffer.
   * @param {Uint8Array} The bytes to append.
   */
  appendBytes(bytes) {
    this._grow(this._length + bytes.length);
    this._buf.set(bytes, this._length);
    this._length += bytes.length;
  }
  /**
   * Append a single byte to the buffer.
   * @param {int} The byte to append
   */
  appendByte(byte) {
    this._grow(this._length + 1);
    this._buf[this._length] = byte;
    this._length++;
  }
  /**
   * Append a variable length integer to the buffer.
   * @param {int} The number to append.
   */
  appendUvarint(x) {
    if (x > maxInt || x < 0) {
      throw new RangeError(`varint ${x} out of range`);
    }
    this._grow(this._length + maxVarintLen32);
    var i = this._length;
    while(x >= 0x80) {
      this._buf[i++] = (x & 0xff) | 0x80;
      x >>>= 7;
    }
    this._buf[i++] = x | 0;
    this._length = i;
  }
  /**
   * Return everything that has been appended to the buffer.
   * Note that the returned array is shared with the internal buffer.
   * @return {Uint8Array} The buffer.
   */
  get bytes() {
    return this._buf.subarray(0, this._length);
  }
  /**
   * Grow the internal buffer so that it's at least as but as minCap.
   * @param {int} The minimum new capacity.
   */
  _grow(minCap) {
    if (minCap <= this._capacity) {
      return;
    }
    // TODO could use more intelligent logic to grow more slowly on large buffers.
    const doubleCap = this._buf.length * 2;
    const newCap = minCap > doubleCap ? minCap : doubleCap;
    const newContent = new Uint8Array(newCap);
    newContent.set(this._buf.subarray(0, this._length));
    this._buf = newContent;
  }
};

const maxVarintLen32 = 5;

const ByteReader = class ByteReader {
  /**
   * Create a new ByteReader that reads from the given buffer.
   * @param {Uint8Array} The buffer to read from.
   */
  constructor(bytes) {
    this._buf = bytes;
    this._index = 0;
  }
  /**
   * Read a byte from the buffer. If there are no bytes left in the
   * buffer, throws a RangeError exception.
   * @return {int} The read byte.
   */
  readByte() {
    if (this.length <= 0) {
      throw new RangeError('Read past end of buffer');
    }
    return this._buf[this._index++];
  }
  /**
   * Inspect the next byte without consuming it.
   * If there are no bytes left in the
   * buffer, throws a RangeError exception.
   * @return {int} The peeked byte.
   */
  peekByte() {
    if (this.length <= 0) {
      throw new RangeError('Read past end of buffer');
    }
    return this._buf[this._index];
  }
  /**
   * Read a number of bytes from the buffer.
   * If there are not enough bytes left in the buffer,
   * throws a RangeError exception.
   * @param {int} n The number of bytes to read.
   */
  readN(n) {
    if (this.length < n) {
      throw new RangeError('Read past end of buffer');
    }
    const bytes = this._buf.subarray(this._index, this._index + n);
    this._index += n;
    return bytes;
  }
  /**
   * Return the size of the buffer.
   * @return {int} The number of bytes left to read in the buffer.
   */
  get length() {
    return this._buf.length - this._index;
  }
  /**
   * Read a variable length integer from the buffer.
   * If there are not enough bytes left in the buffer
   * or the encoded integer is too big, throws a
   * RangeError exception.
   * @return {int} The number that's been read.
   */
  readUvarint() {
    const length = this._buf.length;
    var x = 0;
    var shift = 0;
    for(var i = this._index; i < length; i++) {
      const b = this._buf[i];
      if (b < 0x80) {
        const n = i - this._index;
        this._index = i+1;
        if (n > maxVarintLen32 || n === maxVarintLen32 && b > 1) {
          throw new RangeError('Overflow error decoding varint');
        }
        return (x | (b << shift)) >>> 0;
      }
      x |= (b & 0x7f) << shift;
      shift += 7;
    }
    this._index = length;
    throw new RangeError('Buffer too small decoding varint');
  }
};

/**
 * Convert a string to a Uint8Array by utf-8
 * encoding it.
 * @param {string} s The string to convert.
 * @return {Uint8Array} The resulting bytes.
 */
const stringToBytes = function(s) {
  if (s === null) {
    return null;
  }
  return utf8Encoder.encode(s);
};

/**
 * Convert a Uint8Array to a string by
 * utf-8 decoding it. Throws an exception if
 * the bytes do not represent well-formed utf-8.
 * @param {Uint8Array} The bytes to convert.
 * @return {string} The resulting string.
 */
const bytesToString = function(b) {
  if (b === null) {
    return null;
  }
  return utf8Decoder.decode(b);
};

/**
 * Return the Buffer base64-encoded using URL-safe encoding
 * without padding characters.
 * @param {Buffer} buf The bytes to encode.
 * @return {string} The base64-encoded bytes.
 */
const base64url = function(buf) {
  return Buffer.from(buf, 'base64')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

/**
  Converts a Uint8Array to a bitArray for use by nacl.
  @param {Uint8Array} arr The array to convert.
*/
function bytesToBitArray(arr) {
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
function hexToBytes(hex) {
  const arr = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return arr;
}

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

const emptyBytes = new Uint8Array();

/**
 * Read a macaroon V2 field from the buffer. If the
 * field does not have the expected type, throws an exception.
 * @param {ByteReader} buf The buffer to read from.
 * @param {int} expectFieldType The required field type.
 * @return {Uint8Array} The contents of the field.
 */
const readFieldV2 = function(buf, expectFieldType) {
  const fieldType = buf.readByte();
  if (fieldType !== expectFieldType) {
    throw new Error(`Unexpected field type, got ${fieldType} want ${expectFieldType}`);
  }
  if (fieldType === FIELD_EOS) {
    return emptyBytes;
  }
  return buf.readN(buf.readUvarint());
};

/**
 * Append a macaroon V2 field to the buffer.
 * @param {ByteBuffer} buf The buffer to append to.
 * @param {int} fieldType The type of the field.
 * @param {Uint8Array} data The content of the field.
 */
const appendFieldV2 = function(buf, fieldType, data) {
  buf.appendByte(fieldType);
  if (fieldType !== FIELD_EOS) {
    buf.appendUvarint(data.length);
    buf.appendBytes(data);
  }
};

/**
 * Read an optionally-present macaroon V2 field from the buffer.
 * If the field is not present, returns null.
 * @param {ByteReader} buf The buffer to read from.
 * @param {int} expectFieldType The expected field type.
 * @return {Uint8Array | null} The contents of the field, or null if not present.
 */
const readFieldV2Optional = function(buf, maybeFieldType) {
  if(buf.peekByte() !== maybeFieldType) {
    return null;
  }
  return readFieldV2(buf, maybeFieldType);
};

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

const keyGenerator = sjcl.codec.utf8String.toBits('macaroons-key-generator');

/**
  Generate a fixed length key for use as a nacl secretbox key.
  @param {Uint8Array} key The key to convert.
  @return {bitArray} sjcl compatibile bitArray.
*/
function makeKey(key) {
  const bitArray = bytesToBitArray(key);
  return keyedHash(keyGenerator, bitArray);
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
  return bytesToBitArray(ciphertext);
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
  return bytesToBitArray(text);
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
    if (verificationId) {
      caveat._location = requireString(location, 'Macaroon caveat location');
      caveat._vid = bytesToBitArray(
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
    sig = bytesToBitArray(sig);
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
      if (caveat._vid) {
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

  /**
   * (DEPRECATED)
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
        if (caveat._vid) {
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
    Returns the V2 JSON serialization of this macaroon.
    @return {Object} JSON serialization of this macaroon.
  */
  serializeJson() {
    const obj = {
      v: 2, // version
      i: this._identifier,
      s64: base64url(sjcl.codec.base64.fromBits(this._signature)),
    };
    if (this._location) {
      obj.l = this._location;
    }
    obj.c = this._caveats.map(caveat => {
      const caveatObj = {
        i: caveat._identifier
      };
      if (caveat._vid) {
        // Use URL encoding and do not append "=" characters.
        caveatObj.v64 = sjcl.codec.base64.fromBits(caveat._vid, true, true);
        caveatObj.l = caveat._location;
      }
      return caveatObj;
    });
    return obj;
  }

  /**
   * Serializes the macaroon using the v2 binary format.
   * @return {Uint8Array} Serialized macaroon
   */
  serializeBinary() {
    const buf = new ByteBuffer(100);
    buf.appendByte(2);
    if (this._location) {
      appendFieldV2(buf, FIELD_LOCATION, stringToBytes(this._location));
    }
    appendFieldV2(buf, FIELD_IDENTIFIER, stringToBytes(this._identifier));
    appendFieldV2(buf, FIELD_EOS);
    this._caveats.forEach(function(cav) {
      if (cav._location) {
        appendFieldV2(buf, FIELD_LOCATION, stringToBytes(cav._location));
      }
      appendFieldV2(buf, FIELD_IDENTIFIER, stringToBytes(cav._identifier));
      if (cav._vid) {
        appendFieldV2(buf, FIELD_VID, cav._vid);
      }
      appendFieldV2(buf, FIELD_EOS);
    });
    appendFieldV2(buf, FIELD_EOS);
    appendFieldV2(buf, FIELD_SIGNATURE, bitArrayToUint8Array(this._signature));
    return buf.bytes;
  };
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
    signature: bytesToBitArray(hexToBytes(obj.signature)),
    location: maybeString(obj.location, 'Macaroon location'),
    identifier: requireString(obj.identifier, 'Macaroon identifier'),
    caveats: caveats,
  });
};


function deserializeJsonField(obj, key, required) {
  if (obj.hasOwnProperty(key + '64')) {
    return sjcl.codec.base64.toBits(Buffer.from(obj[key + '64'], 'base64').toString('base64'));
  } else if (obj.hasOwnProperty(key)) {
    return obj[key];
  } else if (required) {
    throw new Error('Expected key: ' + key);
  } else {
    return null;
  }
}

/**
 * Deserializes V2 JSON macaroon encoding.
 * @param {Object|Array} obj A serialized JSON macaroon
 * @return {Macaroon}
*/
const deserializeJson = function(obj) {
  if (obj.v !== 2) {
    throw new Error('Only version 2 is supported');
  }
  const caveats = !Array.isArray(obj.c) || obj.c.length === 0 ?
    [] :
    obj.c.map(caveat => {
      return {
        _identifier: deserializeJsonField(caveat, 'i', true),
        _location: deserializeJsonField(caveat, 'l'),
        _vid: deserializeJsonField(caveat, 'v')
      };
    });
  return new Macaroon({
    signature: deserializeJsonField(obj, 's', true),
    location: deserializeJsonField(obj, 'l'),
    identifier: deserializeJsonField(obj, 'i', true),
    caveats: caveats,
  });
};

/**
 * Deserialize a macaroon from the v2 binary format
 * @param {Uint8Array} bytes, the serialized macaroon.
 * @return {Macaroon}
 */
const deserializeBinary = function(bytes) {
  const buf = new ByteReader(bytes);
  const version = buf.readByte();
  if (version !== 2) {
    throw new Error(`Only version 2 is supported, found version ${version}`);
  }
  const params = {};
  params.location = bytesToString(readFieldV2Optional(buf, FIELD_LOCATION));
  params.identifier = bytesToString(readFieldV2(buf, FIELD_IDENTIFIER));
  readFieldV2(buf, FIELD_EOS);
  params.caveats= [];
  for (;;) {
    if (readFieldV2Optional(buf, FIELD_EOS) !== null) {
      break;
    }
    const cav = {};
    cav._location = bytesToString(readFieldV2Optional(buf, FIELD_LOCATION));
    cav._identifier = bytesToString(readFieldV2(buf, FIELD_IDENTIFIER));
    cav._vid = readFieldV2Optional(buf, FIELD_VID);
    readFieldV2(buf, FIELD_EOS);
    params.caveats.push(cav);
  }
  params.signature = bytesToBitArray(readFieldV2(buf, FIELD_SIGNATURE));
  if (buf.length !== 0) {
    throw new Error('unexpected extra data at end of macaroon');
  }
  return new Macaroon(params);
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
  deserializeBinary,
  deserializeJson,
};
