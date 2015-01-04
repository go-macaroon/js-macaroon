/*jslint node: true, continue: true, eqeq: true, forin: true, nomen: true, plusplus: true, todo: true, vars: true, white: true */

var exports = module.exports = {};

var sjcl = require("sjcl");
var nacl = require("tweetnacl");

'use strict';

// assertString asserts that the given object
// is a string, and fails with an exception including
// "what" if it is not.
function assertString(obj, what) {
	if(typeof obj != "string"){
		throw new Error("invalid " + what + ": " + obj);
	}
}

// assertBitArray asserts that the given object
// is a bit array, and fails with an exception including
// "what" if it is not.
function assertBitArray(obj, what) {
	// TODO is a more specific test than this possible?
	if(!(obj instanceof Array)){
		throw new Error("invalid " + what + ": " + obj);
	}
}

// bitArrayToUint8Array returns the sjcl bitArray a
// converted to a Uint8Array as used by nacl.
function bitArrayToUint8Array(a) {
	// TODO I'm sure there's a more efficient way to do this.
	return nacl.util.decodeBase64(sjcl.codec.base64.fromBits(a));
}

// uint8ArrayToBitArray returns the Uint8Array a
// as used by nacl as an sjcl bitArray.
function uint8ArrayToBitArray(a) {
	return sjcl.codec.base64.toBits(nacl.util.encodeBase64(a));
}

// keyedHasher returns a keyed hash using the given
// key, which must be an sjcl bitArray.
var keyedHasher = function(key) {
	return new sjcl.misc.hmac(key, sjcl.hash.sha256);
};

// keyedHash returns the keyed hash of the given
// data. Both key and data must be sjcl bitArrays.
// It returns the hash as an sjcl bitArray.
var keyedHash = function(key, data) {
	var h = keyedHasher(key);
	h.update(data);
	return h.digest();
};

var nonceLen = 24;

// newNonce returns a new random nonce as a Uint8Array.
var newNonce = function() {
	return nacl.randomBytes(nonceLen);
};

// makeKey returns a key suitable for use as a nacl secretbox
// key. It accepts a sjcl bitArray and returns a Uint8Array.
function makeKey(key) {
	if(key < nacl.secretbox.keyLength){
		var a = new Uint8Array(nacl.secretbox.keyLength);
		a.set(bitArrayToUint8Array(key));
		return a;
	}
	var h = new sjcl.hash.sha256();
	h.update(key);
	return bitArrayToUint8Array(h.finalize());

}

// encrypt encrypts the given plaintext with the given key.
// Both the key and the plaintext must be sjcl bitArrays.
function encrypt(key, text) {
	var nonce = newNonce();
	key = makeKey(key);
	text = bitArrayToUint8Array(text);
	var data = nacl.secretbox(text, nonce, key);
	var ciphertext = new Uint8Array(nonce.length + data.length);
	ciphertext.set(nonce, 0);
	ciphertext.set(data, nonce.length);
	return uint8ArrayToBitArray(ciphertext);
}

// decrypt decrypts the given ciphertext (an sjcl bitArray
// as returned by encrypt) with the given key (also
// an sjcl bitArray)
function decrypt(key, ciphertext) {
	key = makeKey(key);
	ciphertext = bitArrayToUint8Array(ciphertext);
	var nonce = ciphertext.slice(0, nonceLen);
	ciphertext = ciphertext.slice(nonceLen);
	var text = nacl.secretbox.open(ciphertext, nonce, key);
	if(text == false){
		throw new Error("decryption failed");
	}
	return uint8ArrayToBitArray(text);
}

// Macaroon defines the macaroon object. It is not exported
// as a constructor - newMacaroon should be used instead.
function Macaroon() {}

// newMacaroon returns a new macaroon with the given
// root key, identifier and location.
// The root key must be an sjcl bitArray.
// TODO accept string, Buffer, for root key?
exports.newMacaroon = function(rootKey, id, loc) {
	var m = new Macaroon();
	m._caveats = [];
	assertString(loc, "macaroon location");
	assertString(id, "macaroon identifier");
	assertBitArray(rootKey, "macaroon root key");
	m._location = loc;
	m._identifier = id;
	m._signature = keyedHash(rootKey, sjcl.codec.utf8String.toBits(id));
	return m;
};

function quote(s) {
	return JSON.stringify(s);
}

