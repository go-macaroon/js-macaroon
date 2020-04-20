## Classes

<dl>
<dt><a href="#ByteBuffer">ByteBuffer</a></dt>
<dd></dd>
<dt><a href="#ByteReader">ByteReader</a></dt>
<dd></dd>
<dt><a href="#Macaroon">Macaroon</a></dt>
<dd></dd>
</dl>

## Members

<dl>
<dt><a href="#exp_module_macaroon--exports.base64ToBytes">exports.base64ToBytes</a> ⇒ ⏏</dt>
<dd><p>Convert a Uint8Array to a base64-encoded string
using URL-safe, unpadded encoding.</p></dd>
<dt><a href="#bytesToBase64">bytesToBase64</a> ⇒</dt>
<dd><p>Converts a Uint8Array to a bitArray for use by nacl.</p></dd>
<dt><a href="#exp_module_macaroon--Macaroon+caveats">Macaroon#caveats</a> ⇒ ⏏</dt>
<dd><p>Return the caveats associated with the macaroon,
as an array of caveats. A caveat is represented
as an object with an identifier field (Uint8Array)
and (for third party caveats) a location field (string),
and verification id (Uint8Array).</p></dd>
<dt><a href="#exp_module_macaroon--Macaroon+location">Macaroon#location</a> ⇒ ⏏</dt>
<dd><p>Return the location of the macaroon.</p></dd>
<dt><a href="#exp_module_macaroon--Macaroon+identifier">Macaroon#identifier</a> ⇒ ⏏</dt>
<dd><p>Return the macaroon's identifier.</p></dd>
<dt><a href="#exp_module_macaroon--Macaroon+signature">Macaroon#signature</a> ⇒ ⏏</dt>
<dd><p>Return the signature of the macaroon.</p></dd>
<dt><a href="#exp_module_macaroon--exports.importMacaroon">exports.importMacaroon</a> ⇒ <code><a href="#Macaroon">Array.&lt;Macaroon&gt;</a></code> ⏏</dt>
<dd><p>Returns an array of macaroon instances based on the object passed in.
If obj is a string, it is assumed to be a set of base64-encoded
macaroons in binary or JSON format.
If obj is a Uint8Array, it is assumed to be set of macaroons in
binary format, as produced by the exportBinary method.
If obj is an array, it is assumed to be an array of macaroon
objects decoded from JSON.
Otherwise obj is assumed to be a macaroon object decoded from JSON.</p>
<p>This function accepts a strict superset of the formats accepted
by importMacaroons. When decoding a single macaroon,
it will return an array with one macaroon element.</p></dd>
<dt><a href="#importMacaroons">importMacaroons</a> ⇒ <code><a href="#Macaroon">Macaroon</a></code></dt>
<dd><p>Returns a macaroon instance imported from a JSON-decoded object.</p></dd>
<dt><a href="#exp_module_macaroon--exports.newMacaroon">exports.newMacaroon</a> ⏏</dt>
<dd><p>Gathers discharge macaroons for all third party caveats in the supplied
macaroon (and any subsequent caveats required by those) calling getDischarge
to acquire each discharge macaroon.</p></dd>
</dl>

## Functions

