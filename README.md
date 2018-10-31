# JSON Ref Resolver

[![Maintainability](https://api.codeclimate.com/v1/badges/0b1d841cc2445e29ef50/maintainability)](https://codeclimate.com/github/stoplightio/json-ref-resolver/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/0b1d841cc2445e29ef50/test_coverage)](https://codeclimate.com/github/stoplightio/json-ref-resolver/test_coverage)

Recursively resolves JSON pointers and remote authorities.

- Explore the interfaces: [TSDoc](https://stoplightio.github.io/json-ref-resolver/)
- View the changelog: [Releases](https://github.com/stoplightio/json-ref-resolver/releases)

### Features

- Performant. Hot paths are memoized, remote authorities are resolved concurrently, and the minimum surface area is crawled and resolved.
- Caching. Results from remote authorities are cached.
- Immutable. The original object is not changed, and structural sharing is used to only change relevant bits.
- Reference equality. Pointers to the same location will resolve to the same object in memory.
- Flexible. Bring your own readers for http://, file://, mongo://, custom://... etc.
- Reliable. Well tested to handle all sorts of circular reference edge cases.

### Installation

Supported in modern browsers and node.

```bash
# latest stable
yarn add @stoplight/json-ref-resolver
```

### Usage

All relevant types and options can be found in [src/types.ts](src/types.ts).

```ts
import { Resolver } from '@stoplight/json-ref-resolver';

// some example http library
const request = require('request');

// if we're in node, we create a file reader with fs
const fs = require('fs');

// create our resolver instance
const resolver = new Resolver({
  // readers can do anything, so long as they define an async read function that resolves to a value
  readers: {
    // this reader will be invoked for refs with the https protocol
    https: {
      async read(ref: uri.URI) {
        return request(ref.toString());
      },
    },

    // this reader will be invoked for refs with the file protocol
    file: {
      async read(ref: uri.URI) {
        return fs.read(ref.toString());
      },
    },
  },
});

const resolved = await resolver.resolve({
  definitions: {
    someOASFile: {
      $ref: './main.oas2.yml#/definitions/user',
    },
    someMarkdownFile: {
      $ref: 'https://foo.com/intro.md',
    },
  },
});

console.log(resolved.result);

// ==> outputs the original object, with refs resolved and replaced
//
// {
//   definitions: {
//     someOASFile: {
//       // ... the data located in the relative file `./main.oas2.yml` and inner json path `#/definitions/user`
//     },
//     someMarkdownFile: {
//       // ... the data located at the url `https://foo.com/intro.md`
//     }
//   },
// }
```