// import converts an object as deserialised from
// JSON to a macaroon. It also accepts an array of objects,
// returning the resulting array of macaroons.
exports.import = function(obj) {
	var i;
	if(obj.constructor == Array){
		var result = [];
		for(i in obj){
			result[i] = exports.import(obj[i]);
		}
		return result;
	}
	var m = new Macaroon();
	m._signature = sjcl.codec.hex.toBits(obj.signature);
	assertString(obj.location, "macaroon location");
	m._location = obj.location;
	assertString(obj.identifier, "macaroon identifier");
	m._identifier = obj.identifier;

	m._caveats = [];
	for(i in obj.caveats){
		var jsonCav = obj.caveats[i];
		var cav = {};
		if(jsonCav.cl != null){
			assertString(jsonCav.cl, "caveat location");
			cav._location = jsonCav.cl;
		}
		if(jsonCav.vid != null) {
			assertString(jsonCav.vid, "caveat verification id");
			cav._vid = sjcl.codec.base64.toBits(jsonCav.vid, false);
		}
		assertString(jsonCav.cid, "caveat id");
		cav._identifier = jsonCav.cid;
		m._caveats[i] = cav;
	}
	return m;
};

// export converts a macaroon or array of macaroons
// to the exported object form, suitable for encoding as JSON.
exports.export = function(m) {
	var i;
	if(m.constructor == Array){
		var result = [];
		for(i in m){
			result[i] = exports.export(m[i]);
		}
		return result;
	}
	var obj = {
		location: m._location,
		identifier: m._identifier,
		signature: sjcl.codec.hex.fromBits(m._signature),
		caveats: [],
	};
	for(i in m._caveats){
		var cav = m._caveats[i];
		var cavObj = {
			cid: cav._identifier,
		};
		if(cav._location != null){
			cavObj.vid = sjcl.codec.base64.fromBits(cav._vid);
			cavObj.cl = cav._location;
		}
		obj.caveats[i] = cavObj;
	}
	return obj;
};

