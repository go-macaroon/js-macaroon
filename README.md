# @unional/macaroon

This is a TypeScript fork of [macaroon](https://github.com/go-macaroon/js-macaroon).

## macaroon

A JavaScript implementation of
 [macaroons](http://theory.stanford.edu/~ataly/Papers/macaroons.pdf)
 compatible with the [Go](http://github.com/go-macaroon/macaroon),
 [Python, and C](https://github.com/rescrv/libmacaroons)
 implementations. Including functionality to interact with
 third party caveat dischargers implemented by the [Go macaroon bakery](http://github.com/go-macaroon-bakery/macaroon-bakery).
 It supports both version 1 and 2 macaroons in JSON and binary formats.

- [@unional/macaroon](#unionalmacaroon)
  - [macaroon](#macaroon)
  - [Usage](#usage)
  - [API](#api)

## Usage

```ts
import { newMacaroon } from '@unional/macaroon'

const macaroon = newMacaroon({ ... })
```

## API

Please check the [api documentation](API.md).
