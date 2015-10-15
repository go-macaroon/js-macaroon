/*jslint node: true, continue: true, eqeq: true, forin: true, nomen: true, plusplus: true, todo: true, vars: true, white: true */

var assert = require("assert");
var nacl = require("tweetnacl");
var macaroon = require("../macaroon");

"use strict";

function strUint8Array(s) {
	return nacl.util.decodeUTF8(s);
}

function Uint8ArrayToHex(ua) {
	if(!(ua instanceof Uint8Array)){
		throw new Error("invalid Uint8Array:" + ua);
	}
	var hex = '';
	for ( var i = 0; i < ua.length; i++ )
		hex += (ua[i] < 16 ? '0' : '') + ua[i].toString(16);
	return hex;
}

function never(){
	return "condition is never true";
}

function alwaysOK(){
}

// makeMacaroon makes a set of macaroon from the given macaroon specifications.
// Each macaroon specification is an object holding:
// 	- rootKey: the root key (string)
//	- id: the macaroon id (string)
//	- caveats: an array of caveats to add to the macaroon, (see below)
//	- location: the location of the macaroon (string)
//
// Each caveat is specified with an object holding:
// 	- rootKey: the caveat root key (string, optional)
//	- location: the caveat location (string, optional)
//	- condition: the caveat condition (string)
function makeMacaroons(mspecs) {
	var macaroons = [];
	var i;
	for(i in mspecs){
		var j;
		var mspec = mspecs[i];
		if(mspec.location === undefined){
			mspec.location = "";
		}
		var m = macaroon.newMacaroon(strUint8Array(mspec.rootKey), mspec.id, mspec.location);
		for(j in mspec.caveats){
			var cav = mspec.caveats[j];
			if(cav.location !== undefined){
				m.addThirdPartyCaveat(strUint8Array(cav.rootKey), cav.condition, cav.location);
			} else {
				m.addFirstPartyCaveat(cav.condition);
			}
		}
		macaroons.push(m);
	}
	var primary = macaroons[0];
	var discharges = macaroons.slice(1);
	for(i in discharges){
		discharges[i].bind(primary.signature());
	}
	return [strUint8Array(mspecs[0].rootKey), primary, discharges];
}

