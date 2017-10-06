'use strict';

const test = require('tape');
const sjcl = require('sjcl');

const m = require('../macaroon');

test('should serialize json format without caveats', t => {
  const macaroon = m.newMacaroon({
    rootKey: Buffer.from('this is the key'),
    identifier: 'keyid',
    location: 'http://example.org/'
  });

  t.deepEqual(macaroon.serializeJson(), {'v':2,'l':'http://example.org/','i':'keyid','c':[],'s64':'fN7nklEcW8b1KEhYBd_psk54XijiqZMB-dcRxgnjjvc'});
  t.end();
});

test('should serialize json format with one caveat', t => {
  const macaroon = m.newMacaroon({
    rootKey: Buffer.from('this is the key'),
    identifier: 'keyid',
    location: 'http://example.org/'
  });
  macaroon.addFirstPartyCaveat('account = 3735928559');

  t.deepEqual(macaroon.serializeJson(), {'v':2,'l':'http://example.org/','i':'keyid','c':[{'i':'account = 3735928559'}],'s64':'9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc'});
  t.end();
});

test('should serialize json format with two caveats', t => {
  const macaroon = m.newMacaroon({
    rootKey: Buffer.from('this is the key'),
    identifier: 'keyid',
    location: 'http://example.org/'
  });
  macaroon.addFirstPartyCaveat('account = 3735928559');
  macaroon.addFirstPartyCaveat('user = alice');

  t.deepEqual(macaroon.serializeJson(), {'v':2,'l':'http://example.org/','i':'keyid','c':[{'i':'account = 3735928559'},{'i':'user = alice'}],'s64':'S-lnzR6gxrJrr2pKlO6bBbFYhtoLqF6MQqk8jQ4SXvw'});
  t.end();
});

test('should deserialize json format without caveats', t => {
  const macaroon = m.deserializeJson({'v':2,'l':'http://example.org/','i':'keyid','c':[],'s64':'fN7nklEcW8b1KEhYBd_psk54XijiqZMB-dcRxgnjjvc'});
  t.equal(macaroon._location, 'http://example.org/');
  t.equal(macaroon._identifier, 'keyid');
  t.equal(macaroon._caveats.length, 0);
  t.equal(sjcl.codec.base64.fromBits(macaroon._signature), 'fN7nklEcW8b1KEhYBd/psk54XijiqZMB+dcRxgnjjvc=');
  t.end();
});

test('should deserialize json format with one caveat', t => {
  const macaroon = m.deserializeJson({'v':2,'l':'http://example.org/','i':'keyid','c':[{'i':'account = 3735928559'}],'s64':'9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc'});
  t.equal(macaroon._location, 'http://example.org/');
  t.equal(macaroon._identifier, 'keyid');
  t.equal(macaroon._caveats.length, 1);
  t.equal(macaroon._caveats[0]._identifier, 'account = 3735928559');
  t.ok(Buffer.from(sjcl.codec.base64.fromBits(macaroon._signature), 'base64').equals(Buffer.from('9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc', 'base64')));
  t.end();
});

test('should deserialize json format with two caveats', t => {
  const macaroon = m.deserializeJson({'v':2,'l':'http://example.org/','i':'keyid','c':[{'i':'account = 3735928559'},{'i':'user = alice'}],'s64':'S-lnzR6gxrJrr2pKlO6bBbFYhtoLqF6MQqk8jQ4SXvw'});
  t.equal(macaroon._location, 'http://example.org/');
  t.equal(macaroon._identifier, 'keyid');
  t.equal(macaroon._caveats.length, 2);
  t.equal(macaroon._caveats[0]._identifier, 'account = 3735928559');
  t.equal(macaroon._caveats[1]._identifier, 'user = alice');
  t.ok(Buffer.from(sjcl.codec.base64.fromBits(macaroon._signature), 'base64').equals(Buffer.from('S+lnzR6gxrJrr2pKlO6bBbFYhtoLqF6MQqk8jQ4SXvw=', 'base64')));
  t.end();
});
