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
import sjcl, { BitArray } from 'sjcl';
/**
 * Convert a base64 string to a Uint8Array by decoding it.
 * It copes with unpadded and URL-safe base64 encodings.
 * @param s The base64 string to decode.
 * @returns The decoded bytes.
 * @alias module:macaroon
 */
export declare const base64ToBytes: (s: string) => Uint8Array;
/** Convert a Uint8Array to a base64-encoded string
 * using URL-safe, unpadded encoding.
 * @param bytes The bytes to encode.
 * @returns The base64-encoded result.
 * @alias module:macaroon
 */
export declare const bytesToBase64: (bytes: Uint8Array) => string;
declare class Macaroon {
    _version: number;
    _locationStr: string;
    _identifierBits: sjcl.BitArray;
    _signatureBits: sjcl.BitArray;
    _caveats: Macaroon.InternalCaveat[];
    /**
      Create a new Macaroon with the given root key, identifier, location
      and signature.
      @param params The necessary values to generate a macaroon.
        It contains the following fields:
          identifierBytes: {Uint8Array}
          locationStr:   {string}
          caveats:    {Array of {locationStr: string, identifierBytes: Uint8Array, vidBytes: Uint8Array}}
          signatureBytes:  {Uint8Array}
          version: {int} The version of macaroon to create.
    */
    constructor(params?: Macaroon.Params);
    /**
     * Return the caveats associated with the macaroon,
     * as an array of caveats. A caveat is represented
     * as an object with an identifier field (Uint8Array)
     * and (for third party caveats) a location field (string),
     * and verification id (Uint8Array).
     * @returns {Array} - The macaroon's caveats.
     * @alias module:macaroon
     */
    get caveats(): ({
        identifier: Uint8Array;
        location: string | undefined;
        vid: Uint8Array;
    } | {
        identifier: Uint8Array;
        location?: undefined;
        vid?: undefined;
    })[];
    /**
     * Return the location of the macaroon.
     * @returns {string} - The macaroon's location.
     * @alias module:macaroon
     */
    get location(): string;
    /**
     * Return the macaroon's identifier.
     * @returns {Uint8Array} - The macaroon's identifier.
     * @alias module:macaroon
     */
    get identifier(): Uint8Array;
    /**
     * Return the signature of the macaroon.
     * @returns {Uint8Array} - The macaroon's signature.
     * @alias module:macaroon
     */
    get signature(): Uint8Array;
    /**
      Adds a third party caveat to the macaroon. Using the given shared root key,
      caveat id and location hint. The caveat id should encode the root key in
      some way, either by encrypting it with a key known to the third party or by
      holding a reference to it stored in the third party's storage.
      @alias module:macaroon
    */
    addThirdPartyCaveat(rootKeyBytes: Uint8Array, caveatIdBytes: Uint8Array | string, locationStr?: string): void;
    /**
      Adds a caveat that will be verified by the target service.
      @alias module:macaroon
    */
    addFirstPartyCaveat(caveatIdBytes: Uint8Array | string): void;
    /**
      Binds the macaroon signature to the given root signature.
      This must be called on discharge macaroons with the primary
      macaroon's signature before sending the macaroons in a request.
      @alias module:macaroon
    */
    bindToRoot(rootSig: Uint8Array): void;
    /**
      Returns a copy of the macaroon. Any caveats added to the returned macaroon
      will not effect the original.
      @returns {Macaroon} - The cloned macaroon.
      @alias module:macaroon
    */
    clone(): Macaroon;
    /**
      Verifies that the macaroon is valid. Throws exception if verification fails.
      @param {Uint8Array} rootKeyBytes Must be the same that the macaroon was
        originally created with.
      @param {Function} check Called to verify each first-party caveat. It
        is passed the condition to check (a string) and should return an error string if the condition
        is not met, or null if satisfied.
      @alias module:macaroon
    */
    verify(rootKeyBytes: Uint8Array, check: (cond: string) => any, discharges?: Macaroon[]): void;
    _verify(rootSigBits: sjcl.BitArray, rootKeyBits: sjcl.BitArray, check: (cond: string) => any, discharges: Macaroon[], used: number[]): void;
    /**
    Exports the macaroon to a JSON-serializable object.
    The version used depends on what version the
    macaroon was created with or imported from.
    @returns {Object}
    @alias module:macaroon
    */
    exportJSON(): MacaroonJSONV1 | MacaroonJSONV2;
    /**
      Returns a JSON compatible object representation of this version 1 macaroon.
      @returns {Object} - JSON compatible representation of this macaroon.
    */
    _exportAsJSONObjectV1(): MacaroonJSONV1;
    /**
      Returns the V2 JSON serialization of this macaroon.
      @returns {Object} - JSON compatible representation of this macaroon.
    */
    _exportAsJSONObjectV2(): MacaroonJSONV2;
    /**
     * Exports the macaroon using the v1 binary format.
     * @returns {Uint8Array} - Serialized macaroon
     */
    _exportBinaryV1(): void;
    /**
     Exports the macaroon using the v2 binary format.
     @returns {Uint8Array} - Serialized macaroon
    */
    _exportBinaryV2(): Uint8Array;
    /**
    Exports the macaroon using binary format.
    The version will be the same as the version that the
    macaroon was created with or imported from.
    @returns {Uint8Array}
    @alias module:macaroon
    */
    exportBinary(): void | Uint8Array;
}
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
export declare const importMacaroon: (obj: string | Uint8Array) => Macaroon;
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
export declare const importMacaroons: (obj: string | Uint8Array | MacaroonJSONV1 | MacaroonJSONV2 | (MacaroonJSONV1 | MacaroonJSONV2)[]) => Macaroon[];
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
export declare const newMacaroon: ({ identifier, location, rootKey, version }: Macaroon.Options) => Macaroon;
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
export declare const dischargeMacaroon: (macaroon: Macaroon, getDischarge: Macaroon.getDischarge, onOk: (macaroons: Macaroon[]) => void, onError: (err: Error) => void) => void;
export declare type Caveat = {
    vidBytes?: Uint8Array | null;
    identifierBytes: Uint8Array | null;
    locationStr: string;
};
export declare namespace Macaroon {
    type Params = {
        identifierBytes: Uint8Array | null;
        locationStr: string;
        signatureBytes: Uint8Array;
        version: number;
        caveats?: Caveat[];
    };
    type Options = {
        identifier: string | Uint8Array;
        rootKey: string | Uint8Array;
        location?: string | null;
        version?: number;
    };
    type getDischarge = (firstPartyLocation: string | undefined, locationStr: string | undefined, identifierBytes: Uint8Array, success: (dm: Macaroon) => void, failure: (err: Error) => void) => void;
    type InternalCaveat = {
        _vidBits?: BitArray | null;
        _identifierBits: BitArray;
        _locationStr?: string;
    };
}
export declare type MacaroonJSONV1 = {
    identifier: string;
    signature: string;
    location?: string;
    caveats?: MacaroonJSONV1.Caveat[];
};
export declare namespace MacaroonJSONV1 {
    type Caveat = {
        cid: string;
        vid?: string;
        cl?: string;
    };
}
export declare type MacaroonJSONV2 = {
    v: number;
    s?: string;
    s64?: string;
    i?: string;
    i64?: string;
    l?: string;
    c?: MacaroonJSONV2.Caveat[];
};
export declare namespace MacaroonJSONV2 {
    type Caveat = {
        i?: string;
        i64?: string;
        v?: string;
        v64?: string;
        l?: string;
    };
}
export {};
