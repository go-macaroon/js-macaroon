var assert = require("assert");
var macaroon = require("/home/rog/src/macaroonjs/macaroon");
var sjcl = require("sjcl");

'use strict';

describe('macaroon', function() {
	it('should be created with the expected signature', function() {
		var rootKey = sjcl.codec.utf8String.toBits("secret");
		var m = macaroon.newMacaroon(rootKey, "some id", "a location");
		assert.equal(m.location(), "a location");
		assert.equal(m.id(), "some id");
		assert.equal(sjcl.codec.hex.fromBits(m.signature()), "7354ae733c5688d63b60b9774b47098890e1f4de10e3071f9a279d82759b7edc");
		var obj = macaroon.export(m);
		assert.deepEqual(obj, {
			location: "a location",
			identifier: "some id",
			signature: "7354ae733c5688d63b60b9774b47098890e1f4de10e3071f9a279d82759b7edc",
			caveats: [],
		});
	});

	it('should fail when newMacaroon called with bad args', function(){
		assert.throws(function(){
			macaroon.newMacaroon(null, "some id", "a location")
		}, /invalid macaroon root key: null/)
		assert.throws(function(){
			macaroon.newMacaroon("hello", "some id", "a location")
		}, /invalid macaroon root key: hello/)
		assert.throws(function(){
			macaroon.newMacaroon(5, "some id", "a location")
		}, /invalid macaroon root key: 5/)

		var key = sjcl.codec.utf8String.toBits('key')
		assert.throws(function(){
			macaroon.newMacaroon(key, null, "a location")
		}, /invalid macaroon identifier: null/)
		assert.throws(function(){
			macaroon.newMacaroon(key, 5, "a location")
		}, /invalid macaroon identifier: 5/)
		assert.throws(function(){
			macaroon.newMacaroon(key, key, "a location")
		}, /invalid macaroon identifier: 26390080878848/)

		assert.throws(function(){
			macaroon.newMacaroon(key, "id", null)
		}, /invalid macaroon location: null/)
		assert.throws(function(){
			macaroon.newMacaroon(key, "id", 5)
		}, /invalid macaroon location: 5/)
		assert.throws(function(){
			macaroon.newMacaroon(key, "id", key)
		}, /invalid macaroon location: 26390080878848/)

		// TODO Should it be invalid to create a macaroon with an empty id or location?
	})

	it('should allow adding first party caveats', function() {
		var rootKey = sjcl.codec.utf8String.toBits("secret");
		var m = macaroon.newMacaroon(rootKey, "some id", "a location");
		m.addFirstPartyCaveat("a caveat");
		m.addFirstPartyCaveat("another caveat");
		assert.equal(sjcl.codec.hex.fromBits(m.signature()), "01a3a60cfccdbcc30e614d0bcb88928e8e791679fee8bbab2a42a7fad7c18c65");
		var obj = macaroon.export(m);
		assert.deepEqual(obj, {
			location: "a location",
			identifier: "some id",
			signature: "01a3a60cfccdbcc30e614d0bcb88928e8e791679fee8bbab2a42a7fad7c18c65",
			caveats: [{
				cid: "a caveat",
			}, {
				cid: "another caveat",
			}],
		});
	});

	it('should allow binding to another macaroon', function() {
		var rootKey = sjcl.codec.utf8String.toBits("secret");
		var m = macaroon.newMacaroon(rootKey, "some id", "a location");
		var otherSig = sjcl.codec.utf8String.toBits("another sig");
		m.bind(otherSig);
		assert.equal(sjcl.codec.hex.fromBits(m.signature()), "8d7db21cdd0002115ba1e999f6b9417ff3050df2fd0ab4c4c1bce7c1152b9f5e");
	});
})

describe('import/export', function(){
	it('should import from a single object', function(){
		var obj = 	{
			location: "a location",
			identifier: "id 1",
			signature: "e0831c334c600631bf7b860ca20c9930f584b077b8eac1f1e99c6a45d11a3d20",
			caveats: [
				{
					"cid": "a caveat"
				}, {
					"cid": "3rd question",
					"vid": "MMVAwhLcKvsgJS+SCTuhi9fMNYT9SjSePUX2q4z8y4/TpYfB82UCirA0ZICOdUb7ND/2",
					"cl": "3rd loc"
				},
			],
		}

		var m = macaroon.import(obj)
		assert.equal(m.location(), "a location");
		assert.equal(m.id(), "id 1");
		assert.equal(sjcl.codec.hex.fromBits(m.signature()), "e0831c334c600631bf7b860ca20c9930f584b077b8eac1f1e99c6a45d11a3d20");
		// Test that it round trips.
		var obj1 = macaroon.export(m);
		assert.deepEqual(obj1, obj);
	})

	it('should import from an array', function(){
		var objs = [{
			location: "a location",
			identifier: "id 0",
			signature: "4579ad730bf3f819a299aaf63f04f5e897d80690c4c5814a1ae026a45989de7d",
			caveats: [],
		}, {
			location: "a location",
			identifier: "id 1",
			signature: "99b1c2dede0ce1cba0b632e3996e9924bdaee6287151600468644b92caf3761b",
			caveats: [],
		}];
		var ms = macaroon.import(objs)
		assert.equal(ms.length, 2)
		assert.equal(ms[0].id(), "id 0")
		assert.equal(ms[1].id(), "id 1")
		
		var objs1 = macaroon.export(ms);
		console.log("got re-exported " + JSON.stringify(objs1))
		assert.deepEqual(objs1, objs);
	})
})