describe("macaroon", function() {
	it("should be created with the expected signature", function() {
		var rootKey = strUint8Array("secret");
		var m = macaroon.newMacaroon(rootKey, "some id", "a location");
		assert.equal(m.location(), "a location");
		assert.equal(m.id(), "some id");
		assert.equal(Uint8ArrayToHex(m.signature()), "d916ce6f9b62dc4a080ce5d4a660956471f19b860da4242b0852727331c1033d");
		var obj = macaroon.export(m);
		assert.deepEqual(obj, {
			location: "a location",
			identifier: "some id",
			signature: "d916ce6f9b62dc4a080ce5d4a660956471f19b860da4242b0852727331c1033d",
			caveats: [],
		});

		m.verify(rootKey, never, null);
	});

	it("should fail when newMacaroon called with bad args", function(){
		assert.throws(function(){
			macaroon.newMacaroon(null, "some id", "a location");
		}, /invalid macaroon root key: null/);
		assert.throws(function(){
			macaroon.newMacaroon("hello", "some id", "a location");
		}, /invalid macaroon root key: hello/);
		assert.throws(function(){
			macaroon.newMacaroon(5, "some id", "a location");
		}, /invalid macaroon root key: 5/);

		var key = strUint8Array('key');
		assert.throws(function(){
			macaroon.newMacaroon(key, null, "a location");
		}, /invalid macaroon identifier: null/);
		assert.throws(function(){
			macaroon.newMacaroon(key, 5, "a location");
		}, /invalid macaroon identifier: 5/);
		assert.throws(function(){
			macaroon.newMacaroon(key, key, "a location");
		}, /invalid macaroon identifier: \[object Uint8Array\]/);

		assert.throws(function(){
			macaroon.newMacaroon(key, "id", null);
		}, /invalid macaroon location: null/);
		assert.throws(function(){
			macaroon.newMacaroon(key, "id", 5);
		}, /invalid macaroon location: 5/);
		assert.throws(function(){
			macaroon.newMacaroon(key, "id", key);
		}, /invalid macaroon location: \[object Uint8Array\]/);

		// TODO Should it be invalid to create a macaroon with an empty id or location?
	});

	it("should allow adding first party caveats", function() {
		var cav;
		var rootKey = strUint8Array("secret");
		var m = macaroon.newMacaroon(rootKey, "some id", "a location");
		var caveats = ["a caveat", "another caveat"]
		var trueCaveats = {}
		var checked = {}
		var tested = {};
		for(i in caveats) {
			m.addFirstPartyCaveat(caveats[i]);
			trueCaveats[caveats[i]] = true
		}
		assert.equal(Uint8ArrayToHex(m.signature()), "c934e6af642ee55a4e4cfc56e07706cf1c6c94dc2192e5582943cddd88dc99d8");
		var obj = macaroon.export(m);
		assert.deepEqual(obj, {
			location: "a location",
			identifier: "some id",
			signature: "c934e6af642ee55a4e4cfc56e07706cf1c6c94dc2192e5582943cddd88dc99d8",
			caveats: [{
				cid: "a caveat",
			}, {
				cid: "another caveat",
			}],
		});
		var check = function(cav){
			tested[cav] = true;
			if(!trueCaveats[cav]){
				return "condition not met";
			}
		};
		m.verify(rootKey, check, null);
		assert.deepEqual(tested, trueCaveats);

		m.addFirstPartyCaveat("not met");
		assert.throws(function(){
			m.verify(rootKey, check, null);
		}, /condition not met/);

		assert.equal(tested["not met"], true);
	});

	it("should allow adding a third party caveat", function() {
		var rootKey = strUint8Array("secret");
		var m = macaroon.newMacaroon(rootKey, "some id", "a location");

		var dischargeRootKey = strUint8Array("shared root key");
		var thirdPartyCaveatId = "3rd party caveat";
		m.addThirdPartyCaveat(dischargeRootKey, thirdPartyCaveatId, "remote.com");

		var dm = macaroon.newMacaroon(dischargeRootKey, thirdPartyCaveatId, "remote location");
		dm.bind(m.signature());
		m.verify(rootKey, never, [dm]);
	})

	it("should allow binding to another macaroon", function() {
		var rootKey = strUint8Array("secret");
		var m = macaroon.newMacaroon(rootKey, "some id", "a location");
		var otherSig = strUint8Array("another sig");
		m.bind(otherSig);
		assert.equal(Uint8ArrayToHex(m.signature()), "bba29be9ed9485a594f678adad69b7071c2f353308933355fc81cfad601b8277");
	});
});

describe("import/export", function(){
	it("should import from a single object", function(){
		var obj = 	{
			location: "a location",
			identifier: "id 1",
			signature: "e0831c334c600631bf7b860ca20c9930f584b077b8eac1f1e99c6a45d11a3d20",
			caveats: [
				{
					"cid": "a caveat"
				}, {
					"cid": "3rd question",
					"vid": "MMVAwhLcKvsgJS-SCTuhi9fMNYT9SjSePUX2q4z8y4_TpYfB82UCirA0ZICOdUb7ND_2",
					"cl": "3rd loc"
				},
			],
		};

		var m = macaroon.import(obj);
		assert.equal(m.location(), "a location");
		assert.equal(m.id(), "id 1");
		assert.equal(Uint8ArrayToHex(m.signature()), "e0831c334c600631bf7b860ca20c9930f584b077b8eac1f1e99c6a45d11a3d20");
		// Test that it round trips.
		var obj1 = macaroon.export(m);
		assert.deepEqual(obj1, obj);
	})

	it("should import from an array", function(){
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
		var ms = macaroon.import(objs);
		assert.equal(ms.length, 2);
		assert.equal(ms[0].id(), "id 0");
		assert.equal(ms[1].id(), "id 1");
		
		var objs1 = macaroon.export(ms);
		assert.deepEqual(objs1, objs);
	});
});

