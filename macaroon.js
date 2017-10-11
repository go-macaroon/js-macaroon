'use strict';

const sjcl = require('sjcl');
const nacl = require('tweetnacl');
const naclutil = require('tweetnacl-util');
const textEncoding = require('text-encoding');
const utf8Encoder = new textEncoding.TextEncoder('utf-8');
const utf8Decoder = new textEncoding.TextDecoder('utf-8', {fatal: true});

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
 * @return {string} The converted object.
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
const stringToBytes = s => s && utf8Encoder.encode(s);

/**
 * Convert a Uint8Array to a string by
 * utf-8 decoding it. Throws an exception if
 * the bytes do not represent well-formed utf-8.
 * @param {Uint8Array} The bytes to convert.
 * @return {string} The resulting string.
 */
const bytesToString = b => b && utf8Decoder.decode(b);

/**
 * Convert an sjcl bitArray to a string by
 * utf-8 decoding it. Throws an exception if
 * the bytes do not represent well-formed utf-8.
 * @param {bitArray} The bytes to convert.
 * @return {string} The resulting string.
 */
const bitsToString = s => sjcl.codec.utf8String.fromBits(s);

/**
 * Convert a base64 string to a Uint8Array by decoding it.
 * It copes with unpadded and URL-safe base64 encodings.
 * @param {string} s The base64 string to decode.
 * @return {Uint8Array} The decoded bytes.
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
 * @return {string} The base64-encoded result.
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
*/
const bytesToBits = function(arr) {
  // See https://github.com/bitwiseshiftleft/sjcl/issues/344 for why
  // we cannot just use sjcl.codec.bytes.toBits.
  return sjcl.codec.base64.toBits(naclutil.encodeBase64(arr));
};

/**
  Converts a bitArray to a Uint8Array.
  @param {bitArray} arr The array to convert.
*/
const bitsToBytes = function(arr) {
  // See https://github.com/bitwiseshiftleft/sjcl/issues/344 for why
  // we cannot just use sjcl.codec.bytes.toBits.
  return naclutil.decodeBase64(sjcl.codec.base64.fromBits(arr));
};

/**
  Converts a hex to Uint8Array
  @param {String} hex The hex value to convert.
  @return {Uint8Array} The resulting array.
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
 * @param {Uint8Array} The bytes to check.
 * @return {bool} True if the bytes are valid utf-8.
 */
const isValidUTF8 = function(bytes) {
  try {
    bytesToString(bytes);
  } catch (e) {
    return false;
  }
  return true;
};

/**
  Check that supplied value is a string and return it. Throws an
  error including the provided label if not.
  @param {String} val The value to assert as a string
  @param {String} label The value label.
  @return {String} The supplied value.
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
  @return {String} The supplied value or an empty string.
*/
const maybeString = function(val, label) {
  if (val === undefined || val === null) {
    return '';
  }
  return requireString(val, label);
};

/**
  Check that supplied value is a Uint8Array or a string.
  Throws an error
  including the provided label if not.
  @param {Uint8Array | string} val The value to assert as a Uint8Array
  @param {string} label The value label.
  @return {Uint8Array} The supplied value, utf-8-encoded if it was a string.
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
  @param {bitArray} key
  @param {bitArray} data
  @return {bitArray} The keyed hash of the supplied data as a sjcl bitArray.
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
  @return {bitArray} The keyed hash of d1 and d2 as a sjcl bitArray.
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
  @return {bitArray} sjcl bitArray.
*/
const makeKey = function(keyBits) {
  return keyedHash(keyGeneratorBits, keyBits);
};

/**
  Generate a random nonce as Uint8Array.
  @return {Uint8Array} nonce.
*/
const newNonce = function() {
  return nacl.randomBytes(NONCELEN);
};

