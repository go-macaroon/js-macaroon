'use strict';

const test = require('tape');

const m = require('../macaroon');
const testUtils = require('./test-utils');

const recursiveThirdPartyCaveatMacaroons = [{
  rootKey: 'root-key',
  id: 'root-id',
  caveats: [{
    condition: 'wonderful',
  }, {
    condition: 'bob-is-great',
    location: 'bob',
    rootKey: 'bob-caveat-root-key',
  }, {
    condition: 'charlie-is-great',
    location: 'charlie',
    rootKey: 'charlie-caveat-root-key',
  }],
}, {
  location: 'bob',
  rootKey: 'bob-caveat-root-key',
  id: 'bob-is-great',
  caveats: [{
    condition: 'splendid',
  }, {
    condition: 'barbara-is-great',
    location: 'barbara',
    rootKey: 'barbara-caveat-root-key',
  }],
}, {
  location: 'charlie',
  rootKey: 'charlie-caveat-root-key',
  id: 'charlie-is-great',
  caveats: [{
    condition: 'splendid',
  }, {
    condition: 'celine-is-great',
    location: 'celine',
    rootKey: 'celine-caveat-root-key',
  }],
}, {
  location: 'barbara',
  rootKey: 'barbara-caveat-root-key',
  id: 'barbara-is-great',
  caveats: [{
    condition: 'spiffing',
  }, {
    condition: 'ben-is-great',
    location: 'ben',
    rootKey: 'ben-caveat-root-key',
  }],
}, {
  location: 'ben',
  rootKey: 'ben-caveat-root-key',
  id: 'ben-is-great',
}, {
  location: 'celine',
  rootKey: 'celine-caveat-root-key',
  id: 'celine-is-great',
  caveats: [{
    condition: 'high-fiving',
  }],
}];

