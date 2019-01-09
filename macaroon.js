/**
 A JavaScript implementation of
 [macaroons](http://theory.stanford.edu/~ataly/Papers/macaroons.pdf)
 compatible with the [Go](http://github.com/go-macaroon/macaroon),
 [Python, and C ](https://github.com/rescrv/libmacaroons)
 implementations. Including functionality to interact with
 third party caveat dischargers implemented by the [Go macaroon
 bakery](http://github.com/go-macaroon-bakery/macaroon-bakery).
 It supports both version 1 and 2 macaroons in JSON and binary formats.
 @module macaroon
 */

'use strict';

const sjcl = require('sjcl');
const nacl = require('tweetnacl');
const naclutil = require('tweetnacl-util');

let TextEncoder, TextDecoder;
if (typeof window !== 'undefined' && window && window.TextEncoder) {
  TextEncoder = window.TextEncoder;
  TextDecoder = window.TextDecoder;
} else {
  // No window.TextEncoder if it's node.js.
  const util = require('util');
  TextEncoder = util.TextEncoder;
  TextDecoder = util.TextDecoder;
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', {fatal : true});

const NONCELEN = 24;

const FIELD_EOS = 0;
const FIELD_LOCATION = 1;
const FIELD_IDENTIFIER = 2;
const FIELD_VID = 4;
const FIELD_SIGNATURE = 6;

const maxInt = Math.pow(2, 32)-1;

/**
 * Return a form of x suitable for including in a error message.
 * @param {any} x The object to be converted to string form.
 * @returns {string} - The converted object.
 */
const toString = function(x) {
  if (x instanceof Array) {
    // Probably bitArray, try to convert it.
    try {x = bitsToBytes(x);} catch (e) {}
  }
  if (x instanceof Uint8Array) {
    if (isValidUTF8(x)) {
      x = bytesToString(x);
    } else {
      return `b64"${bytesToBase64(x)}"`;
    }
  }
  if (typeof x === 'string') {
    // TODO quote embedded double-quotes?
    return `"${x}"`;
  }
  return `type ${typeof x} (${JSON.stringify(x)})`;
};

const ByteBuffer = class ByteBuffer {
  /**
   * Create a new ByteBuffer. A ByteBuffer holds
   * a Uint8Array that it grows when written to.
   * @param {int} capacity The initial capacity of the buffer.
   */
  constructor(capacity) {
    this._buf = new Uint8Array(capacity);
    this._length = 0;
  }
  /**
   * Append several bytes to the buffer.
   * @param {Uint8Array} bytes The bytes to append.
   */
  appendBytes(bytes) {
    this._grow(this._length + bytes.length);
    this._buf.set(bytes, this._length);
    this._length += bytes.length;
  }
  /**
   * Append a single byte to the buffer.
   * @param {int} byte The byte to append
   */
  appendByte(byte) {
    this._grow(this._length + 1);
    this._buf[this._length] = byte;
    this._length++;
  }
  /**
   * Append a variable length integer to the buffer.
   * @param {int} x The number to append.
   */
  appendUvarint(x) {
    if (x > maxInt || x < 0) {
      throw new RangeError(`varint ${x} out of range`);
    }
    this._grow(this._length + maxVarintLen32);
    let i = this._length;
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
   * @returns {Uint8Array} - The buffer.
   */
  get bytes() {
    return this._buf.subarray(0, this._length);
  }
  /**
   * Grow the internal buffer so that it's at least as but as minCap.
   * @param {int} minCap The minimum new capacity.
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
   * @param {Uint8Array} bytes The buffer to read from.
   */
  constructor(bytes) {
    this._buf = bytes;
    this._index = 0;
  }
  /**
   * Read a byte from the buffer. If there are no bytes left in the
   * buffer, throws a RangeError exception.
   * @returns {int} - The read byte.
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
   * @returns {int} - The peeked byte.
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
   * @returns {int} - The number of bytes left to read in the buffer.
   */
  get length() {
    return this._buf.length - this._index;
  }
  /**
   * Read a variable length integer from the buffer.
   * If there are not enough bytes left in the buffer
   * or the encoded integer is too big, throws a
   * RangeError exception.
   * @returns {int} - The number that's been read.
   */
  readUvarint() {
    const length = this._buf.length;
    let x = 0;
    let shift = 0;
    for(let i = this._index; i < length; i++) {
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

const isValue = x => x !== undefined && x !== null;

/**
 * Convert a string to a Uint8Array by utf-8
 * encoding it.
 * @param {string} s The string to convert.
 * @returns {Uint8Array}
 */
const stringToBytes = s => isValue(s) ? utf8Encoder.encode(s) : s;

/**
 * Convert a Uint8Array to a string by
 * utf-8 decoding it. Throws an exception if
 * the bytes do not represent well-formed utf-8.
 * @param {Uint8Array} b The bytes to convert.
 * @returns {string}
 */
const bytesToString = b => isValue(b) ? utf8Decoder.decode(b) : b;

/**
 * Convert an sjcl bitArray to a string by
 * utf-8 decoding it. Throws an exception if
 * the bytes do not represent well-formed utf-8.
 * @param {bitArray} s The bytes to convert.
 * @returns {string}
 */
const bitsToString = s => sjcl.codec.utf8String.fromBits(s);

/**
 * Convert a base64 string to a Uint8Array by decoding it.
 * It copes with unpadded and URL-safe base64 encodings.
 * @param {string} s The base64 string to decode.
 * @returns {Uint8Array} - The decoded bytes.
 * @alias module:macaroon
 */
const base64ToBytes = function(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  if (s.length % 4 !== 0 && !s.match(/=$/)) {
    // Add the padding that's required by base64-js.
    s += '='.repeat(4 - s.length % 4);
  }
  return naclutil.decodeBase64(s);
};

/** Convert a Uint8Array to a base64-encoded string
 * using URL-safe, unpadded encoding.
 * @param {Uint8Array} bytes The bytes to encode.
 * @returns {string} - The base64-encoded result.
 * @alias module:macaroon
 */
const bytesToBase64 = function(bytes) {
  return naclutil.encodeBase64(bytes)
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

/**
  Converts a Uint8Array to a bitArray for use by nacl.
  @param {Uint8Array} arr The array to convert.
  @returns {bitArray} - The converted array.
*/
const bytesToBits = function(arr) {
  // See https://github.com/bitwiseshiftleft/sjcl/issues/344 for why
  // we cannot just use sjcl.codec.bytes.toBits.
  return sjcl.codec.base64.toBits(naclutil.encodeBase64(arr));
};

/**
  Converts a bitArray to a Uint8Array.
  @param {bitArray} arr The array to convert.
  @returns {Uint8Array} - The converted array.
*/
const bitsToBytes = function(arr) {
  // See https://github.com/bitwiseshiftleft/sjcl/issues/344 for why
  // we cannot just use sjcl.codec.bytes.toBits.
  return naclutil.decodeBase64(sjcl.codec.base64.fromBits(arr));
};

/**
  Converts a hex to Uint8Array
  @param {String} hex The hex value to convert.
  @returns {Uint8Array}
*/
const hexToBytes = function(hex) {
  const arr = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return arr;
};

/**
 * Report whether the argument encodes a valid utf-8 string.
 * @param {Uint8Array} bytes The bytes to check.
 * @returns {boolean} - True if the bytes are valid utf-8.
 */
const isValidUTF8 = function(bytes) {
  try {
    bytesToString(bytes);
  } catch (e) {
    // While https://encoding.spec.whatwg.org states that the
    // exception should be a TypeError, we'll be defensive here
    // and just treat any exception as signifying invalid utf-8.
    return false;
  }
  return true;
};

/**
  Check that supplied value is a string and return it. Throws an
  error including the provided label if not.
  @param {String} val The value to assert as a string
  @param {String} label The value label.
  @returns {String} - The supplied value.
*/
const requireString = function(val, label) {
  if (typeof val !== 'string') {
    throw new TypeError(`${label} has the wrong type; want string, got ${typeof val}.`);
  }
  return val;
};

/**
  Check that supplied value is a string or undefined or null. Throws
  an error including the provided label if not. Always returns a string
  (the empty string if undefined or null).

  @param {(String | null)} val The value to assert as a string
  @param {String} label The value label.
  @returns {String} - The supplied value or an empty string.
*/
const maybeString = (val, label) => isValue(val) ? requireString(val, label) : '';

/**
  Check that supplied value is a Uint8Array or a string.
  Throws an error
  including the provided label if not.
  @param {(Uint8Array | string)} val The value to assert as a Uint8Array
  @param {string} label The value label.
  @returns {Uint8Array} - The supplied value, utf-8-encoded if it was a string.
*/
const requireBytes = function(val, label) {
  if (val instanceof Uint8Array) {
    return val;
  }
  if (typeof(val) === 'string') {
    return stringToBytes(val);
  }
  throw new TypeError(`${label} has the wrong type; want string or Uint8Array, got ${typeof val}.`);
};

const emptyBytes = new Uint8Array();

/**
 * Read a macaroon V2 field from the buffer. If the
 * field does not have the expected type, throws an exception.
 * @param {ByteReader} buf The buffer to read from.
 * @param {int} expectFieldType The required field type.
 * @returns {Uint8Array} - The contents of the field.
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
 * @param {int} maybeFieldType The expected field type.
 * @returns {Uint8Array | null} - The contents of the field, or null if not present.
 */
const readFieldV2Optional = function(buf, maybeFieldType) {
  if (buf.peekByte() !== maybeFieldType) {
    return null;
  }
  return readFieldV2(buf, maybeFieldType);
};

/**
 * Sets a field in a V2 encoded JSON object.
 * @param {Object} obj The JSON object.
 * @param {string} key The key to set.
 * @param {Uint8Array} valBytes The key's value.
 */
const setJSONFieldV2 = function(obj, key, valBytes) {
  if (isValidUTF8(valBytes)) {
    obj[key] = bytesToString(valBytes);
  } else {
    obj[key + '64'] = bytesToBase64(valBytes);
  }
};

/**
  Generate a hash using the supplied data.
  @param {bitArray} keyBits
  @param {bitArray} dataBits
  @returns {bitArray} - The keyed hash of the supplied data as a sjcl bitArray.
*/
const keyedHash = function(keyBits, dataBits) {
  const hash = new sjcl.misc.hmac(keyBits, sjcl.hash.sha256);
  hash.update(dataBits);
  return hash.digest();
};

/**
  Generate a hash keyed with key of both data objects.
  @param {bitArray} keyBits
  @param {bitArray} d1Bits
  @param {bitArray} d2Bits
  @returns {bitArray} - The keyed hash of d1 and d2 as a sjcl bitArray.
*/
const keyedHash2 = function(keyBits, d1Bits, d2Bits) {
  const h1Bits = keyedHash(keyBits, d1Bits);
  const h2Bits = keyedHash(keyBits, d2Bits);
  return keyedHash(keyBits, sjcl.bitArray.concat(h1Bits, h2Bits));
};

const keyGeneratorBits = bytesToBits(stringToBytes('macaroons-key-generator'));

/**
  Generate a fixed length key for use as a nacl secretbox key.
  @param {bitArray} keyBits The key to convert.
  @returns {bitArray}
*/
const makeKey = function(keyBits) {
  return keyedHash(keyGeneratorBits, keyBits);
};

/**
  Generate a random nonce as Uint8Array.
  @returns {Uint8Array}
*/
const newNonce = function() {
  return nacl.randomBytes(NONCELEN);
};

/**
  Encrypt the given plaintext with the given key.
  @param {bitArray} keyBits encryption key.
  @param {bitArray} textBits plaintext.
  @returns {bitArray} - encrypted text.
*/
const encrypt = function(keyBits, textBits) {
  const keyBytes = bitsToBytes(keyBits);
  const textBytes = bitsToBytes(textBits);
  const nonceBytes = newNonce();
  const dataBytes = nacl.secretbox(textBytes, nonceBytes, keyBytes);
  const ciphertextBytes = new Uint8Array(nonceBytes.length + dataBytes.length);
  ciphertextBytes.set(nonceBytes, 0);
  ciphertextBytes.set(dataBytes, nonceBytes.length);
  return bytesToBits(ciphertextBytes);
};

/**
  Decrypts the given cyphertext.
  @param {bitArray} keyBits decryption key.
  @param {bitArray} ciphertextBits encrypted text.
  @returns {bitArray} - decrypted text.
*/
const decrypt = function(keyBits, ciphertextBits) {
  const keyBytes = bitsToBytes(keyBits);
  const ciphertextBytes = bitsToBytes(ciphertextBits);
  const nonceBytes = ciphertextBytes.slice(0, NONCELEN);
  const dataBytes = ciphertextBytes.slice(NONCELEN);
  let textBytes = nacl.secretbox.open(dataBytes, nonceBytes, keyBytes);
  if (!textBytes) {
    throw new Error('decryption failed');
  }
  return bytesToBits(textBytes);
};

const zeroKeyBits = bytesToBits(stringToBytes('\0'.repeat(32)));

/**
  Bind a given macaroon to the given signature of its parent macaroon. If the
  keys already match then it will return the rootSig.
  @param {bitArray} rootSigBits
  @param {bitArray} dischargeSigBits
  @returns {bitArray} - The bound macaroon signature.
*/
const bindForRequest = function(rootSigBits, dischargeSigBits) {
  if (sjcl.bitArray.equal(rootSigBits, dischargeSigBits)) {
    return rootSigBits;
  }
  return keyedHash2(zeroKeyBits, rootSigBits, dischargeSigBits);
};

const Macaroon = class Macaroon {
  /**
    Create a new Macaroon with the given root key, identifier, location
    and signature.
    @param {Object} params The necessary values to generate a macaroon.
      It contains the following fields:
        identifierBytes: {Uint8Array}
        locationStr:   {string}
        caveats:    {Array of {locationStr: string, identifierBytes: Uint8Array, vidBytes: Uint8Array}}
        signatureBytes:  {Uint8Array}
        version: {int} The version of macaroon to create.
  */
  constructor(params) {
    if (!params) {
      // clone uses null parameters.
      return;
    }
    let {version, identifierBytes, locationStr, caveats, signatureBytes} = params;
    if (version !== 1 && version !== 2) {
      throw new Error(`Unexpected version ${version}`);
    }
    this._version = version;
    this._locationStr = locationStr;
    identifierBytes = requireBytes(identifierBytes, 'Identifier');
    if (version === 1 && !isValidUTF8(identifierBytes)) {
      throw new Error('Version 1 macaroon identifier must be well-formed UTF-8');
    }
    this._identifierBits = identifierBytes && bytesToBits(identifierBytes);
    this._signatureBits = signatureBytes && bytesToBits(requireBytes(signatureBytes, 'Signature'));
    this._caveats = caveats ? caveats.map(cav => {
      const identifierBytes = requireBytes(cav.identifierBytes, 'Caveat identifier');
      if (version === 1 && !isValidUTF8(identifierBytes)) {
        throw new Error('Version 1 caveat identifier must be well-formed UTF-8');
      }
      return {
        _locationStr: maybeString(cav.locationStr),
        _identifierBits: bytesToBits(identifierBytes),
        _vidBits: cav.vidBytes && bytesToBits(requireBytes(cav.vidBytes, 'Verification ID')),
      };
    }) : [];
  }

  /**
   * Return the caveats associated with the macaroon,
   * as an array of caveats. A caveat is represented
   * as an object with an identifier field (Uint8Array)
   * and (for third party caveats) a location field (string),
   * and verification id (Uint8Array).
   * @returns {Array} - The macaroon's caveats.
   * @alias module:macaroon
   */
  get caveats() {
    return this._caveats.map(cav => {
      return isValue(cav._vidBits) ? {
        identifier: bitsToBytes(cav._identifierBits),
        location: cav._locationStr,
        vid: bitsToBytes(cav._vidBits),
      } : {
        identifier: bitsToBytes(cav._identifierBits),
      };
    });
  }

  /**
   * Return the location of the macaroon.
   * @returns {string} - The macaroon's location.
   * @alias module:macaroon
   */
  get location() {
    return this._locationStr;
  }

  /**
   * Return the macaroon's identifier.
   * @returns {Uint8Array} - The macaroon's identifier.
   * @alias module:macaroon
   */
  get identifier() {
    return bitsToBytes(this._identifierBits);
  }

  /**
   * Return the signature of the macaroon.
   * @returns {Uint8Array} - The macaroon's signature.
   * @alias module:macaroon
   */
  get signature() {
    return bitsToBytes(this._signatureBits);
  }

  /**
    Adds a third party caveat to the macaroon. Using the given shared root key,
    caveat id and location hint. The caveat id should encode the root key in
    some way, either by encrypting it with a key known to the third party or by
    holding a reference to it stored in the third party's storage.
    @param {Uint8Array} rootKeyBytes
    @param {(Uint8Array | string)} caveatIdBytes
    @param {String} [locationStr]
    @alias module:macaroon
  */
  addThirdPartyCaveat(rootKeyBytes, caveatIdBytes, locationStr) {
    const cav = {
      _identifierBits: bytesToBits(requireBytes(caveatIdBytes, 'Caveat id')),
      _vidBits: encrypt(
        this._signatureBits,
        makeKey(bytesToBits(requireBytes(rootKeyBytes, 'Caveat root key')))),
      _locationStr: maybeString(locationStr),
    };
    this._signatureBits = keyedHash2(
      this._signatureBits,
      cav._vidBits,
      cav._identifierBits
    );
    this._caveats.push(cav);
  }

  /**
    Adds a caveat that will be verified by the target service.
    @param {String | Uint8Array} caveatIdBytes
    @alias module:macaroon
  */
  addFirstPartyCaveat(caveatIdBytes) {
    const identifierBits = bytesToBits(requireBytes(caveatIdBytes, 'Condition'));
    this._caveats.push({
      _identifierBits: identifierBits,
    });
    this._signatureBits = keyedHash(this._signatureBits, identifierBits);
  }

  /**
    Binds the macaroon signature to the given root signature.
    This must be called on discharge macaroons with the primary
    macaroon's signature before sending the macaroons in a request.
    @param {Uint8Array} rootSig
    @alias module:macaroon
  */
  bindToRoot(rootSig) {
    const rootSigBits = bytesToBits(requireBytes(rootSig, 'Primary macaroon signature'));
    this._signatureBits = bindForRequest(rootSigBits, this._signatureBits);
  }

  /**
    Returns a copy of the macaroon. Any caveats added to the returned macaroon
    will not effect the original.
    @returns {Macaroon} - The cloned macaroon.
    @alias module:macaroon
  */
  clone() {
    const m = new Macaroon(null);
    m._version = this._version;
    m._signatureBits = this._signatureBits;
    m._identifierBits = this._identifierBits;
    m._locationStr = this._locationStr;
    m._caveats = this._caveats.slice();
    return m;
  }

  /**
    Verifies that the macaroon is valid. Throws exception if verification fails.
    @param {Uint8Array} rootKeyBytes Must be the same that the macaroon was
      originally created with.
    @param {Function} check Called to verify each first-party caveat. It
      is passed the condition to check (a string) and should return an error string if the condition
      is not met, or null if satisfied.
    @param {Array} discharges
    @alias module:macaroon
  */
  verify(rootKeyBytes, check, discharges = []) {
    const rootKeyBits = makeKey(bytesToBits(requireBytes(rootKeyBytes, 'Root key')));
    const used = discharges.map(d => 0);

    this._verify(this._signatureBits, rootKeyBits, check, discharges, used);

    discharges.forEach((dm, i) => {
      if (used[i] === 0) {
        throw new Error(
          `discharge macaroon ${toString(dm.identifier)} was not used`);
      }
      if (used[i] !== 1) {
        // Should be impossible because of check in verify, but be defensive.
        throw new Error(
          `discharge macaroon ${toString(dm.identifier)} was used more than once`);
      }
    });
  }

  _verify(rootSigBits, rootKeyBits, check, discharges, used) {
    let caveatSigBits = keyedHash(rootKeyBits, this._identifierBits);
    this._caveats.forEach(caveat => {
      if (caveat._vidBits) {
        const cavKeyBits = decrypt(caveatSigBits, caveat._vidBits);
        let found = false;
        let di, dm;
        for (di = 0; di < discharges.length; di++) {
          dm = discharges[di];
          if (!sjcl.bitArray.equal(dm._identifierBits, caveat._identifierBits)) {
            continue;
          }
          found = true;
          // It's important that we do this before calling _verify,
          // as it prevents potentially infinite recursion.
          used[di]++;
          if (used[di] > 1) {
            throw new Error(
              `discharge macaroon ${toString(dm.identifier)} was used more than once`);
          }
          dm._verify(rootSigBits, cavKeyBits, check, discharges, used);
          break;
        }
        if (!found) {
          throw new Error(
            `cannot find discharge macaroon for caveat ${toString(caveat._identifierBits)}`);
        }
        caveatSigBits = keyedHash2(caveatSigBits, caveat._vidBits, caveat._identifierBits);
      } else {
        const cond = bitsToString(caveat._identifierBits);
        const err = check(cond);
        if (err) {
          throw new Error(`caveat check failed (${cond}): ${err}`);
        }
        caveatSigBits = keyedHash(caveatSigBits, caveat._identifierBits);
      }
    });
    const boundSigBits = bindForRequest(rootSigBits, caveatSigBits);
    if (!sjcl.bitArray.equal(boundSigBits, this._signatureBits)) {
      throw new Error('signature mismatch after caveat verification');
    }
  }


  /**
  Exports the macaroon to a JSON-serializable object.
  The version used depends on what version the
  macaroon was created with or imported from.
  @returns {Object}
  @alias module:macaroon
  */
  exportJSON() {
    switch (this._version) {
      case 1:
        return this._exportAsJSONObjectV1();
      case 2:
        return this._exportAsJSONObjectV2();
      default:
        throw new Error(`unexpected macaroon version ${this._version}`);
    }
  }

  /**
    Returns a JSON compatible object representation of this version 1 macaroon.
    @returns {Object} - JSON compatible representation of this macaroon.
  */
  _exportAsJSONObjectV1() {
    const obj = {
      identifier: bitsToString(this._identifierBits),
      signature: sjcl.codec.hex.fromBits(this._signatureBits),
    };
    if (this._locationStr) {
      obj.location = this._locationStr;
    }
    if (this._caveats.length > 0) {
      obj.caveats = this._caveats.map(caveat => {
        const caveatObj = {
          cid: bitsToString(caveat._identifierBits),
        };
        if (caveat._vidBits) {
          // Use URL encoding and do not append "=" characters.
          caveatObj.vid = sjcl.codec.base64.fromBits(caveat._vidBits, true, true);
          caveatObj.cl = caveat._locationStr;
        }
        return caveatObj;
      });
    }
    return obj;
  }

  /**
    Returns the V2 JSON serialization of this macaroon.
    @returns {Object} - JSON compatible representation of this macaroon.
  */
  _exportAsJSONObjectV2() {
    const obj = {
      v: 2, // version
    };
    setJSONFieldV2(obj, 's', bitsToBytes(this._signatureBits));
    setJSONFieldV2(obj, 'i', bitsToBytes(this._identifierBits));
    if (this._locationStr) {
      obj.l = this._locationStr;
    }
    if (this._caveats && this._caveats.length > 0) {
      obj.c = this._caveats.map(caveat => {
        const caveatObj = {};
        setJSONFieldV2(caveatObj, 'i', bitsToBytes(caveat._identifierBits));
        if (caveat._vidBits) {
          setJSONFieldV2(caveatObj, 'v', bitsToBytes(caveat._vidBits));
          caveatObj.l = caveat._locationStr;
        }
        return caveatObj;
      });
    }
    return obj;
  }

  /**
   * Exports the macaroon using the v1 binary format.
   * @returns {Uint8Array} - Serialized macaroon
   */
  _exportBinaryV1() {
    throw new Error('V1 binary export not supported');
  };

  /**
   Exports the macaroon using the v2 binary format.
   @returns {Uint8Array} - Serialized macaroon
  */
  _exportBinaryV2() {
    const buf = new ByteBuffer(200);
    buf.appendByte(2);
    if (this._locationStr) {
      appendFieldV2(buf, FIELD_LOCATION, stringToBytes(this._locationStr));
    }
    appendFieldV2(buf, FIELD_IDENTIFIER, bitsToBytes(this._identifierBits));
    appendFieldV2(buf, FIELD_EOS);
    this._caveats.forEach(function(cav) {
      if (cav._locationStr) {
        appendFieldV2(buf, FIELD_LOCATION, stringToBytes(cav._locationStr));
      }
      appendFieldV2(buf, FIELD_IDENTIFIER, bitsToBytes(cav._identifierBits));
      if (cav._vidBits) {
        appendFieldV2(buf, FIELD_VID, bitsToBytes(cav._vidBits));
      }
      appendFieldV2(buf, FIELD_EOS);
    });
    appendFieldV2(buf, FIELD_EOS);
    appendFieldV2(buf, FIELD_SIGNATURE, bitsToBytes(this._signatureBits));
    return buf.bytes;
  };

  /**
  Exports the macaroon using binary format.
  The version will be the same as the version that the
  macaroon was created with or imported from.
  @returns {Uint8Array}
  @alias module:macaroon
  */
  exportBinary() {
    switch (this._version) {
      case 1:
        return this._exportBinaryV1();
      case 2:
        return this._exportBinaryV2();
      default:
        throw new Error(`unexpected macaroon version ${this._version}`);
    }
  };
};

/**
  Returns a macaroon instance based on the object passed in.
  If obj is a string, it is assumed to be a base64-encoded
  macaroon in binary or JSON format.
  If obj is a Uint8Array, it is assumed to be a macaroon in
  binary format, as produced by the exportBinary method.
  Otherwise obj is assumed to be a object decoded from JSON,
  and will be unmarshaled as such.
  @param obj A deserialized JSON macaroon.
  @returns {Macaroon | Macaroon[]}
  @alias module:macaroon
*/
const importMacaroon = function(obj) {
  if (typeof obj === 'string') {
    obj = base64ToBytes(obj);
  }
  if (obj instanceof Uint8Array) {
    const buf = new ByteReader(obj);
    const m = importBinary(buf);
    if (buf.length !== 0) {
      throw new TypeError('extra data found at end of serialized macaroon');
    }
    return m;
  }
  if (Array.isArray(obj)) {
    throw new TypeError('cannot import an array of macaroons as a single macaroon');
  }
  return importJSON(obj);
};

/**
  Returns an array of macaroon instances based on the object passed in.
  If obj is a string, it is assumed to be a set of base64-encoded
  macaroons in binary or JSON format.
  If obj is a Uint8Array, it is assumed to be set of macaroons in
  binary format, as produced by the exportBinary method.
  If obj is an array, it is assumed to be an array of macaroon
  objects decoded from JSON.
  Otherwise obj is assumed to be a macaroon object decoded from JSON.

  This function accepts a strict superset of the formats accepted
  by importMacaroons. When decoding a single macaroon,
  it will return an array with one macaroon element.

  @param obj A deserialized JSON macaroon or macaroons.
  @returns {Macaroon[]}
  @alias module:macaroon
*/
const importMacaroons = function(obj) {
  if (typeof obj === 'string') {
    obj = base64ToBytes(obj);
  }
  if (obj instanceof Uint8Array) {
    if (obj.length === 0) {
      throw new TypeError('empty macaroon data');
    }
    const buf = new ByteReader(obj);
    const ms = [];
    do {
      ms.push(importBinary(buf));
    } while (buf.length > 0);
    return ms;
  }
  if (Array.isArray(obj)) {
    return obj.map(val => importJSON(val));
  }
  return [importJSON(obj)];
};

/**
  Returns a macaroon instance imported from a JSON-decoded object.
  @param {object} obj The JSON to import from.
  @returns {Macaroon}
 */
const importJSON = function(obj) {
  if (isValue(obj.signature)) {
    // Looks like a V1 macaroon.
    return importJSONV1(obj);
  }
  return importJSONV2(obj);
};

const importJSONV1 = function(obj) {
  const caveats = obj.caveats && obj.caveats.map(jsonCaveat => {
    const caveat = {
      identifierBytes: stringToBytes(requireString(jsonCaveat.cid, 'Caveat id')),
      locationStr: maybeString(jsonCaveat.cl, 'Caveat location'),
    };
    if (jsonCaveat.vid) {
      caveat.vidBytes = base64ToBytes(requireString(jsonCaveat.vid, 'Caveat verification id'));
    }
    return caveat;
  });
  return new Macaroon({
    version: 1,
    locationStr: maybeString(obj.location, 'Macaroon location'),
    identifierBytes: stringToBytes(requireString(obj.identifier, 'Macaroon identifier')),
    caveats: caveats,
    signatureBytes: hexToBytes(obj.signature),
  });
};

/**
 * Imports V2 JSON macaroon encoding.
 * @param {Object|Array} obj A serialized JSON macaroon
 * @returns {Macaroon}
*/
const importJSONV2 = function(obj) {
  // The Go macaroon library omits the version, so we'll assume that
  // it is 2 in that case. See https://github.com/go-macaroon/macaroon/issues/35
  if (obj.v !== 2 && obj.v !== undefined) {
    throw new Error(`Unsupported macaroon version ${obj.v}`);
  }
  const params = {
    version: 2,
    signatureBytes: v2JSONField(obj, 's', true),
    locationStr: bytesToString(v2JSONField(obj, 'l', false)),
    identifierBytes: v2JSONField(obj, 'i', true),
  };
  if (obj.c) {
    if (!Array.isArray(obj.c)) {
      throw new Error('caveats field does not hold an array');
    }
    params.caveats = obj.c.map(caveat => {
      return {
        identifierBytes: v2JSONField(caveat, 'i', true),
        locationStr: bytesToString(v2JSONField(caveat, 'l'), false),
        vidBytes: v2JSONField(caveat, 'v', false)
      };
    });
  }
  return new Macaroon(params);
};

/**
 * Read a JSON field that might be in base64 or string
 * format.
 * @param {Object} obj A deserialized JSON object.
 * @param {string} key The key name.
 * @param {boolean} required Whether the key is required to exist.
 * @returns {Uint8Array} - The value of the key (or null if not present).
 */
const v2JSONField = function(obj, key, required) {
  if (obj.hasOwnProperty(key)) {
    return stringToBytes(obj[key]);
  }
  const key64 = key + '64';
  if (obj.hasOwnProperty(key64)) {
    return base64ToBytes(obj[key64]);
  }
  if (required) {
    throw new Error('Expected key: ' + key);
  }
  return null;
};

/**
 * Import a macaroon from the v2 binary format
 * @param {ByteReader} buf A buffer holding the serialized macaroon.
 * @returns {Macaroon}
 */
const importBinaryV2 = function(buf) {
  const version = buf.readByte();
  if (version !== 2) {
    throw new Error(`Only version 2 is supported, found version ${version}`);
  }
  const params = {
    version: version,
  };
  params.locationStr = bytesToString(readFieldV2Optional(buf, FIELD_LOCATION));
  params.identifierBytes = readFieldV2(buf, FIELD_IDENTIFIER);
  readFieldV2(buf, FIELD_EOS);
  params.caveats= [];
  for (;;) {
    if (readFieldV2Optional(buf, FIELD_EOS)) {
      break;
    }
    const cav = {};
    cav.locationStr = bytesToString(readFieldV2Optional(buf, FIELD_LOCATION));
    cav.identifierBytes = readFieldV2(buf, FIELD_IDENTIFIER);
    cav.vidBytes = readFieldV2Optional(buf, FIELD_VID);
    readFieldV2(buf, FIELD_EOS);
    params.caveats.push(cav);
  }
  params.signatureBytes = readFieldV2(buf, FIELD_SIGNATURE);
  if (buf.length !== 0) {
    throw new Error('unexpected extra data at end of macaroon');
  }
  return new Macaroon(params);
};

const isASCIIHex = function(charCode) {
  return (48 <= charCode && charCode <= 58) || (97 <= charCode && charCode <= 102);
};

/**
 * Import a macaroon from binary format (currently only supports V2 format).
 * @param {Uint8Array} buf The serialized macaroon.
 */
const importBinary = function(buf) {
  if (buf.length === 0) {
    throw new Error('Empty macaroon data');
  }
  const version = buf.peekByte();
  if (version === 2) {
    return importBinaryV2(buf);
  }
  if (isASCIIHex(version)) {
    // It's a hex digit - version 1 binary format.
    throw new Error('Version 1 binary format not supported');
  }
  throw new Error('Cannot determine data format of binary-encoded macaroon');
};

/**
  Create a new Macaroon with the given root key, identifier, location
  and signature and return it.
  @param {Object} - The necessary values to generate a macaroon.
    It contains the following fields:
      identifier: {String | Uint8Array}
      location:   {String} (optional)
      rootKey:    {String | Uint8Array}
      version: {int} (optional; defaults to 2).
  @returns {Macaroon}
  @alias module:macaroon
*/
const newMacaroon = function({identifier, location, rootKey, version} = {}) {
  const identifierBytes = requireBytes(identifier, 'Macaroon identifier');
  const rootKeyBytes = requireBytes(rootKey, 'Macaroon root key');
  return new Macaroon({
    version: version === undefined ? 2 : version,
    identifierBytes: identifierBytes,
    locationStr: maybeString(location, 'Macaroon location'),
    signatureBytes: bitsToBytes(keyedHash(
      makeKey(bytesToBits(rootKeyBytes)),
      bytesToBits(identifierBytes))),
  });
};

/**
  Gathers discharge macaroons for all third party caveats in the supplied
  macaroon (and any subsequent caveats required by those) calling getDischarge
  to acquire each discharge macaroon.
  @param {Macaroon} macaroon - The macaroon to discharge.
  @param {Function} getDischarge - Called with 5 arguments.
    macaroon.location {String}
    caveat.location {String}
    caveat.id {String}
    success {Function}
    failure {Function}
  @param {Function} onOk - Called with an array argument holding the macaroon
    as the first element followed by all the discharge macaroons. All the
    discharge macaroons will be bound to the primary macaroon.
  @param {Function} onError - Called if an error occurs during discharge.
  @alias module:macaroon
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
    dm.bindToRoot(primarySig);
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
      if (!cav._vidBits) {
        continue;
      }
      getDischarge(
        firstPartyLocation,
        cav._locationStr,
        bitsToBytes(cav._identifierBits),
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
  newMacaroon,
  dischargeMacaroon,
  importMacaroons,
  importMacaroon,
  bytesToBase64: bytesToBase64,
  base64ToBytes: base64ToBytes,
};