var recursiveThirdPartyCaveatMacaroons = [{
	rootKey: "root-key",
	id:      "root-id",
	caveats: [{
		condition: "wonderful",
	}, {
		condition: "bob-is-great",
		location:  "bob",
		rootKey:   "bob-caveat-root-key",
	}, {
		condition: "charlie-is-great",
		location:  "charlie",
		rootKey:   "charlie-caveat-root-key",
	}],
}, {
	location: "bob",
	rootKey:  "bob-caveat-root-key",
	id:       "bob-is-great",
	caveats: [{
		condition: "splendid",
	}, {
		condition: "barbara-is-great",
		location:  "barbara",
		rootKey:   "barbara-caveat-root-key",
	}],
}, {
	location: "charlie",
	rootKey:  "charlie-caveat-root-key",
	id:       "charlie-is-great",
	caveats: [{
		condition: "splendid",
	}, {
		condition: "celine-is-great",
		location:  "celine",
		rootKey:   "celine-caveat-root-key",
	}],
}, {
	location: "barbara",
	rootKey:  "barbara-caveat-root-key",
	id:       "barbara-is-great",
	caveats: [{
		condition: "spiffing",
	}, {
		condition: "ben-is-great",
		location:  "ben",
		rootKey:   "ben-caveat-root-key",
	}],
}, {
	location: "ben",
	rootKey:  "ben-caveat-root-key",
	id:       "ben-is-great",
}, {
	location: "celine",
	rootKey:  "celine-caveat-root-key",
	id:       "celine-is-great",
	caveats: [{
		condition: "high-fiving",
	}],
}];