const verifyTests = [{
  about: 'single third party caveat without discharge',
  macaroons: [{
    rootKey: 'root-key',
    id: 'root-id',
    caveats: [{
      condition: 'wonderful',
    }, {
      condition: 'bob-is-great',
      location: 'bob',
      rootKey: 'bob-caveat-root-key',
    }],
  }],
  conditions: [{
    conditions: {
      'wonderful': true,
    },
    expectErr: /cannot find discharge macaroon for caveat "bob-is-great"/,
  }],
}, {
  about: 'single third party caveat with discharge',
  macaroons: [{
    rootKey: 'root-key',
    id: 'root-id',
    caveats: [{
      condition: 'wonderful',
    }, {
      condition: 'bob-is-great',
      location: 'bob',
      rootKey: 'bob-caveat-root-key',
    }],
  }, {
    location: 'bob',
    rootKey: 'bob-caveat-root-key',
    id: 'bob-is-great',
  }],
  conditions: [{
    conditions: {
      'wonderful': true,
    },
  }, {
    conditions: {
      'wonderful': false,
    },
    expectErr: /condition "wonderful" not met/,
  }],
}, {
  about: 'single third party caveat with discharge with mismatching root key',
  macaroons: [{
    rootKey: 'root-key',
    id: 'root-id',
    caveats: [{
      condition: 'wonderful',
    }, {
      condition: 'bob-is-great',
      location: 'bob',
      rootKey: 'bob-caveat-root-key',
    }],
  }, {
    location: 'bob',
    rootKey: 'bob-caveat-root-key-wrong',
    id: 'bob-is-great',
  }],
  conditions: [{
    conditions: {
      'wonderful': true,
    },
    expectErr: /signature mismatch after caveat verification/,
  }],
}, {
  about: 'single third party caveat with two discharges',
  macaroons: [{
    rootKey: 'root-key',
    id: 'root-id',
    caveats: [{
      condition: 'wonderful',
    }, {
      condition: 'bob-is-great',
      location: 'bob',
      rootKey: 'bob-caveat-root-key',
    }],
  }, {
    location: 'bob',
    rootKey: 'bob-caveat-root-key',
    id: 'bob-is-great',
    caveats: [{
      condition: 'splendid',
    }],
  }, {
    location: 'bob',
    rootKey: 'bob-caveat-root-key',
    id: 'bob-is-great',
    caveats: [{
      condition: 'top of the world',
    }],
  }],
  conditions: [{
    conditions: {
      'wonderful': true,
    },
    expectErr: /condition "splendid" not met/,
  }, {
    conditions: {
      'wonderful': true,
      'splendid': true,
      'top of the world': true,
    },
    expectErr: /discharge macaroon "bob-is-great" was not used/,
  }, {
    conditions: {
      'wonderful': true,
      'splendid': false,
      'top of the world': true,
    },
    expectErr: /condition "splendid" not met/,
  }, {
    conditions: {
      'wonderful': true,
      'splendid': true,
      'top of the world': false,
    },
    expectErr: /discharge macaroon "bob-is-great" was not used/,
  }],
}, {
  about: 'one discharge used for two macaroons',
  macaroons: [{
    rootKey: 'root-key',
    id: 'root-id',
    caveats: [{
      condition: 'somewhere else',
      location: 'bob',
      rootKey: 'bob-caveat-root-key',
    }, {
      condition: 'bob-is-great',
      location: 'charlie',
      rootKey: 'bob-caveat-root-key',
    }],
  }, {
    location: 'bob',
    rootKey: 'bob-caveat-root-key',
    id: 'somewhere else',
    caveats: [{
      condition: 'bob-is-great',
      location: 'charlie',
      rootKey: 'bob-caveat-root-key',
    }],
  }, {
    location: 'bob',
    rootKey: 'bob-caveat-root-key',
    id: 'bob-is-great',
  }],
  conditions: [{
    expectErr: /discharge macaroon "bob-is-great" was used more than once/,
  }],
}, {
  about: 'recursive third party caveat',
  macaroons: [{
    rootKey: 'root-key',
    id: 'root-id',
    caveats: [{
      condition: 'bob-is-great',
      location: 'bob',
      rootKey: 'bob-caveat-root-key',
    }],
  }, {
    location: 'bob',
    rootKey: 'bob-caveat-root-key',
    id: 'bob-is-great',
    caveats: [{
      condition: 'bob-is-great',
      location: 'charlie',
      rootKey: 'bob-caveat-root-key',
    }],
  }],
  conditions: [{
    expectErr: /discharge macaroon "bob-is-great" was used more than once/,
  }],
}, {
  about: 'two third party caveats',
  macaroons: [{
    rootKey: 'root-key',
    id: 'root-id',
    caveats: [{
      condition: 'wonderful',
    }, {
      condition: 'bob-is-great',
      location: 'bob',
      rootKey: 'bob-caveat-root-key',
    }, {
      condition: 'charlie-is-great',
      location: 'charlie',
      rootKey: 'charlie-caveat-root-key',
    }],
  }, {
    location: 'bob',
    rootKey: 'bob-caveat-root-key',
    id: 'bob-is-great',
    caveats: [{
      condition: 'splendid',
    }],
  }, {
    location: 'charlie',
    rootKey: 'charlie-caveat-root-key',
    id: 'charlie-is-great',
    caveats: [{
      condition: 'top of the world',
    }],
  }],
  conditions: [{
    conditions: {
      'wonderful': true,
      'splendid': true,
      'top of the world': true,
    },
  }, {
    conditions: {
      'wonderful': true,
      'splendid': false,
      'top of the world': true,
    },
    expectErr: /condition "splendid" not met/,
  }, {
    conditions: {
      'wonderful': true,
      'splendid': true,
      'top of the world': false,
    },
    expectErr: /condition "top of the world" not met/,
  }],
}, {
  about: 'third party caveat with undischarged third party caveat',
  macaroons: [{
    rootKey: 'root-key',
    id: 'root-id',
    caveats: [{
      condition: 'wonderful',
    }, {
      condition: 'bob-is-great',
      location: 'bob',
      rootKey: 'bob-caveat-root-key',
    }],
  }, {
    location: 'bob',
    rootKey: 'bob-caveat-root-key',
    id: 'bob-is-great',
    caveats: [{
      condition: 'splendid',
    }, {
      condition: 'barbara-is-great',
      location: 'barbara',
      rootKey: 'barbara-caveat-root-key',
    }],
  }],
  conditions: [{
    conditions: {
      'wonderful': true,
      'splendid': true,
    },
    expectErr: /cannot find discharge macaroon for caveat "barbara-is-great"/,
  }],
}, {
  about: 'recursive third party caveats',
  macaroons: recursiveThirdPartyCaveatMacaroons,
  conditions: [{
    conditions: {
      'wonderful': true,
      'splendid': true,
      'high-fiving': true,
      'spiffing': true,
    },
  }, {
    conditions: {
      'wonderful': true,
      'splendid': true,
      'high-fiving': false,
      'spiffing': true,
    },
    expectErr: /condition "high-fiving" not met/,
  }],
}, {
  about: 'unused discharge',
  macaroons: [{
    rootKey: 'root-key',
    id: 'root-id',
  }, {
    rootKey: 'other-key',
    id: 'unused',
  }],
  conditions: [{
    expectErr: /discharge macaroon "unused" was not used/,
  }],
}];

