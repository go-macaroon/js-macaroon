'use strict';

const test = require('tape');
const testUtils = require('./test-utils');

const m = require('../macaroon');

test('should serialize json format without caveats', t => {
  const macaroon = m.newMacaroon({
    rootKey: 'this is the key',
    identifier: 'keyid',
    location: 'http://example.org/'
  });

  t.deepEqual(macaroon.exportJSON(), {'v':2,'l':'http://example.org/','i':'keyid','s64':'fN7nklEcW8b1KEhYBd_psk54XijiqZMB-dcRxgnjjvc'});
  t.end();
});

test('should serialize json format with one caveat', t => {
  const macaroon = m.newMacaroon({
    rootKey: 'this is the key',
    identifier: 'keyid',
    location: 'http://example.org/'
  });
  macaroon.addFirstPartyCaveat('account = 3735928559');

  t.deepEqual(macaroon.exportJSON(), {'v':2,'l':'http://example.org/','i':'keyid','c':[{'i':'account = 3735928559'}],'s64':'9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc'});
  t.end();
});

test('should serialize json format with two caveats', t => {
  const macaroon = m.newMacaroon({
    rootKey: 'this is the key',
    identifier: 'keyid',
    location: 'http://example.org/'
  });
  macaroon.addFirstPartyCaveat('account = 3735928559');
  macaroon.addFirstPartyCaveat('user = alice');

  t.deepEqual(macaroon.exportJSON(), {'v':2,'l':'http://example.org/','i':'keyid','c':[{'i':'account = 3735928559'},{'i':'user = alice'}],'s64':'S-lnzR6gxrJrr2pKlO6bBbFYhtoLqF6MQqk8jQ4SXvw'});
  t.end();
});

test('should deserialize json format without caveats', t => {
  const macaroon = m.importMacaroon({'v':2,'l':'http://example.org/','i':'keyid','c':[],'s64':'fN7nklEcW8b1KEhYBd_psk54XijiqZMB-dcRxgnjjvc'});
  t.equal(macaroon.location, 'http://example.org/');
  t.equal(testUtils.bytesToString(macaroon.identifier), 'keyid');
  t.equal(macaroon.caveats.length, 0);
  t.equal(testUtils.bytesToBase64(macaroon.signature), 'fN7nklEcW8b1KEhYBd_psk54XijiqZMB-dcRxgnjjvc');
  t.end();
});

test('should deserialize json format with one caveat', t => {
  const macaroon = m.importMacaroon({'v':2,'l':'http://example.org/','i':'keyid','c':[{'i':'account = 3735928559'}],'s64':'9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc'});
  t.equal(macaroon.location, 'http://example.org/');
  t.equal(testUtils.bytesToString(macaroon.identifier), 'keyid');
  const caveats = macaroon.caveats;
  t.equal(caveats.length, 1);
  t.equal(testUtils.bytesToString(caveats[0].identifier), 'account = 3735928559');
  t.equal(testUtils.bytesToBase64(macaroon.signature), '9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc');
  t.end();
});

const macaroonVersionTests = [
  {
    about: 'Version 0',
    macaroon: {
      'v': 0,
      'l':'http://example.org/',
      'i':'keyid',
      'c':[{'i':'account = 3735928559'}],
      's64':'9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc'
    },
    conditions: {
      expectErr: /Unsupported macaroon version 0/
    }
  },
  {
    about: 'Version 1 Test',
    macaroon: {
      'v': 1,
      'l':'http://example.org/',
      'i':'keyid',
      'c':[{'i':'account = 3735928559'}],
      's64':'9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc'
    },
    conditions: {
      expectErr: /Unsupported macaroon version 1/
    }
  },
  {
    about: 'Version 2 Test',
    macaroon: {
      'v': 2,
      'l':'http://example.org/',
      'i':'keyid',
      'c':[{'i':'account = 3735928559'}],
      's64':'9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc'
    },
    conditions: {}
  },
  {
    about: 'Version 3 Test',
    macaroon: {
      'v': 3,
      'l':'http://example.org/',
      'i':'keyid',
      'c':[{'i':'account = 3735928559'}],
      's64':'9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc'
    },
    conditions: {
      expectErr: /Unsupported macaroon version 3/
    }
  },
  {
    about: 'Empty Test',
    macaroon: {
      'v': '',
      'l':'http://example.org/',
      'i':'keyid',
      'c':[{'i':'account = 3735928559'}],
      's64':'9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc'
    },
    conditions: {
      expectErr: /Unsupported macaroon version /
    }
  },
  {
    about: 'Null Version Test',
    macaroon: {
      'v': null,
      'l':'http://example.org/',
      'i':'keyid',
      'c':[{'i':'account = 3735928559'}],
      's64':'9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc'
    },
    conditions: {
      expectErr: /Unsupported macaroon version /
    }
  },
  {
    about: 'String Version Test',
    macaroon: {
      'v': 'V2',
      'l':'http://example.org/',
      'i':'keyid',
      'c':[{'i':'account = 3735928559'}],
      's64':'9UgH9txu34i_D3MGs4IlYqNiUz2_czm6YXZdpL0lnYc'
    },
    conditions: {
      expectErr: /Unsupported macaroon version V2/
    }
  }
];

test('should not deserialize json format with invalid version', t => {
  for (const i in macaroonVersionTests) {
    const testData = macaroonVersionTests[i];

    t.test(testData.about, t => {
      const mac = testData.macaroon;
      if (testData.conditions.expectErr) {
        t.throws(() => {
          m.importMacaroon(mac);
        }, testData.conditions.expectErr, 'Expected error: ' + testData.conditions.expectErr);
      } else {
        m.importMacaroon(mac);
      }
      t.end();
    });
  }
});


test('should deserialize json format with two caveats', t => {
  const macaroon = m.importMacaroon({'v': 2, 'l':'http://example.org/','i':'keyid','c':[{'i':'account = 3735928559'},{'i':'user = alice'}],'s64':'S-lnzR6gxrJrr2pKlO6bBbFYhtoLqF6MQqk8jQ4SXvw'});
  t.equal(macaroon.location, 'http://example.org/');
  t.equal(testUtils.bytesToString(macaroon.identifier), 'keyid');
  const caveats = macaroon.caveats;
  t.equal(caveats.length, 2);
  t.equal(testUtils.bytesToString(caveats[0].identifier), 'account = 3735928559');
  t.equal(testUtils.bytesToString(caveats[1].identifier), 'user = alice');
  t.equal(testUtils.bytesToBase64(macaroon.signature), 'S-lnzR6gxrJrr2pKlO6bBbFYhtoLqF6MQqk8jQ4SXvw');
  t.end();
});