var verifyTests = [{
	about: "single third party caveat without discharge",
	macaroons: [{
		rootKey: "root-key",
		id:      "root-id",
		caveats: [{
			condition: "wonderful",
		}, {
			condition: "bob-is-great",
			location:  "bob",
			rootKey:   "bob-caveat-root-key",
		}],
	}],
	conditions: [{
		conditions: {
			"wonderful": true,
		},
		expectErr: /cannot find discharge macaroon for caveat "bob-is-great"/,
	}],
}, {
	about: "single third party caveat with discharge",
	macaroons: [{
		rootKey: "root-key",
		id:      "root-id",
		caveats: [{
			condition: "wonderful",
		}, {
			condition: "bob-is-great",
			location:  "bob",
			rootKey:   "bob-caveat-root-key",
		}],
	}, {
		location: "bob",
		rootKey:  "bob-caveat-root-key",
		id:       "bob-is-great",
	}],
	conditions: [{
		conditions: {
			"wonderful": true,
		},
	}, {
		conditions: {
			"wonderful": false,
		},
		expectErr: /condition "wonderful" not met/,
	}],
}, {
	about: "single third party caveat with discharge with mismatching root key",
	macaroons: [{
		rootKey: "root-key",
		id:      "root-id",
		caveats: [{
			condition: "wonderful",
		}, {
			condition: "bob-is-great",
			location:  "bob",
			rootKey:   "bob-caveat-root-key",
		}],
	}, {
		location: "bob",
		rootKey:  "bob-caveat-root-key-wrong",
		id:       "bob-is-great",
	}],
	conditions: [{
		conditions: {
			"wonderful": true,
		},
		expectErr: /signature mismatch after caveat verification/,
	}],
}, {
	about: "single third party caveat with two discharges",
	macaroons: [{
		rootKey: "root-key",
		id:      "root-id",
		caveats: [{
			condition: "wonderful",
		}, {
			condition: "bob-is-great",
			location:  "bob",
			rootKey:   "bob-caveat-root-key",
		}],
	}, {
		location: "bob",
		rootKey:  "bob-caveat-root-key",
		id:       "bob-is-great",
		caveats: [{
			condition: "splendid",
		}],
	}, {
		location: "bob",
		rootKey:  "bob-caveat-root-key",
		id:       "bob-is-great",
		caveats: [{
			condition: "top of the world",
		}],
	}],
	conditions: [{
		conditions: {
			"wonderful": true,
		},
		expectErr: /condition "splendid" not met/,
	}, {
		conditions: {
			"wonderful":        true,
			"splendid":         true,
			"top of the world": true,
		},
		expectErr: /discharge macaroon "bob-is-great" was not used/,
	}, {
		conditions: {
			"wonderful":        true,
			"splendid":         false,
			"top of the world": true,
		},
		expectErr: /condition "splendid" not met/,
	}, {
		conditions: {
			"wonderful":        true,
			"splendid":         true,
			"top of the world": false,
		},
		expectErr: /discharge macaroon "bob-is-great" was not used/,
	}],
}, {
	about: "one discharge used for two macaroons",
	macaroons: [{
		rootKey: "root-key",
		id:      "root-id",
		caveats: [{
			condition: "somewhere else",
			location:  "bob",
			rootKey:   "bob-caveat-root-key",
		}, {
			condition: "bob-is-great",
			location:  "charlie",
			rootKey:   "bob-caveat-root-key",
		}],
	}, {
		location: "bob",
		rootKey:  "bob-caveat-root-key",
		id:       "somewhere else",
		caveats: [{
			condition: "bob-is-great",
			location:  "charlie",
			rootKey:   "bob-caveat-root-key",
		}],
	}, {
		location: "bob",
		rootKey:  "bob-caveat-root-key",
		id:       "bob-is-great",
	}],
	conditions: [{
		expectErr: /discharge macaroon "bob-is-great" was used more than once/,
	}],
}, {
	about: "recursive third party caveat",
	macaroons: [{
		rootKey: "root-key",
		id:      "root-id",
		caveats: [{
			condition: "bob-is-great",
			location:  "bob",
			rootKey:   "bob-caveat-root-key",
		}],
	}, {
		location: "bob",
		rootKey:  "bob-caveat-root-key",
		id:       "bob-is-great",
		caveats: [{
			condition: "bob-is-great",
			location:  "charlie",
			rootKey:   "bob-caveat-root-key",
		}],
	}],
	conditions: [{
		expectErr: /discharge macaroon "bob-is-great" was used more than once/,
	}],
}, {
	about: "two third party caveats",
	macaroons: [{
		rootKey: "root-key",
		id:      "root-id",
		caveats: [{
			condition: "wonderful",
		}, {
			condition: "bob-is-great",
			location:  "bob",
			rootKey:   "bob-caveat-root-key",
		}, {
			condition: "charlie-is-great",
			location:  "charlie",
			rootKey:   "charlie-caveat-root-key",
		}],
	}, {
		location: "bob",
		rootKey:  "bob-caveat-root-key",
		id:       "bob-is-great",
		caveats: [{
			condition: "splendid",
		}],
	}, {
		location: "charlie",
		rootKey:  "charlie-caveat-root-key",
		id:       "charlie-is-great",
		caveats: [{
			condition: "top of the world",
		}],
	}],
	conditions: [{
		conditions: {
			"wonderful":        true,
			"splendid":         true,
			"top of the world": true,
		},
	}, {
		conditions: {
			"wonderful":        true,
			"splendid":         false,
			"top of the world": true,
		},
		expectErr: /condition "splendid" not met/,
	}, {
		conditions: {
			"wonderful":        true,
			"splendid":         true,
			"top of the world": false,
		},
		expectErr: /condition "top of the world" not met/,
	}],
}, {
	about: "third party caveat with undischarged third party caveat",
	macaroons: [{
		rootKey: "root-key",
		id:      "root-id",
		caveats: [{
			condition: "wonderful",
		}, {
			condition: "bob-is-great",
			location:  "bob",
			rootKey:   "bob-caveat-root-key",
		}],
	}, {
		location: "bob",
		rootKey:  "bob-caveat-root-key",
		id:       "bob-is-great",
		caveats: [{
			condition: "splendid",
		}, {
			condition: "barbara-is-great",
			location:  "barbara",
			rootKey:   "barbara-caveat-root-key",
		}],
	}],
	conditions: [{
		conditions: {
			"wonderful": true,
			"splendid":  true,
		},
		expectErr: /cannot find discharge macaroon for caveat "barbara-is-great"/,
	}],
}, {
	about:     "recursive third party caveats",
	macaroons: recursiveThirdPartyCaveatMacaroons,
	conditions: [{
		conditions: {
			"wonderful":   true,
			"splendid":    true,
			"high-fiving": true,
			"spiffing":    true,
		},
	}, {
		conditions: {
			"wonderful":   true,
			"splendid":    true,
			"high-fiving": false,
			"spiffing":    true,
		},
		expectErr: /condition "high-fiving" not met/,
	}],
}, {
	about: "unused discharge",
	macaroons: [{
		rootKey: "root-key",
		id:      "root-id",
	}, {
		rootKey: "other-key",
		id:      "unused",
	}],
	conditions: [{
		expectErr: /discharge macaroon "unused" was not used/,
	}],
}];

