<a name="module_macaroon"></a>

## macaroon
A JavaScript implementation of
 [macaroons](http://theory.stanford.edu/~ataly/Papers/macaroons.pdf)
 compatible with the [Go](http://github.com/go-macaroon/macaroon),
 [Python, and C ](https://github.com/rescrv/libmacaroons)
 implementations. Including functionality to interact with
 third party caveat dischargers implemented by the [Go macaroon
 bakery](http://github.com/go-macaroon-bakery/macaroon-bakery).
 It supports both version 1 and 2 macaroons in JSON and binary formats.


* [macaroon](#module_macaroon)
    * [Macaroon#caveats](#exp_module_macaroon--Macaroon+caveats) ⇒ <code>Array</code> ⏏
    * [Macaroon#location](#exp_module_macaroon--Macaroon+location) ⇒ <code>string</code> ⏏
    * [Macaroon#identifier](#exp_module_macaroon--Macaroon+identifier) ⇒ <code>Uint8Array</code> ⏏
    * [Macaroon#signature](#exp_module_macaroon--Macaroon+signature) ⇒ <code>Uint8Array</code> ⏏
    * [base64ToBytes(s)](#exp_module_macaroon--base64ToBytes) ⇒ <code>Uint8Array</code> ⏏
    * [bytesToBase64(bytes)](#exp_module_macaroon--bytesToBase64) ⇒ <code>string</code> ⏏
    * [Macaroon#addThirdPartyCaveat(rootKeyBytes, caveatIdBytes, [locationStr])](#exp_module_macaroon--Macaroon+addThirdPartyCaveat) ⏏
    * [Macaroon#addFirstPartyCaveat(caveatIdBytes)](#exp_module_macaroon--Macaroon+addFirstPartyCaveat) ⏏
    * [Macaroon#bindToRoot(rootSig)](#exp_module_macaroon--Macaroon+bindToRoot) ⏏
    * [Macaroon#clone()](#exp_module_macaroon--Macaroon+clone) ⇒ <code>Macaroon</code> ⏏
    * [Macaroon#verify(rootKeyBytes, check, discharges)](#exp_module_macaroon--Macaroon+verify) ⏏
    * [Macaroon#exportJSON()](#exp_module_macaroon--Macaroon+exportJSON) ⇒ <code>Object</code> ⏏
    * [Macaroon#exportBinary()](#exp_module_macaroon--Macaroon+exportBinary) ⇒ <code>Uint8Array</code> ⏏
    * [importMacaroon(obj)](#exp_module_macaroon--importMacaroon) ⇒ <code>Macaroon</code> \| <code>Array.&lt;Macaroon&gt;</code> ⏏
    * [importMacaroons(obj)](#exp_module_macaroon--importMacaroons) ⇒ <code>Array.&lt;Macaroon&gt;</code> ⏏
    * [newMacaroon()](#exp_module_macaroon--newMacaroon) ⇒ <code>Macaroon</code> ⏏
    * [dischargeMacaroon(macaroon, getDischarge, onOk, onError)](#exp_module_macaroon--dischargeMacaroon) ⏏

<a name="exp_module_macaroon--Macaroon+caveats"></a>

### Macaroon#caveats ⇒ <code>Array</code> ⏏
Return the caveats associated with the macaroon,
as an array of caveats. A caveat is represented
as an object with an identifier field (Uint8Array)
and (for third party caveats) a location field (string),
and verification id (Uint8Array).

**Kind**: Exported member  
**Returns**: <code>Array</code> - - The macaroon's caveats.  
<a name="exp_module_macaroon--Macaroon+location"></a>

### Macaroon#location ⇒ <code>string</code> ⏏
Return the location of the macaroon.

**Kind**: Exported member  
**Returns**: <code>string</code> - - The macaroon's location.  
<a name="exp_module_macaroon--Macaroon+identifier"></a>

### Macaroon#identifier ⇒ <code>Uint8Array</code> ⏏
Return the macaroon's identifier.

**Kind**: Exported member  
**Returns**: <code>Uint8Array</code> - - The macaroon's identifier.  
<a name="exp_module_macaroon--Macaroon+signature"></a>

### Macaroon#signature ⇒ <code>Uint8Array</code> ⏏
Return the signature of the macaroon.

**Kind**: Exported member  
**Returns**: <code>Uint8Array</code> - - The macaroon's signature.  
<a name="exp_module_macaroon--base64ToBytes"></a>

### base64ToBytes(s) ⇒ <code>Uint8Array</code> ⏏
Convert a base64 string to a Uint8Array by decoding it.
It copes with unpadded and URL-safe base64 encodings.

**Kind**: Exported function  
**Returns**: <code>Uint8Array</code> - - The decoded bytes.  

| Param | Type | Description |
| --- | --- | --- |
| s | <code>string</code> | The base64 string to decode. |

<a name="exp_module_macaroon--bytesToBase64"></a>

### bytesToBase64(bytes) ⇒ <code>string</code> ⏏
Convert a Uint8Array to a base64-encoded string
using URL-safe, unpadded encoding.

**Kind**: Exported function  
**Returns**: <code>string</code> - - The base64-encoded result.  

| Param | Type | Description |
| --- | --- | --- |
| bytes | <code>Uint8Array</code> | The bytes to encode. |

<a name="exp_module_macaroon--Macaroon+addThirdPartyCaveat"></a>

### Macaroon#addThirdPartyCaveat(rootKeyBytes, caveatIdBytes, [locationStr]) ⏏
Adds a third party caveat to the macaroon. Using the given shared root key,
    caveat id and location hint. The caveat id should encode the root key in
    some way, either by encrypting it with a key known to the third party or by
    holding a reference to it stored in the third party's storage.

**Kind**: Exported function  

| Param | Type |
| --- | --- |
| rootKeyBytes | <code>Uint8Array</code> | 
| caveatIdBytes | <code>Uint8Array</code> \| <code>string</code> | 
| [locationStr] | <code>String</code> | 

<a name="exp_module_macaroon--Macaroon+addFirstPartyCaveat"></a>

### Macaroon#addFirstPartyCaveat(caveatIdBytes) ⏏
Adds a caveat that will be verified by the target service.

**Kind**: Exported function  

| Param | Type |
| --- | --- |
| caveatIdBytes | <code>String</code> \| <code>Uint8Array</code> | 

<a name="exp_module_macaroon--Macaroon+bindToRoot"></a>

### Macaroon#bindToRoot(rootSig) ⏏
Binds the macaroon signature to the given root signature.
    This must be called on discharge macaroons with the primary
    macaroon's signature before sending the macaroons in a request.

**Kind**: Exported function  

| Param | Type |
| --- | --- |
| rootSig | <code>Uint8Array</code> | 

<a name="exp_module_macaroon--Macaroon+clone"></a>

### Macaroon#clone() ⇒ <code>Macaroon</code> ⏏
Returns a copy of the macaroon. Any caveats added to the returned macaroon
    will not effect the original.

**Kind**: Exported function  
**Returns**: <code>Macaroon</code> - - The cloned macaroon.  
<a name="exp_module_macaroon--Macaroon+verify"></a>

### Macaroon#verify(rootKeyBytes, check, discharges) ⏏
Verifies that the macaroon is valid. Throws exception if verification fails.

**Kind**: Exported function  

| Param | Type | Description |
| --- | --- | --- |
| rootKeyBytes | <code>Uint8Array</code> | Must be the same that the macaroon was       originally created with. |
| check | <code>function</code> | Called to verify each first-party caveat. It       is passed the condition to check (a string) and should return an error string if the condition       is not met, or null if satisfied. |
| discharges | <code>Array</code> |  |

<a name="exp_module_macaroon--Macaroon+exportJSON"></a>

### Macaroon#exportJSON() ⇒ <code>Object</code> ⏏
Exports the macaroon to a JSON-serializable object.
  The version used depends on what version the
  macaroon was created with or imported from.

**Kind**: Exported function  
<a name="exp_module_macaroon--Macaroon+exportBinary"></a>

### Macaroon#exportBinary() ⇒ <code>Uint8Array</code> ⏏
Exports the macaroon using binary format.
  The version will be the same as the version that the
  macaroon was created with or imported from.

**Kind**: Exported function  
<a name="exp_module_macaroon--importMacaroon"></a>

### importMacaroon(obj) ⇒ <code>Macaroon</code> \| <code>Array.&lt;Macaroon&gt;</code> ⏏
Returns a macaroon instance based on the object passed in.
  If obj is a string, it is assumed to be a base64-encoded
  macaroon in binary or JSON format.
  If obj is a Uint8Array, it is assumed to be a macaroon in
  binary format, as produced by the exportBinary method.
  Otherwise obj is assumed to be a object decoded from JSON,
  and will be unmarshaled as such.

**Kind**: Exported function  

| Param | Description |
| --- | --- |
| obj | A deserialized JSON macaroon. |

<a name="exp_module_macaroon--importMacaroons"></a>

### importMacaroons(obj) ⇒ <code>Array.&lt;Macaroon&gt;</code> ⏏
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

**Kind**: Exported function  

| Param | Description |
| --- | --- |
| obj | A deserialized JSON macaroon or macaroons. |

<a name="exp_module_macaroon--newMacaroon"></a>

### newMacaroon() ⇒ <code>Macaroon</code> ⏏
Create a new Macaroon with the given root key, identifier, location
  and signature and return it.

**Kind**: Exported function  

| Type | Description |
| --- | --- |
| <code>Object</code> | The necessary values to generate a macaroon.     It contains the following fields:       identifier: {String | Uint8Array}       location:   {String} (optional)       rootKey:    {String | Uint8Array}       version: {int} (optional; defaults to 2). |

<a name="exp_module_macaroon--dischargeMacaroon"></a>

### dischargeMacaroon(macaroon, getDischarge, onOk, onError) ⏏
Gathers discharge macaroons for all third party caveats in the supplied
  macaroon (and any subsequent caveats required by those) calling getDischarge
  to acquire each discharge macaroon.

**Kind**: Exported function  

| Param | Type | Description |
| --- | --- | --- |
| macaroon | <code>Macaroon</code> | The macaroon to discharge. |
| getDischarge | <code>function</code> | Called with 5 arguments.     macaroon.location {String}     caveat.location {String}     caveat.id {String}     success {Function}     failure {Function} |
| onOk | <code>function</code> | Called with an array argument holding the macaroon     as the first element followed by all the discharge macaroons. All the     discharge macaroons will be bound to the primary macaroon. |
| onError | <code>function</code> | Called if an error occurs during discharge. |

