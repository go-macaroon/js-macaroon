var exports = module.exports = {};

var sjcl = require("sjcl");

'use strict';

// newMacaroon returns a new macaroon with the given
// root key, identifier and location.
// The root key must be an sjcl bitArray.
// TODO accept string, Buffer, for root key?
exports.newMacaroon = function(rootKey, id, loc) {
	var m = new Macaroon();
	m._caveats = [];
	assertString(loc, "macaroon location");
	assertString(id, "macaroon identifier");
	assertBitArray(rootKey, "macaroon root key")
	m._location = loc;
	m._identifier = id;
	m._signature = keyedHash(rootKey, sjcl.codec.utf8String.toBits(id));
	return m;
}

// keyedHasher returns a keyed hash using the given
// key, which must be an sjcl bitArray.
var keyedHasher = function(key) {
	return new sjcl.misc.hmac(key, sjcl.hash.sha256);
}

// keyedHash returns the keyed hash of the given
// data. Both key and data must be sjcl bitArrays.
// It returns the hash as an sjcl bitArray.
var keyedHash = function(key, data) {
	var h = keyedHasher(key);
	h.update(data);
	return h.digest();
}

// import converts an object as deserialised from
// JSON to a macaroon. It also accepts an array of objects,
// returning the resulting array of macaroons.
exports.import = function(obj) {
	if(obj.constructor == Array){
		var result = [];
		for(var i in obj){
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
	for(var i in obj.caveats){
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
}

// export converts a macaroon or array of macaroons
// to the exported object form, suitable for encoding as JSON.
exports.export = function(m) {
	if(m.constructor == Array){
		var result = []
		for(var i in m){
			result[i] = exports.export(m[i]);
		}
		return result;
	}
	var obj = {
		location: m._location,
		identifier: m._identifier,
		signature: sjcl.codec.hex.fromBits(m._signature),
		caveats: []
	};
	for(var i in m._caveats) {
		var cav = m._caveats[i];
		var cavObj = {
			cid: cav._identifier
		};
		if(cav._location != null){
			cavObj.vid = sjcl.codec.base64.fromBits(cav._vid)
			cavObj.cl = cav._location
		};
		obj.caveats[i] = cavObj
	}
	return obj;
}

// discharge gathers discharge macaroons for all the third party caveats
// in m (and any subsequent caveats required by those) calling getDischarge to
// acquire each discharge macaroon.
//
// It returns an array with m as the first element, followed by
// all the discharge macaroons. All the discharge macaroons
// will be bound to the primary macaroon.
//
// The getDischarge argument should be a function that
// is passed three parameters: the value of m.location(),
// the location of the third party, and the third party caveat id,
// all as strings.
exports.discharge = function(m, getDischarge) {
	var sig = m.signature()
	var discharges = [m]
	var need = []
	var addCaveats = function(m){
		for(var i in m._caveats){
			var cav = m._caveats[i]
			if(cav._location != null){
				need.push(cav);
			}
		}
	}
	addCaveats(m)
	var firstPartyLocation = m.Location();
	while(need.length > 0){
		var cav = need.shift();
		var dm = getDischarge(firstPartyLocation, cav._location, cav._identifier)
		dm.bind(sig);
		discharges.push(dm);
		addCaveats(dm);
	}
	return discharges;
}

function Macaroon() {}

// bound returns a copy of the macaroon prepared for
// being used to discharge a macaroon with the given signature,
// which should be an sjcl bitArray.
Macaroon.prototype.bind = function(sig) {
	var h = new sjcl.hash.sha256();
	h.update(sig)
	h.update(this._signature)
	this._signature = h.finalize()
}

// caveats returns a list of all the caveats in the macaroon.
Macaroon.prototype.getCaveats = function() {
}

// signature returns the macaroon's signature as a buffer.
Macaroon.prototype.signature = function() {
	return this._signature
}

// clone returns a copy of the macaroon. Any caveats added
// to the returned macaroon will not reflect the original.
Macaroon.prototype.clone = function() {
	m = new(Macaroon)
	m._signature = this._signature
	m._identifier = this._identifier
	m._location = this._location
	m._caveats = this._caveats.slice()
	return m
}

// location returns the location of the macaroon
// as a string.
Macaroon.prototype.location = function() {
	return this._location
}

// id returns the macaroon's identifier as a string.
Macaroon.prototype.id = function() {
	return this._identifier
}

// signature returns the macaroon's signature as
// sjcl bitArray.
Macaroon.prototype.signature = function() {
	return this._signature
}

// addThirdPartyCaveat adds a third-party caveat to the macaroon,
// using the given shared root key, caveat id and location hint.
// The caveat id should encode the root key in some
// way, either by encrypting it with a key known to the third party
// or by holding a reference to it stored in the third party's
// storage.
Macaroon.prototype.addThirdPartyCaveat = function(rootKey, caveatId, loc) {
	// TODO implement this when we have a working JS implementation
	// of the nacl secretbox algorithms.
	throw "withThirdPartyCaveat not implemented"
}

// addFirstPartyCaveat adds a caveat that will be verified
// by the target service. The caveat id must be a string.
Macaroon.prototype.addFirstPartyCaveat = function(caveatId) {
	this.addCaveat(caveatId, null, null)
}

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
	this._signature = h.digest()
}

// assertString asserts that the given object
// is a string, and fails with an exception including
// "what" if it is not.
function assertString(obj, what) {
	if(typeof(obj) != "string"){
		throw("invalid " + what + ": " + obj)
	}
}

// assertBitArray asserts that the given object
// is a bit array, and fails with an exception including
// "what" if it is not.
function assertBitArray(obj, what) {
	// TODO is a more specific test than this possible?
	if(!(obj instanceof Array)){
		throw("invalid " + what + ": " + obj)
	}
}