<dl>
<dt><a href="#toString">toString(x)</a> ⇒</dt>
<dd><p>Return a form of x suitable for including in a error message.</p></dd>
<dt><a href="#stringToBytes">stringToBytes(s)</a></dt>
<dd><p>Convert a string to a Uint8Array by utf-8
encoding it.</p></dd>
<dt><a href="#bytesToString">bytesToString(b)</a></dt>
<dd><p>Convert a Uint8Array to a string by
utf-8 decoding it. Throws an exception if
the bytes do not represent well-formed utf-8.</p></dd>
<dt><a href="#bitsToString">bitsToString(s)</a></dt>
<dd><p>Convert an sjcl bitArray to a string by
utf-8 decoding it. Throws an exception if
the bytes do not represent well-formed utf-8.</p></dd>
<dt><a href="#exp_module_macaroon--base64ToBytes">base64ToBytes(s)</a> ⇒ ⏏</dt>
<dd><p>Convert a base64 string to a Uint8Array by decoding it.
It copes with unpadded and URL-safe base64 encodings.</p></dd>
<dt><a href="#bitsToBytes">bitsToBytes(arr)</a> ⇒</dt>
<dd><p>Converts a bitArray to a Uint8Array.</p></dd>
<dt><a href="#hexToBytes">hexToBytes(hex)</a></dt>
<dd><p>Converts a hex to Uint8Array</p></dd>
<dt><a href="#isValidUTF8">isValidUTF8(bytes)</a> ⇒</dt>
<dd><p>Report whether the argument encodes a valid utf-8 string.</p></dd>
<dt><a href="#requireString">requireString(val, label)</a> ⇒</dt>
<dd><p>Check that supplied value is a string and return it. Throws an
error including the provided label if not.</p></dd>
<dt><a href="#maybeString">maybeString(val, label)</a> ⇒</dt>
<dd><p>Check that supplied value is a string or undefined or null. Throws
an error including the provided label if not. Always returns a string
(the empty string if undefined or null).</p></dd>
<dt><a href="#requireBytes">requireBytes(val, label)</a> ⇒</dt>
<dd><p>Check that supplied value is a Uint8Array or a string.
Throws an error
including the provided label if not.</p></dd>
<dt><a href="#readFieldV2">readFieldV2(buf, expectFieldType)</a> ⇒</dt>
<dd><p>Read a macaroon V2 field from the buffer. If the
field does not have the expected type, throws an exception.</p></dd>
<dt><a href="#appendFieldV2">appendFieldV2(buf, fieldType, data)</a></dt>
<dd><p>Append a macaroon V2 field to the buffer.</p></dd>
<dt><a href="#readFieldV2Optional">readFieldV2Optional(buf, maybeFieldType)</a> ⇒</dt>
<dd><p>Read an optionally-present macaroon V2 field from the buffer.
If the field is not present, returns null.</p></dd>
<dt><a href="#setJSONFieldV2">setJSONFieldV2(obj, key, valBytes)</a></dt>
<dd><p>Sets a field in a V2 encoded JSON object.</p></dd>
<dt><a href="#keyedHash">keyedHash(keyBits, dataBits)</a> ⇒</dt>
<dd><p>Generate a hash using the supplied data.</p></dd>
<dt><a href="#keyedHash2">keyedHash2(keyBits, d1Bits, d2Bits)</a> ⇒</dt>
<dd><p>Generate a hash keyed with key of both data objects.</p></dd>
<dt><a href="#makeKey">makeKey(keyBits)</a></dt>
<dd><p>Generate a fixed length key for use as a nacl secretbox key.</p></dd>
<dt><a href="#newNonce">newNonce()</a></dt>
<dd><p>Generate a random nonce as Uint8Array.</p></dd>
<dt><a href="#encrypt">encrypt(keyBits, textBits)</a> ⇒</dt>
<dd><p>Encrypt the given plaintext with the given key.</p></dd>
<dt><a href="#decrypt">decrypt(keyBits, ciphertextBits)</a> ⇒</dt>
<dd><p>Decrypts the given cyphertext.</p></dd>
<dt><a href="#bindForRequest">bindForRequest(rootSigBits, dischargeSigBits)</a> ⇒</dt>
<dd><p>Bind a given macaroon to the given signature of its parent macaroon. If the
keys already match then it will return the rootSig.</p></dd>
<dt><a href="#exp_module_macaroon--Macaroon+addThirdPartyCaveat">Macaroon#addThirdPartyCaveat()</a> ⏏</dt>
<dd><p>Adds a third party caveat to the macaroon. Using the given shared root key,
caveat id and location hint. The caveat id should encode the root key in
some way, either by encrypting it with a key known to the third party or by
holding a reference to it stored in the third party's storage.</p></dd>
<dt><a href="#exp_module_macaroon--Macaroon+addFirstPartyCaveat">Macaroon#addFirstPartyCaveat()</a> ⏏</dt>
<dd><p>Adds a caveat that will be verified by the target service.</p></dd>
<dt><a href="#exp_module_macaroon--Macaroon+bindToRoot">Macaroon#bindToRoot()</a> ⏏</dt>
<dd><p>Binds the macaroon signature to the given root signature.
This must be called on discharge macaroons with the primary
macaroon's signature before sending the macaroons in a request.</p></dd>
<dt><a href="#exp_module_macaroon--Macaroon+clone">Macaroon#clone()</a> ⇒ ⏏</dt>
<dd><p>Returns a copy of the macaroon. Any caveats added to the returned macaroon
will not effect the original.</p></dd>
<dt><a href="#exp_module_macaroon--Macaroon+verify">Macaroon#verify(rootKeyBytes, check)</a> ⏏</dt>
<dd><p>Verifies that the macaroon is valid. Throws exception if verification fails.</p></dd>
<dt><a href="#exp_module_macaroon--Macaroon+exportJSON">Macaroon#exportJSON()</a> ⇒ <code>Object</code> ⏏</dt>
<dd><p>Exports the macaroon to a JSON-serializable object.
The version used depends on what version the
macaroon was created with or imported from.</p></dd>
<dt><a href="#exp_module_macaroon--Macaroon+exportBinary">Macaroon#exportBinary()</a> ⇒ <code>Uint8Array</code> ⏏</dt>
<dd><p>Exports the macaroon using binary format.
The version will be the same as the version that the
macaroon was created with or imported from.</p></dd>
<dt><a href="#exp_module_macaroon--importMacaroon">importMacaroon(obj)</a> ⇒ <code><a href="#Macaroon">Macaroon</a></code> | <code><a href="#Macaroon">Array.&lt;Macaroon&gt;</a></code> ⏏</dt>
<dd><p>Returns a macaroon instance based on the object passed in.
If obj is a string, it is assumed to be a base64-encoded
macaroon in binary or JSON format.
If obj is a Uint8Array, it is assumed to be a macaroon in
binary format, as produced by the exportBinary method.
Otherwise obj is assumed to be a object decoded from JSON,
and will be unmarshaled as such.</p></dd>
<dt><a href="#importJSONV2">importJSONV2(obj)</a></dt>
<dd><p>Imports V2 JSON macaroon encoding.</p></dd>
<dt><a href="#v2JSONField">v2JSONField(obj, key, required)</a> ⇒</dt>
<dd><p>Read a JSON field that might be in base64 or string
format.</p></dd>
<dt><a href="#importBinaryV2">importBinaryV2(buf)</a></dt>
<dd><p>Import a macaroon from the v2 binary format</p></dd>
<dt><a href="#importBinary">importBinary(buf)</a></dt>
<dd><p>Import a macaroon from binary format (currently only supports V2 format).</p></dd>
<dt><a href="#exp_module_macaroon--newMacaroon">newMacaroon()</a> ⇒ <code><a href="#Macaroon">Macaroon</a></code> ⏏</dt>
<dd><p>Create a new Macaroon with the given root key, identifier, location
and signature and return it.</p></dd>
</dl>