describe("verify", function(){
	var i;
	for(i in verifyTests){
		var test = verifyTests[i];
		it("should work with " + test.about, function(test){
			return function(){
				var j;
				var keyMac = makeMacaroons(test.macaroons);
				var rootKey = keyMac[0];
				var primary = keyMac[1];
				var discharges = keyMac[2];
				for(j in test.conditions){
					var cond = test.conditions[j];
					var check = function(cav) {
						if(cond.conditions[cav]){
							return null;
						}
						return 'condition "' + cav + '" not met';
					};
					if(cond.expectErr !== undefined){
						assert.throws(function(){
								primary.verify(rootKey, check, discharges);
							}, cond.expectErr, "expected error " + cond.expectErr);
					} else {
						primary.verify(rootKey, check, discharges);
					}
					// Cloned macaroon should have the same verify result.
					primary = primary.clone();
					if(cond.expectErr !== undefined){
						assert.throws(function(){
								primary.verify(rootKey, check, discharges);
							}, cond.expectErr, "expected error " + cond.expectErr);
					} else {
						primary.verify(rootKey, check, discharges);
					}
				}
			};
		}(test));
	}
});

var externalRootKey = strUint8Array("root-key");

// Produced by running this code: http://play.golang.org/p/Cn7q91tuql
var externalMacaroons = [
	{
		"caveats": [
			{
				"cid": "wonderful"
			},
			{
				"cid": "bob-is-great",
				"vid": "YnpoATFtXlPux-ASP0iXsud5KqOAPy2zLxSjnGt0OY0L1XooSQagZeupd001spBjNh2IqG6i99OB9O2ERyNKMxpY5oMInKaC",
				"cl": "bob"
			},
			{
				"cid": "charlie-is-great",
				"vid": "pvwga-URCMCaYElz3pdB984Hy9efe7xyVeY0vdlil1-nVVsS4KVvOrG1eQvZdpN1oEEDydSuiLzHE3dJMpqZ-qXZ9RV4NJ7C",
				"cl": "charlie"
			}
		],
		"location": "",
		"identifier": "root-id",
		"signature": "79240bb490c6940658106811ad7033de5047ea0ef295d2d882da53b2e43bf3a1"
	},
	{
		"caveats": [
			{
				"cid": "splendid"
			}
		],
		"location": "bob",
		"identifier": "bob-is-great",
		"signature": "0389d56449d5e66289f7bfc8771757204051e9eb3ee99e522cf23484bdaf1629"
	},
	{
		"caveats": [
			{
				"cid": "top of the world"
			}
		],
		"location": "charlie",
		"identifier": "charlie-is-great",
		"signature": "c48affa09c0fd0560e2a3176b639c09b4bdf957a379660f86f7bb35e14c8865e"
	}
];

describe("verify external third party macaroons", function(){
	it("should verify correctly", function(){
		var ms = macaroon.import(externalMacaroons);
		ms[0].verify(externalRootKey, function(){}, ms.slice(1));
	});
});

describe("discharge", function(){
	it("should discharge a macaroon with no caveats without calling getDischarge", function(){
		var m = macaroon.newMacaroon(strUint8Array("key"), "some id", "a location");
		m.addFirstPartyCaveat("a caveat");
		var getDischarge = function(){
			throw "getDischarge called unexpectedly";
		};
		var result;
		var onOk = function(ms) {
			result = ms;
		};
		var onErr = function(err) {
			throw "onErr called unexpectedly";
		};
		macaroon.discharge(m, getDischarge, onOk, onErr);
		assert.deepEqual(result, [m]);
	});
	var queued = [];
	it("should discharge many discharges correctly", function(){
		var rootKey = strUint8Array("secret");
		var m0 = macaroon.newMacaroon(rootKey, "id0", "location0");
		var totalRequired = 40;
		var id = 1;
		var addCaveats = function(m) {
			var i;
			for(i = 0; i < 2; i++){
				if(totalRequired === 0){
					break;
				}
				var cid = "id" + id;
				m.addThirdPartyCaveat(strUint8Array("root key " + cid), cid, "somewhere");
				id++;
				totalRequired--;
			}
		};
		addCaveats(m0);
		var getDischarge = function(loc, thirdPartyLoc, cond, onOK, onErr) {
			assert.equal(loc, "location0");
			var m = macaroon.newMacaroon(strUint8Array("root key " + cond), cond, "");
			addCaveats(m);
			queued.push(function(){
				onOK(m);
			});
		};
		var discharges;
		macaroon.discharge(m0, getDischarge, function(ms){
			discharges = ms;
		}, function(err) {
			throw new Error("error callback called unexpectedly: " + err);
		});
		while(queued.length > 0){
			var f = queued.shift();
			f();
		}
		assert.notEqual(discharges, null);
		assert.equal(discharges.length, 41);
		discharges[0].verify(rootKey, alwaysOK, discharges.slice(1));
	});
});