test('verify', t => {
  let i;
  for (i in verifyTests) {
    const testData = verifyTests[i];
    t.test(`should work with ${testData.about}`, t => {
      let j;
      const keyMac = testUtils.makeMacaroons(testData.macaroons);
      const rootKey = keyMac[0];
      const primary = keyMac[1];
      const discharges = keyMac[2];
      for (j in testData.conditions) {
        const cond = testData.conditions[j];
        const check = cav => {
          if (cond.conditions[cav]) {
            return null;
          }
          return 'condition "' + cav + '" not met';
        };
        if (cond.expectErr) {
          t.throws(() => {
            primary.verify(rootKey, check, discharges);
          }, cond.expectErr, 'expected error ' + cond.expectErr);
        } else {
          primary.verify(rootKey, check, discharges);
        }
        // Cloned macaroon should have the same verify result.
        const clonedPrimary = primary.clone();
        if (cond.expectErr) {
          t.throws(() => {
            clonedPrimary.verify(rootKey, check, discharges);
          }, cond.expectErr, 'expected error ' + cond.expectErr);
        } else {
          clonedPrimary.verify(rootKey, check, discharges);
        }
      }
      t.end();
    });
  }
});


const externalRootKey = 'root-key';

// Produced by running this code: http://play.golang.org/p/Cn7q91tuql
const externalMacaroons = [
  {
    'caveats': [
      {
        'cid': 'wonderful'
      },
      {
        'cid': 'bob-is-great',
        'vid': 'YnpoATFtXlPux-ASP0iXsud5KqOAPy2zLxSjnGt0OY0L1XooSQagZeupd001spBjNh2IqG6i99OB9O2ERyNKMxpY5oMInKaC',
        'cl': 'bob'
      },
      {
        'cid': 'charlie-is-great',
        'vid': 'pvwga-URCMCaYElz3pdB984Hy9efe7xyVeY0vdlil1-nVVsS4KVvOrG1eQvZdpN1oEEDydSuiLzHE3dJMpqZ-qXZ9RV4NJ7C',
        'cl': 'charlie'
      }
    ],
    'location': '',
    'identifier': 'root-id',
    'signature': '79240bb490c6940658106811ad7033de5047ea0ef295d2d882da53b2e43bf3a1'
  },
  {
    'caveats': [
      {
        'cid': 'splendid'
      }
    ],
    'location': 'bob',
    'identifier': 'bob-is-great',
    'signature': '0389d56449d5e66289f7bfc8771757204051e9eb3ee99e522cf23484bdaf1629'
  },
  {
    'caveats': [
      {
        'cid': 'top of the world'
      }
    ],
    'location': 'charlie',
    'identifier': 'charlie-is-great',
    'signature': 'c48affa09c0fd0560e2a3176b639c09b4bdf957a379660f86f7bb35e14c8865e'
  }
];

test('should verify external third party macaroons correctly', t => {
  const ms = m.importMacaroons(externalMacaroons);
  ms[0].verify(externalRootKey, () => {}, ms.slice(1));
  t.end();
});

test('should handle incorrect root key correctly', t => {
    const ms = m.importMacaroons(externalMacaroons);
    t.throws(() => {
        ms[0].verify('wrong-key', () => {}, ms.slice(1));
    }, /decryption failed/, 'Should fail with decryption error');
    t.end();
});