// discharge gathers discharge macaroons for all the third party caveats
// in m (and any subsequent caveats required by those) calling getDischarge to
// acquire each discharge macaroon.
//
// On success, it calls onOk with an array argument
// holding m as the first element, followed by
// all the discharge macaroons. All the discharge macaroons
// will be bound to the primary macaroon.
//
// On failure, it calls onError with any error encountered.
//
// The getDischarge argument should be a function that
// is passed five parameters: the value of m.location(),
// the location of the third party, the third party caveat id,
// all strings, a callback function to call with the acquired
// macaroon on success, and a callback function to call with
// any error on failure.
exports.discharge = function(m, getDischarge, onOk, onError) {
	var primarySig = m.signature();
	var discharges = [m];
	var pendingCount = 0;
	var errorCalled = false;
	var firstPartyLocation = m.location();
	var dischargeCaveats;
	var dischargedCallback = function(dm){
		if(errorCalled){
			return;
		}
		dm.bind(primarySig);
		discharges.push(dm);
		pendingCount--;
		dischargeCaveats(dm);
	};
	var dischargedErrorCallback = function(err) {
		if(!errorCalled){
			onError(err);
			errorCalled = true;
		}
	};
	dischargeCaveats = function(m){
		var i;
		for(i in m._caveats){
			var cav = m._caveats[i];
			if(cav._location == null){
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
		if(pendingCount == 0){
			onOk(discharges);
			return;
		}
	};
	dischargeCaveats(m);
};

// bindForRequest binds the given macaroon
// to the given signature of its parent macaroon.
function bindForRequest(rootSig, dischargeSig) {
	if(sjcl.bitArray.equal(rootSig, dischargeSig)){
		return rootSig;
	}
	var h = new sjcl.hash.sha256();
	h.update(rootSig);
	h.update(dischargeSig);
	return h.finalize();
}

// bound returns a copy of the macaroon prepared for
// being used to discharge a macaroon with the given signature,
// which should be an sjcl bitArray.
Macaroon.prototype.bind = function(sig) {
	this._signature = bindForRequest(sig, this._signature);
};

// caveats returns a list of all the caveats in the macaroon.
Macaroon.prototype.getCaveats = function() {
};

// signature returns the macaroon's signature as a buffer.
Macaroon.prototype.signature = function() {
	return this._signature;
};

// clone returns a copy of the macaroon. Any caveats added
// to the returned macaroon will not reflect the original.
Macaroon.prototype.clone = function() {
	var m = new Macaroon();
	m._signature = this._signature;
	m._identifier = this._identifier;
	m._location = this._location;
	m._caveats = this._caveats.slice();
	return m;
};

// location returns the location of the macaroon
// as a string.
Macaroon.prototype.location = function() {
	return this._location;
};

// id returns the macaroon's identifier as a string.
Macaroon.prototype.id = function() {
	return this._identifier;
};

// signature returns the macaroon's signature as
// sjcl bitArray.
Macaroon.prototype.signature = function() {
	return this._signature;
};

// addThirdPartyCaveat adds a third-party caveat to the macaroon,
// using the given shared root key, caveat id and location hint.
// The caveat id should encode the root key in some
// way, either by encrypting it with a key known to the third party
// or by holding a reference to it stored in the third party's
// storage.
// The root key must be an sjcl bitArray; the other arguments
// must be strings.
Macaroon.prototype.addThirdPartyCaveat = function(rootKey, caveatId, loc) {
	assertBitArray(rootKey, "caveat root key");
	assertString(caveatId, "caveat id");
	assertString(loc, "caveat location");
	var verificationId = encrypt(this._signature, rootKey);
	this.addCaveat(caveatId, verificationId, loc);
};

// addFirstPartyCaveat adds a caveat that will be verified
// by the target service. The caveat id must be a string.
Macaroon.prototype.addFirstPartyCaveat = function(caveatId) {
	this.addCaveat(caveatId, null, null);
};

// addCaveat adds a first or third party caveat. The caveat id must be
// a string. For a first party caveat, the verification id and the
// location must be null, otherwise the verification id must be
// a sjcl bitArray and the location must be a string.
Macaroon.prototype.addCaveat = function(caveatId, verificationId, loc) {
	assertString(caveatId, "macaroon caveat id");
	var cav = {
		_identifier: caveatId,
	};
	if(loc != null){
		assertString(loc, "macaroon caveat location");
		assertBitArray(verificationId, "macaroon caveat verification id");
		cav._location = loc;
		cav._vid = verificationId;
	}
	this._caveats.push(cav);
	var h = keyedHasher(this._signature);
	if(verificationId != null){
		h.update(verificationId);
	}
	h.update(sjcl.codec.utf8String.toBits(caveatId));
	this._signature = h.digest();
};

// Verify verifies that the receiving macaroon is valid.
// The root key must be the same that the macaroon was originally
// minted with. The check function is called to verify each
// first-party caveat - it should return an error if the
// condition is not met, or null if the caveat is satisfied.
//
// The discharge macaroons should be provided as an array in discharges.
//
// Verify throws an exception if the verification fails.
Macaroon.prototype.verify = function(rootKey, check, discharges) {
	var used = [];
	var i;
	for(i in discharges){
		used[i] = 0;
	}
	this._verify(this._signature, rootKey, check, discharges, used);
	for(i in discharges){
		var dm = discharges[i];
		if(used[i] == 0){
			throw new Error("discharge macaroon " + quote(dm.id()) + " was not used");
		}
		if(used[i] != 1){
			// Should be impossible because of check in verify1, but be defensive.
			throw new Error("discharge macaroon " + quote(dm.id()) + " was used more than once");
		}
	}
};

Macaroon.prototype._verify = function(rootSig, rootKey, check, discharges, used) {
	var caveatSig = keyedHash(rootKey,  sjcl.codec.utf8String.toBits(this.id()));
	var i, di;
	for(i in this._caveats){
		var cav = this._caveats[i];
		if(cav._location != null){
			var cavKey = decrypt(caveatSig, cav._vid);
			var found = false;
			for(di in discharges){
				var dm = discharges[di];
				if(dm.id() != cav._identifier) {
					continue;
				}
				found = true;
				// It's important that we do this before calling _verify,
				// as it prevents potentially infinite recursion.
				used[di]++;
				if(used[di] > 1){
					throw new Error("discharge macaroon " + quote(dm.id()) + " was used more than once ");
				}
				dm._verify(rootSig, cavKey, check, discharges, used);
				break;
			}
			if(!found){
				throw new Error("cannot find discharge macaroon for caveat " + quote(cav._identifier));
			}
		} else {
			var err = check(cav._identifier);
			if(err){
				throw new Error(err);
			}
		}
		var sigHasher = keyedHasher(caveatSig);
		if(cav._vid != null){
			sigHasher.update(cav._vid);
		}
		sigHasher.update(cav._identifier);
		caveatSig = sigHasher.digest();
	}
	var boundSig = bindForRequest(rootSig, caveatSig);
	if(!sjcl.bitArray.equal(boundSig, this._signature)){
		throw new Error("signature mismatch after caveat verification");
	}
};