/**
  Encrypt the given plaintext with the given key.
  @param {bitArray} keyBits encryption key.
  @param {bitArray} textBits plaintext.
  @return {bitArray} encrypted text.
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
  @return {bitArray} decrypted text.
*/
const decrypt = function(keyBits, ciphertextBits) {
  const keyBytes = bitsToBytes(keyBits);
  const ciphertextBytes = bitsToBytes(ciphertextBits);
  const nonceBytes = ciphertextBytes.slice(0, NONCELEN);
  const dataBytes = ciphertextBytes.slice(NONCELEN);
  var textBytes = nacl.secretbox.open(dataBytes, nonceBytes, keyBytes);
  if (textBytes === false) {
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
  @return {bitArray} The bound macaroon signature.
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
    @param {Object} The necessary values to generate a macaroon.
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
    var {version, identifierBytes, locationStr, caveats, signatureBytes} = params;
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
   * @return {Array} The macaroon's caveats.
   */
  get caveats() {
    if (!this._caveats) {
      return [];
    }
    return this._caveats.map(cav => {
      return cav._vidBits ? {
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
   * @return {string} The macaroon's location.
   */
  get location() {
    return this._locationStr;
  }

  /**
   * Return the macaroon's identifier.
   * @return {Uint8Array} The macaroon's identifier.
   */
  get identifier() {
    return bitsToBytes(this._identifierBits);
  }

  /**
   * Return the signature of the macaroon.
   * @return {string} The macaroon's signature.
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
    @param {Uint8Array | string} caveatIdBytes
    @param {optional String} locationStr
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
    @param {String | Uint8Array} caveatId
  */
  addFirstPartyCaveat(caveatIdBytes) {
    const identifierBits = bytesToBits(requireBytes(caveatIdBytes, 'Condition'));
    this._caveats.push({
      _identifierBits: identifierBits,
    });
    this._signatureBits = keyedHash(this._signatureBits, identifierBits);
  }

  /**
    Sets the macaroon signature to one bound to the given root signature.
    This must be called on discharge macaroons with the primary
    macaroon's signature before sending the macaroons in a request.
    @param {Uint8Array} rootSig
  */
  bind(rootSig) {
    const rootSigBits = bytesToBits(requireBytes(rootSig, 'Primary macaroon signature'));
    this._signatureBits = bindForRequest(rootSigBits, this._signatureBits);
  }

  /**
    Returns a copy of the macaroon. Any caveats added to the returned macaroon
    will not effect the original.
    @return {Macaroon} The cloned macaroon.
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

  exportAsJSONObject() {
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
    @return {Object} JSON compatible representation of this macaroon.
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
    @return {Object} JSON compatible representation of this macaroon.
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
   * Serializes the macaroon using the v1 binary format.
   * @return {Uint8Array} Serialized macaroon
   */
  _serializeBinaryV2() {
    throw new Error('V1 binary serialization not supported');
  };

  /**
   * Serializes the macaroon using the v2 binary format.
   * @return {Uint8Array} Serialized macaroon
   */
  _serializeBinaryV2() {
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

  serializeBinary() {
    switch (this._version) {
      case 1:
        return this._serializeBinaryV1();
      case 2:
        return this._serializeBinaryV2();
      default:
        throw new Error(`unexpected macaroon version ${this._version}`);
    }
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
    // TODO this probably should not allow multiple levels of array.
    return obj.map(val => importFromJSONObject(val));
  }
  if (obj.signature) {
    // Looks like a V1 macaroon.
    return importFromJSONObjectV1(obj);
  }
  return importFromJSONObjectV2(obj);
};

const importFromJSONObjectV1 = function(obj) {
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
 * Deserializes V2 JSON macaroon encoding.
 * @param {Object|Array} obj A serialized JSON macaroon
 * @return {Macaroon}
*/
const importFromJSONObjectV2 = function(obj) {
  if (obj.v !== 2) {
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
    };
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
 * @param {bool} required Whether the key is required to exist.
 * @return {Uint8Array) The value of the key (or null if not present).
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
 * Deserialize a macaroon from the v2 binary format
 * @param {Uint8Array} bytes The serialized macaroon.
 * @return {Macaroon}
 */
const deserializeBinaryV2 = function(bytes) {
  const buf = new ByteReader(bytes);
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
 * Deserialize a macaroon from binary format (currently only supports V2 format).
 * @param {Uint8Array} bytes The serialized macaroon.
 */
const deserializeBinary = function(bytes) {
  if (bytes.length === 0) {
    throw new Error('Empty macaroon data');
  }
  const version = bytes[0];
  if (version === 2) {
    return deserializeBinaryV2(bytes);
  }
  if (isASCIIHex(version)) {
    // It's a hex digit - version 1 binary format.
    throw new Error('Version 1 binary format not supported');
  }
  throw new Error('Cannot determine data format of binary-encoded macaroon');
};

/**
  Create a new Macaroon with the given root key, identifier, location
  and signature.
  @param {Object} The necessary values to generate a macaroon.
    It contains the following fields:
      identifier: {String | Uint8Array}
      location:   {String} (optional)
      rootKey:    {String | Uint8Array}
      version: {int} (optional; defaults to 2).
  @return {Macaroon} The new macaroon
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
  importFromJSONObject,
  deserializeBinary,
  bytesToBase64: bytesToBase64,
  base64ToBytes: base64ToBytes,
};
