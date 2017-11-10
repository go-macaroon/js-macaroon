'use strict'

const crypto = require('crypto')
const Macaroon = require('..')

// The server creates a macaroon to give to their user
const rootKey = crypto.randomBytes(32)
const original = Macaroon.newMacaroon({
  rootKey,
  identifier: 'user12345',
  location: 'https://some-website.example'
})
const givenToUser = original.exportBinary()

console.log('original macaroon binary:', Buffer.from(original.exportBinary()).toString('base64'))
console.log('original macaroon json:', original.exportJSON())

// The user can add additional caveats that will be enforced by the server
// (The server can support whatever type of specific caveats you want)
const userMacaroon = Macaroon.importMacaroon(givenToUser)
userMacaroon.addFirstPartyCaveat('time < ' + new Date(Date.now() + 1000).toISOString())
const givenToThirdParty = userMacaroon.exportBinary()

console.log('caveated macaroon binary:', Buffer.from(original.exportBinary()).toString('base64'))
console.log('caveated macaroon json:', original.exportJSON())

// The user can give out the more limited caveat to some 3rd party service
// and the server will enforce the specified conditions when the 3rd party goes to authenticate

// This is an example of how the server might verify the macaroon's caveats
function verifier (caveat) {
  if (caveat.startsWith('time <')) {
    const expiry = Date.parse(caveat.replace('time < ', ''))
    if (expiry <= Date.now()) {
      throw new Error('macaroon is expired')
    }
  } else {
    // It's generally a good idea to reject macaroons with caveats you don't understand
    throw new Error('unsupported caveat: ' + caveat)
  }
}

console.log('verifying macaroon')
const fromThirdParty = Macaroon.importMacaroon(givenToThirdParty)
fromThirdParty.verify(rootKey, verifier)
console.log('yay! the macaroon was valid')

// In this example, the macaroon will expire after 1 second
setTimeout(function () {
  try {
    fromThirdParty.verify(rootKey, verifier)
  } catch (err) {
    console.log('...but if we wait for too long the server won\'t accept it anymore')
  }
}, 1001)