<a name="ByteBuffer"></a>

## ByteBuffer
**Kind**: global class

* [ByteBuffer](#ByteBuffer)
    * [new ByteBuffer(capacity)](#new_ByteBuffer_new)
    * [.bytes](#ByteBuffer+bytes) ⇒
    * [.appendBytes(bytes)](#ByteBuffer+appendBytes)
    * [.appendByte(byte)](#ByteBuffer+appendByte)
    * [.appendUvarint(x)](#ByteBuffer+appendUvarint)
    * [._grow(minCap)](#ByteBuffer+_grow)

<a name="new_ByteBuffer_new"></a>

### new ByteBuffer(capacity)
<p>Create a new ByteBuffer. A ByteBuffer holds
a Uint8Array that it grows when written to.</p>


| Param    | Description                                |
| -------- | ------------------------------------------ |
| capacity | <p>The initial capacity of the buffer.</p> |

<a name="ByteBuffer+bytes"></a>

### byteBuffer.bytes ⇒
<p>Return everything that has been appended to the buffer.
Note that the returned array is shared with the internal buffer.</p>

**Kind**: instance property of [<code>ByteBuffer</code>](#ByteBuffer)
**Returns**: <p>The buffer.</p>
<a name="ByteBuffer+appendBytes"></a>

### byteBuffer.appendBytes(bytes)
<p>Append several bytes to the buffer.</p>

**Kind**: instance method of [<code>ByteBuffer</code>](#ByteBuffer)

| Param | Description                 |
| ----- | --------------------------- |
| bytes | <p>The bytes to append.</p> |

<a name="ByteBuffer+appendByte"></a>

### byteBuffer.appendByte(byte)
<p>Append a single byte to the buffer.</p>

**Kind**: instance method of [<code>ByteBuffer</code>](#ByteBuffer)

| Param | Description               |
| ----- | ------------------------- |
| byte  | <p>The byte to append</p> |

<a name="ByteBuffer+appendUvarint"></a>

### byteBuffer.appendUvarint(x)
<p>Append a variable length integer to the buffer.</p>

**Kind**: instance method of [<code>ByteBuffer</code>](#ByteBuffer)

| Param | Description                  |
| ----- | ---------------------------- |
| x     | <p>The number to append.</p> |

<a name="ByteBuffer+_grow"></a>

### byteBuffer.\_grow(minCap)
<p>Grow the internal buffer so that it's at least as big as minCap.</p>

**Kind**: instance method of [<code>ByteBuffer</code>](#ByteBuffer)

| Param  | Description                      |
| ------ | -------------------------------- |
| minCap | <p>The minimum new capacity.</p> |

<a name="ByteReader"></a>

## ByteReader
**Kind**: global class

* [ByteReader](#ByteReader)
    * [new ByteReader(bytes)](#new_ByteReader_new)
    * [.length](#ByteReader+length) ⇒
    * [.readByte()](#ByteReader+readByte) ⇒
    * [.peekByte()](#ByteReader+peekByte) ⇒
    * [.readN(n)](#ByteReader+readN)
    * [.readUvarint()](#ByteReader+readUvarint) ⇒

<a name="new_ByteReader_new"></a>

### new ByteReader(bytes)
<p>Create a new ByteReader that reads from the given buffer.</p>


| Param | Description                     |
| ----- | ------------------------------- |
| bytes | <p>The buffer to read from.</p> |

<a name="ByteReader+length"></a>

### byteReader.length ⇒
<p>Return the size of the buffer.</p>

**Kind**: instance property of [<code>ByteReader</code>](#ByteReader)
**Returns**: <p>The number of bytes left to read in the buffer.</p>
<a name="ByteReader+readByte"></a>

### byteReader.readByte() ⇒
<p>Read a byte from the buffer. If there are no bytes left in the
buffer, throws a RangeError exception.</p>

**Kind**: instance method of [<code>ByteReader</code>](#ByteReader)
**Returns**: <p>The read byte.</p>
<a name="ByteReader+peekByte"></a>

### byteReader.peekByte() ⇒
<p>Inspect the next byte without consuming it.
If there are no bytes left in the
buffer, throws a RangeError exception.</p>

**Kind**: instance method of [<code>ByteReader</code>](#ByteReader)
**Returns**: <p>The peeked byte.</p>
<a name="ByteReader+readN"></a>

### byteReader.readN(n)
<p>Read a number of bytes from the buffer.
If there are not enough bytes left in the buffer,
throws a RangeError exception.</p>

**Kind**: instance method of [<code>ByteReader</code>](#ByteReader)

| Param | Description                         |
| ----- | ----------------------------------- |
| n     | <p>The number of bytes to read.</p> |

<a name="ByteReader+readUvarint"></a>

### byteReader.readUvarint() ⇒
<p>Read a variable length integer from the buffer.
If there are not enough bytes left in the buffer
or the encoded integer is too big, throws a
RangeError exception.</p>

**Kind**: instance method of [<code>ByteReader</code>](#ByteReader)
**Returns**: <p>The number that's been read.</p>
<a name="Macaroon"></a>

## Macaroon
**Kind**: global class

* [Macaroon](#Macaroon)
    * [new Macaroon(params)](#new_Macaroon_new)
    * [._exportAsJSONObjectV1()](#Macaroon+_exportAsJSONObjectV1) ⇒ <code>Object</code>
    * [._exportAsJSONObjectV2()](#Macaroon+_exportAsJSONObjectV2) ⇒ <code>Object</code>
    * [._exportBinaryV1()](#Macaroon+_exportBinaryV1) ⇒ <code>Uint8Array</code>
    * [._exportBinaryV2()](#Macaroon+_exportBinaryV2) ⇒ <code>Uint8Array</code>

<a name="new_Macaroon_new"></a>

### new Macaroon(params)
<p>Create a new Macaroon with the given root key, identifier, location
and signature.</p>


| Param  | Type                    | Description                                                                                                                                                                                                                                                                                                    |
| ------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| params | <code>Uint8Array</code> | <p>The necessary values to generate a macaroon. It contains the following fields: identifierBytes: locationStr:   {string} caveats:    {Array of {locationStr: string, identifierBytes: Uint8Array, vidBytes: Uint8Array}} signatureBytes:  {Uint8Array} version: {int} The version of macaroon to create.</p> |

<a name="Macaroon+_exportAsJSONObjectV1"></a>

### macaroon.\_exportAsJSONObjectV1() ⇒ <code>Object</code>
<p>Returns a JSON compatible object representation of this version 1 macaroon.</p>

**Kind**: instance method of [<code>Macaroon</code>](#Macaroon)
**Returns**: <code>Object</code> - <ul>
<li>JSON compatible representation of this macaroon.</li>
</ul>
<a name="Macaroon+_exportAsJSONObjectV2"></a>

### macaroon.\_exportAsJSONObjectV2() ⇒ <code>Object</code>
<p>Returns the V2 JSON serialization of this macaroon.</p>

**Kind**: instance method of [<code>Macaroon</code>](#Macaroon)
**Returns**: <code>Object</code> - <ul>
<li>JSON compatible representation of this macaroon.</li>
</ul>
<a name="Macaroon+_exportBinaryV1"></a>

### macaroon.\_exportBinaryV1() ⇒ <code>Uint8Array</code>
<p>Exports the macaroon using the v1 binary format.</p>

**Kind**: instance method of [<code>Macaroon</code>](#Macaroon)
**Returns**: <code>Uint8Array</code> - <ul>
<li>Serialized macaroon</li>
</ul>
<a name="Macaroon+_exportBinaryV2"></a>

### macaroon.\_exportBinaryV2() ⇒ <code>Uint8Array</code>
<p>Exports the macaroon using the v2 binary format.</p>

**Kind**: instance method of [<code>Macaroon</code>](#Macaroon)
**Returns**: <code>Uint8Array</code> - <ul>
<li>Serialized macaroon</li>
</ul>
<a name="bytesToBase64"></a>

## bytesToBase64 ⇒
<p>Converts a Uint8Array to a bitArray for use by nacl.</p>

**Kind**: global variable
**Returns**: <p>The converted array.</p>

| Param | Description                                   |
| ------- | ----------------------------------------------------- |
| arr     | <p>The array to convert.</p> |

<a name="importMacaroons"></a>

## importMacaroons ⇒ [<code>Macaroon</code>](#Macaroon)
<p>Returns a macaroon instance imported from a JSON-decoded object.</p>

**Kind**: global variable

| Param | Type                | Description                     |
| ----- | ------------------- | ------------------------------- |
| obj   | <code>object</code> | <p>The JSON to import from.</p> |

<a name="toString"></a>

## toString(x) ⇒
<p>Return a form of x suitable for including in a error message.</p>

**Kind**: global function
**Returns**: <p>The converted object.</p>

| Param | Description                                       |
| ----- | ------------------------------------------------- |
| x     | <p>The object to be converted to string form.</p> |

<a name="stringToBytes"></a>

## stringToBytes(s)
<p>Convert a string to a Uint8Array by utf-8
encoding it.</p>

**Kind**: global function

| Param | Description                   |
| ----- | ----------------------------- |
| s     | <p>The string to convert.</p> |

<a name="bytesToString"></a>

## bytesToString(b)
<p>Convert a Uint8Array to a string by
utf-8 decoding it. Throws an exception if
the bytes do not represent well-formed utf-8.</p>

**Kind**: global function

| Param | Description                  |
| ----- | ---------------------------- |
| b     | <p>The bytes to convert.</p> |

<a name="bitsToString"></a>

## bitsToString(s)
<p>Convert an sjcl bitArray to a string by
utf-8 decoding it. Throws an exception if
the bytes do not represent well-formed utf-8.</p>

**Kind**: global function

| Param | Description                  |
| ----- | ---------------------------- |
| s     | <p>The bytes to convert.</p> |

<a name="bitsToBytes"></a>

## bitsToBytes(arr) ⇒
<p>Converts a bitArray to a Uint8Array.</p>

**Kind**: global function
**Returns**: <p>The converted array.</p>

| Param | Description |
| --- | --- |
| arr | <p>The array to convert.</p> |

<a name="hexToBytes"></a>

## hexToBytes(hex)
<p>Converts a hex to Uint8Array</p>

**Kind**: global function

| Param | Description                      |
| ----- | -------------------------------- |
| hex   | <p>The hex value to convert.</p> |

<a name="isValidUTF8"></a>

## isValidUTF8(bytes) ⇒
<p>Report whether the argument encodes a valid utf-8 string.</p>

**Kind**: global function
**Returns**: <p>True if the bytes are valid utf-8.</p>

| Param | Description                |
| ----- | -------------------------- |
| bytes | <p>The bytes to check.</p> |

<a name="requireString"></a>

## requireString(val, label) ⇒
<p>Check that supplied value is a string and return it. Throws an
error including the provided label if not.</p>

**Kind**: global function
**Returns**: <p>The supplied value.</p>

| Param | Description                                                       |
| ------- | ------------------------------------------------------------------------- |
| val     | <p>The value to assert as a string</p> |
| label | <p>The value label.</p>                               |

<a name="maybeString"></a>

## maybeString(val, label) ⇒
<p>Check that supplied value is a string or undefined or null. Throws
an error including the provided label if not. Always returns a string
(the empty string if undefined or null).</p>

**Kind**: global function
**Returns**: <p>The supplied value or an empty string.</p>

| Param | Description |
| --- | --- |
| val | <p>The value to assert as a string</p> |
| label | <p>The value label.</p> |

<a name="requireBytes"></a>

## requireBytes(val, label) ⇒
<p>Check that supplied value is a Uint8Array or a string.
Throws an error
including the provided label if not.</p>

**Kind**: global function
**Returns**: <p>The supplied value, utf-8-encoded if it was a string.</p>

| Param | Description                                |
| ----- | ------------------------------------------ |
| val   | <p>The value to assert as a Uint8Array</p> |
| label | <p>The value label.</p>                    |

<a name="readFieldV2"></a>

## readFieldV2(buf, expectFieldType) ⇒
<p>Read a macaroon V2 field from the buffer. If the
field does not have the expected type, throws an exception.</p>

**Kind**: global function
**Returns**: <p>The contents of the field.</p>

| Param           | Description                     |
| --------------- | ------------------------------- |
| buf             | <p>The buffer to read from.</p> |
| expectFieldType | <p>The required field type.</p> |

<a name="appendFieldV2"></a>

## appendFieldV2(buf, fieldType, data)
<p>Append a macaroon V2 field to the buffer.</p>

**Kind**: global function

| Param     | Description                      |
| --------- | -------------------------------- |
| buf       | <p>The buffer to append to.</p>  |
| fieldType | <p>The type of the field.</p>    |
| data      | <p>The content of the field.</p> |

<a name="readFieldV2Optional"></a>

## readFieldV2Optional(buf, maybeFieldType) ⇒
<p>Read an optionally-present macaroon V2 field from the buffer.
If the field is not present, returns null.</p>

**Kind**: global function
**Returns**: <p>The contents of the field, or null if not present.</p>

| Param          | Description                     |
| -------------- | ------------------------------- |
| buf            | <p>The buffer to read from.</p> |
| maybeFieldType | <p>The expected field type.</p> |

<a name="setJSONFieldV2"></a>

## setJSONFieldV2(obj, key, valBytes)
<p>Sets a field in a V2 encoded JSON object.</p>

**Kind**: global function

| Param    | Type                    | Description             |
| -------- | ----------------------- | ----------------------- |
| obj      | <code>Object</code>     | <p>The JSON object.</p> |
| key      | <code>string</code>     | <p>The key to set.</p>  |
| valBytes | <code>Uint8Array</code> | <p>The key's value.</p> |

<a name="keyedHash"></a>

## keyedHash(keyBits, dataBits) ⇒
<p>Generate a hash using the supplied data.</p>

**Kind**: global function
**Returns**: <p>The keyed hash of the supplied data as a sjcl bitArray.</p>

| Param    |
| -------- |
| keyBits  |
| dataBits |

<a name="keyedHash2"></a>

## keyedHash2(keyBits, d1Bits, d2Bits) ⇒
<p>Generate a hash keyed with key of both data objects.</p>

**Kind**: global function
**Returns**: <p>The keyed hash of d1 and d2 as a sjcl bitArray.</p>

| Param   |
| ------- |
| keyBits |
| d1Bits  |
| d2Bits  |

<a name="makeKey"></a>

## makeKey(keyBits)
<p>Generate a fixed length key for use as a nacl secretbox key.</p>

**Kind**: global function

| Param   | Description                |
| ------- | -------------------------- |
| keyBits | <p>The key to convert.</p> |

<a name="newNonce"></a>

## newNonce()
<p>Generate a random nonce as Uint8Array.</p>

**Kind**: global function
<a name="encrypt"></a>

## encrypt(keyBits, textBits) ⇒
<p>Encrypt the given plaintext with the given key.</p>

**Kind**: global function
**Returns**: <p>encrypted text.</p>

| Param    | Description            |
| -------- | ---------------------- |
| keyBits  | <p>encryption key.</p> |
| textBits | <p>plaintext.</p>      |

<a name="decrypt"></a>

## decrypt(keyBits, ciphertextBits) ⇒
<p>Decrypts the given cyphertext.</p>

**Kind**: global function
**Returns**: <p>decrypted text.</p>

| Param          | Description            |
| -------------- | ---------------------- |
| keyBits        | <p>decryption key.</p> |
| ciphertextBits | <p>encrypted text.</p> |

<a name="bindForRequest"></a>

## bindForRequest(rootSigBits, dischargeSigBits) ⇒
<p>Bind a given macaroon to the given signature of its parent macaroon. If the
keys already match then it will return the rootSig.</p>

**Kind**: global function
**Returns**: <p>The bound macaroon signature.</p>

| Param            |
| ---------------- |
| rootSigBits      |
| dischargeSigBits |

<a name="importJSONV2"></a>

## importJSONV2(obj)
<p>Imports V2 JSON macaroon encoding.</p>

**Kind**: global function

| Param | Description                       |
| ----- | --------------------------------- |
| obj   | <p>A serialized JSON macaroon</p> |

<a name="v2JSONField"></a>

## v2JSONField(obj, key, required) ⇒
<p>Read a JSON field that might be in base64 or string
format.</p>

**Kind**: global function
**Returns**: <p>The value of the key (or null if not present).</p>

| Param    | Description                                  |
| -------- | -------------------------------------------- |
| obj      | <p>A deserialized JSON object.</p>           |
| key      | <p>The key name.</p>                         |
| required | <p>Whether the key is required to exist.</p> |

<a name="importBinaryV2"></a>

## importBinaryV2(buf)
<p>Import a macaroon from the v2 binary format</p>

**Kind**: global function

| Param | Description                                      |
| ----- | ------------------------------------------------ |
| buf   | <p>A buffer holding the serialized macaroon.</p> |

<a name="importBinary"></a>

## importBinary(buf)
<p>Import a macaroon from binary format (currently only supports V2 format).</p>

**Kind**: global function

| Param | Type                    | Description                     |
| ----- | ----------------------- | ------------------------------- |
| buf   | <code>Uint8Array</code> | <p>The serialized macaroon.</p> |

