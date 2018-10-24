# JSON Ref Resolver

Recursively resolves JSON pointers and remote authorities.

### Features

- Performant. Hot paths are memoized, only one crawl is needed, and remote authorities are resolved concurrently.
- Caching. Results from remote authorities are cached.
- Immutable. The original object is not changed, and structural sharing is used to only change relevant bits.
- Reference equality. Pointers to the same location will resolve to the same object in memory.
- Flexible. Bring your own readers for http://, file://, mongo://, custom://... etc.
- Reliable. Well tested to handle all sorts of circular reference edge cases.

### Usage

All relevant types and options can be found in [src/types.ts](src/types.ts).

```js
// some example http library
const request = require('request');

// fs in node.. in general this library works just fine in the browser though
const fs = require('fs');

// readers can do anything, so long as they have a read function that returns a promise that resolves to a value
const httpReader = {
  async read(ref) {
    return request(ref.toString());
  },
};

// this would obviously only be possible in node
const fileReader {
  async read(ref) {
    return fs.read(ref.toString(true));
  },
};

const source = {
  definitions: {
    someOASFile: {
      $ref: './main.oas2.yml#/definitions/user',
    },
    someMarkdownFile: {
      $ref: 'https://foo.com/intro.md',
    },
  },
};

// set our resolver, passing in our scheme -> reader mapping
const resolver = new Resolver({
  readers: {
    http: httpReader,
    https: httpReader,
    file: fileReader,
  },
});

const resolved = await resolver.resolve(source);

console.log(resolved.result);
// {
//   definitions: {
//     someOASFile: // .. whatever data is in the file located in the location definitions.foo in file './main.oas2.yml#/definitions/user'
//     someMarkdownFile: // .. whatever data is returned from https://foo.com/intro.md
//   },
// }
```
