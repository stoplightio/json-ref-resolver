import * as fs from 'fs';
import * as _ from 'lodash';
import * as URI from 'urijs';

import { Cache } from '../cache';
import { Resolver } from '../resolver';
import { defaultGetRef, ResolveRunner } from '../runner';
import * as Types from '../types';
import httpMocks from './fixtures/http-mocks';
import resolvedResults from './fixtures/resolved';

export class FileReader implements Types.IResolver {
  public async resolve(uri: uri.URI) {
    const path = uri.path();
    return new Promise((resolve, reject) => {
      try {
        const raw = fs.readFileSync(path);
        resolve(JSON.parse(raw.toString()));
      } catch (err) {
        reject(err);
      }
    });
  }
}

export class HttpReader implements Types.IResolver {
  public async resolve(uri: uri.URI) {
    const mock = httpMocks[uri.toString()];

    if (mock) return mock;

    throw new Error('404 mock url not found');
  }
}

const runFixtures = (factory: any) => {
  const dir = `${__dirname}/fixtures/schemas`;
  // all
  const files = fs.readdirSync(dir);

  // working on now
  // const files: string[] = ['deep-all-of.json'];

  // the following case (amongst others) does not work in stress test without protective json parse/stringify in resolve
  // basicfileref.1.json

  for (const file of files) {
    if (!file.startsWith('.') && file.includes('.')) {
      const filePath = `${dir}/${file}`;
      const testCase = require(filePath);
      if (testCase.input) {
        factory(testCase, file, filePath);
      }
    }
  }
};

const runFixture = (resolver: any, testCase: any, _file: any, filePath: any) => {
  return async () => {
    const resolved = await resolver.resolve(testCase.input, {
      baseUri: filePath,
    });

    expect(resolved.result).toEqual(testCase.expected);

    // check for circular js refs
    let err;
    try {
      JSON.stringify(resolved.result);
    } catch (e) {
      err = e;
    }
    expect(err).toBeUndefined();
  };
};

describe('resolver', () => {
  describe('fixtures', () => {
    runFixtures((testCase: any, file: any, filePath: any) => {
      const resolver = new Resolver({
        resolvers: {
          file: new FileReader(),
          http: new HttpReader(),
          https: new HttpReader(),
        },
      });

      test(file, runFixture(resolver, testCase, file, filePath));
    });

    // run the fixtures 5 times "concurrently" on the same resolver instance to check for race type cases
    test('stress test', async () => {
      const resolver = new Resolver({
        resolvers: {
          file: new FileReader(),
          http: new HttpReader(),
          https: new HttpReader(),
        },
      });

      const resolvers: any = [];

      for (let i = 0; i < 5; i++) {
        runFixtures((testCase: any, file: any, filePath: any) => {
          resolvers.push(runFixture(resolver, testCase, file, filePath)());
        });
      }

      const now = new Date().getTime();
      await Promise.all(resolvers);

      // simple performance sanity check
      expect(new Date().getTime() - now).toBeLessThan(500);
    });
  });

  describe('resolve', () => {
    test('windows file paths', async () => {
      const source = {
        schema: {
          $ref: '../b.json#/inner',
        },
      };

      const remotes = {
        'c:/b.json': {
          inner: {
            b_name: 'b',
            b_inner: {
              $ref: './models/c.json',
            },
          },
        },
        'c:/models/c.json': {
          c_name: 'c',
          network: {
            $ref: 'D:\\network.json#/inner',
          },
        },
        'd:/network.json': {
          inner: {
            d_name: 'd',
          },
        },
      };

      const resolver = new Resolver();

      const uris: string[] = [];
      const reader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          const uri = ref.toString();
          uris.push(uri);
          return remotes[uri];
        },
      };

      const result = await resolver.resolve(source, {
        baseUri: 'c:\\My Documents\\spec.json',
        resolvers: {
          file: reader,
        },
      });

      expect(uris[0]).toEqual('c:/b.json');
      expect(uris[1]).toEqual('c:/models/c.json');
      expect(uris[2]).toEqual('d:/network.json');

      expect(result.result).toEqual({
        schema: {
          b_name: 'b',
          b_inner: {
            c_name: 'c',
            network: {
              d_name: 'd',
            },
          },
        },
      });
    });

    test('should respect immutability rules', async () => {
      const source = {
        hello: {
          $ref: '#/word',
        },
        hello2: {
          $ref: '#/word',
        },
        word: {
          foo: 'bar',
        },
        inner: {
          obj: true,
        },
      };

      const sourceCopy = _.cloneDeep(source);

      const resolver = new Resolver();
      const resolved = await resolver.resolve(source);

      // Immutable: Source should not be mutated.
      expect(source).toEqual(sourceCopy);

      // Structural Sharing: Unresolved props should point to their original source location in memory.
      expect(resolved.result.inner).toBe(source.inner);

      // Reference Equality: Pointers to the same location will resolve to the same object in memory.
      expect(resolved.result.hello).toBe(resolved.result.hello2);
      expect(resolved.result.hello).toBe(source.word);
    });

    test('should support jsonPointers', async () => {
      const source = {
        hello: {
          $ref: '#/word',
        },
        word: 'world',
      };

      const resolver = new Resolver();
      const resolved = await resolver.resolve(source);
      expect(resolved.result.hello).toBe('world');
    });

    test('should resolve json pointers pointing to falsy values', async () => {
      const source = {
        hello: {
          $ref: '#/word',
        },
        word: '',
      };

      const resolver = new Resolver();
      const resolved = await resolver.resolve(source);
      expect(resolved.result.hello).toBe('');
    });

    test('should only resolve valid $refs', async () => {
      const source = {
        hello: {
          $ref: {
            foo: 'bear',
          },
        },
        word: 'world',
      };

      const resolver = new Resolver();
      let resolved = await resolver.resolve(source);
      expect(resolved.result).toEqual(source);

      // @ts-ignore
      source.hello.$ref = true;
      resolved = await resolver.resolve(source);
      expect(resolved.result).toEqual(source);

      // @ts-ignore
      source.hello.$ref = 1;
      resolved = await resolver.resolve(source);
      expect(resolved.result).toEqual(source);
    });

    test('should support not resolving pointers', async () => {
      const source = {
        hello: {
          $ref: '#/word',
        },
        word: 'world',
      };

      const resolver = new Resolver({ dereferenceInline: false });
      const resolved = await resolver.resolve(source);
      expect(resolved.result).toEqual(source);
    });

    test('resolvePointers option should force to true for remote authorities', async () => {
      const data = {
        oas: {
          swagger: '2.0',
          definitions: {
            user: {
              address: {
                $ref: '#/definitions/address',
              },
            },
            address: {
              title: 'Address',
            },
          },
        },
      };

      const fileReader: Types.IResolver = {
        async resolve(): Promise<any> {
          return data.oas;
        },
      };

      const source = {
        definitions: {
          foo: {
            $ref: '#/definitions/bar',
          },
          bar: {
            title: 'bar',
          },
          someOASFile: {
            $ref: './main.oas2.yml#/definitions/user',
          },
        },
      };

      const resolver = new Resolver({
        resolvers: {
          file: fileReader,
        },
      });

      const result = await resolver.resolve(source, {
        dereferenceInline: false,
      });

      expect(result.result).toEqual({
        definitions: {
          foo: {
            $ref: '#/definitions/bar',
          },
          bar: {
            title: 'bar',
          },
          someOASFile: {
            address: {
              title: 'Address',
            },
          },
        },
      });
    });

    test('should support chained jsonPointers + partial resolution', async () => {
      const source = {
        hello: {
          foo: {
            $ref: '#/word/wordInner',
          },
          foo2: {
            $ref: '#/word4',
          },
        },
        word: {
          wordInner: {
            $ref: '#/word2',
          },
        },
        word2: 'world',
        word4: {
          $ref: '#/word',
        },
      };

      const resolver = new Resolver();
      const resolved = await resolver.resolve(source, {
        jsonPointer: '#/hello',
      });
      expect(resolved.result).toEqual({
        foo: 'world',
        foo2: {
          wordInner: 'world',
        },
      });
      // expect(resolved.runner.pointerCache.stats.misses).toEqual(2);
    });

    test('uri resolution should support naked relative file $refs (foo.json instead of ./foo.json)', async () => {
      const data = {
        schema: {
          $ref: 'a.json',
        },
      };

      let uri: string | undefined;
      const fileReader: Types.IResolver = {
        async resolve(ref): Promise<any> {
          uri = ref.toString();
        },
      };

      const resolver = new Resolver({
        resolvers: {
          file: fileReader,
        },
      });

      await resolver.resolve(data);

      expect(uri).toEqual('a.json');
    });

    test('uri resolution should support naked relative file $refs (foo.json instead of ./foo.json)', async () => {
      const data = {
        schema: {
          $ref: 'a.json',
        },
      };

      let uri: string | undefined;
      const fileReader: Types.IResolver = {
        async resolve(ref): Promise<any> {
          uri = ref.toString();
        },
      };

      const resolver = new Resolver({
        resolvers: {
          file: fileReader,
        },
      });

      await resolver.resolve(data, {
        baseUri: '/specs/spec.json',
      });

      expect(uri).toEqual('/specs/a.json');
    });

    test('should support authorities', async () => {
      const data = {
        hello: 'world',
      };

      const source = {
        root: {
          $ref: 'custom://whatever',
        },
      };

      const reader: Types.IResolver = {
        async resolve(): Promise<any> {
          return data;
        },
      };

      const resolver = new Resolver({
        resolvers: {
          custom: reader,
        },
      });

      const resolved = await resolver.resolve(source);

      expect(resolved.result).toEqual({
        root: {
          hello: 'world',
        },
      });
      expect(resolver.uriCache.stats.misses).toEqual(1);
    });

    // simulates ref to deep OpenAPI path
    test('should support json pointer special characters', async () => {
      const data = {
        spec: {
          paths: {
            '/users': {
              get: {
                hi: true,
              },
            },
          },
        },
      };

      const source = {
        root: {
          paths: {
            '/root': {
              $ref: 'http://foo.com/foo/bar.yml#/paths/~1users/get',
            },
          },
        },
      };

      const reader: Types.IResolver = {
        async resolve(): Promise<any> {
          return data.spec;
        },
      };

      const resolver = new Resolver({
        resolvers: {
          http: reader,
        },
      });

      const resolved = await resolver.resolve(source, {
        jsonPointer: '#/root/paths/~1root',
      });

      expect(resolved.result).toEqual({
        hi: true,
      });
    });

    test('should handle empty pointers', async () => {
      const source = {
        root: {
          inner: {
            foo: true,
          },
        },
      };

      const resolver = new Resolver();

      let resolved = await resolver.resolve(source, {
        jsonPointer: '#',
      });

      expect(resolved.result).toEqual(source);

      resolved = await resolver.resolve(source, {
        jsonPointer: '#/',
      });

      expect(resolved.result).toEqual(source);

      resolved = await resolver.resolve(source, {
        jsonPointer: '#/ ',
      });

      expect(resolved.result).toEqual(source);

      resolved = await resolver.resolve(source, {
        jsonPointer: ' #/',
      });

      expect(resolved.result).toEqual(source);
    });

    test('should resolve jsonPointer pointing to remote falsy values', async () => {
      const source = {
        root: {
          $ref: 'custom://whatever#/entry',
        },
      };

      const reader: Types.IResolver = {
        async resolve(): Promise<any> {
          return {
            entry: 0,
          };
        },
      };

      const resolver = new Resolver({
        resolvers: {
          custom: reader,
        },
      });

      const resolved = await resolver.resolve(source);

      expect(resolved.result).toEqual({
        root: 0,
      });
    });

    test('should support not resolving authorities', async () => {
      const data = {
        hello: 'world',
      };

      const source = {
        root: {
          $ref: 'custom://whatever',
        },
      };

      const reader: Types.IResolver = {
        async resolve(): Promise<any> {
          return data;
        },
      };

      const resolver = new Resolver({
        dereferenceRemote: false,
        resolvers: {
          custom: reader,
        },
      });

      const resolved = await resolver.resolve(source);

      expect(resolved.result).toEqual(source);
      expect(resolver.uriCache.stats.misses).toEqual(0);
    });

    test('should support uri + jsonPointer', async () => {
      const data = {
        entry: {
          $ref: '#/super',
        },
        super: {
          hello: {
            $ref: '#/man',
          },
        },
        man: 'world',
      };

      const source = {
        root: {
          $ref: 'custom://whatever#/entry',
        },
      };

      const reader: Types.IResolver = {
        async resolve(): Promise<any> {
          return data;
        },
      };

      const resolver = new Resolver({
        resolvers: {
          custom: reader,
        },
      });

      const resolved = await resolver.resolve(source);

      expect(resolver.uriCache.stats.misses).toEqual(1);
      expect(resolved.result).toEqual({
        root: {
          hello: 'world',
        },
      });
    });

    test('should support deep pointer chain', async () => {
      const data = {
        file1: {
          definitions: {
            user: {
              name: 'marc',
              age: 30,
            },
          },
        },
      };

      const source = {
        model1: {
          properties: {
            user1: {
              $ref: '#/model2',
            },
          },
        },
        model2: {
          properties: {
            user2: {
              $ref: '#/model3',
            },
          },
        },
        model3: {
          properties: {
            user3: {
              $ref: 'custom://file1#/definitions/user',
            },
          },
        },
        model4: {
          properties: {
            user4: {
              $ref: '#/model2',
            },
          },
        },
      };

      const reader: Types.IResolver = {
        async resolve(uri: uri.URI): Promise<any> {
          return data[uri.authority()];
        },
      };

      const resolver = new Resolver({
        resolvers: {
          custom: reader,
        },
      });

      const resolved = await resolver.resolve(source);

      expect(resolved.result).toEqual({
        model1: {
          properties: {
            user1: {
              properties: {
                user2: {
                  properties: {
                    user3: data.file1.definitions.user,
                  },
                },
              },
            },
          },
        },
        model2: {
          properties: {
            user2: {
              properties: {
                user3: data.file1.definitions.user,
              },
            },
          },
        },
        model3: {
          properties: {
            user3: data.file1.definitions.user,
          },
        },
        model4: {
          properties: {
            user4: {
              properties: {
                user2: {
                  properties: {
                    user3: data.file1.definitions.user,
                  },
                },
              },
            },
          },
        },
      });
    });

    test('should support deep uri + pointer chain', async () => {
      const data = {
        file1: {
          hello: {
            $ref: 'custom://file2#/hello',
          },
        },
        file2: {
          hello: {
            $ref: 'custom://file3#/man',
          },
        },
        file3: {
          man: 'world',
        },
      };

      const source = {
        hello: {
          $ref: 'custom://file1#/hello',
        },
      };

      const reader: Types.IResolver = {
        async resolve(uri: uri.URI): Promise<any> {
          return data[uri.authority()];
        },
      };

      const resolver = new Resolver({
        resolvers: {
          custom: reader,
        },
      });

      const resolved = await resolver.resolve(source);

      expect(resolved.result).toEqual({
        hello: 'world',
      });
      expect(resolver.uriCache.stats.misses).toEqual(3);
    });

    test('should support partial resolution if jsonPointer option supplied', async () => {
      const source = {
        inner: {
          $ref: '#/inner2',
        },
        inner2: {
          marcsStreet: {
            $ref: '#/definitions/user/address',
          },
        },
        inner3: {
          $ref: '#/definitions/address',
        },
        definitions: {
          user: {
            name: 'marc',
            phone: {
              $ref: '#/definitions/phone',
            },
            address: {
              userStreet: {
                $ref: '#/definitions/address/street',
              },
            },
          },
          phone: '5555555',
          address: {
            street: 'riverside',
            zip: {
              $ref: '#/definitions/zip',
            },
          },
          zip: '12345',
        },
      };

      const runner = new ResolveRunner(source);
      const resolved = await runner.resolve({ jsonPointer: '#/inner2/marcsStreet' });

      // only marcStreet and related paths replaced
      const newObj = {
        inner: source.inner,
        inner2: {
          marcsStreet: {
            userStreet: 'riverside',
          },
        },
        inner3: source.inner3,
        definitions: {
          user: {
            ...source.definitions.user,
            address: {
              userStreet: 'riverside',
            },
          },
          phone: source.definitions.phone,
          address: source.definitions.address,
          zip: source.definitions.zip,
        },
      };

      expect(runner.source).toEqual(newObj);

      // now we use the same runner to resolve another portion of it
      // only the new portions are resolved (in addition to what has already been done)
      await resolved.runner.resolve({ jsonPointer: '#/inner3' });

      expect(runner.source).toEqual({
        ...newObj,
        inner3: {
          street: 'riverside',
          zip: '12345',
        },
        definitions: {
          ...newObj.definitions,
          address: {
            street: 'riverside',
            zip: '12345',
          },
        },
      });
    });
  });

  describe('refMap', () => {
    test('should be generated and returned', async () => {
      const source = {
        hello: {
          $ref: '#/word',
        },
        word: 'world',
      };

      const resolver = new Resolver();
      const resolved = await resolver.resolve(source);
      expect(resolved.refMap).toEqual({
        '#/hello': '#/word',
      });
    });

    test('should point to its original target', async () => {
      const source = {
        hello: {
          $ref: '#/word1',
        },
        word1: {
          $ref: '#/word2',
        },
        word2: 'world',
      };

      const resolver = new Resolver();
      const resolved = await resolver.resolve(source);
      expect(resolved.refMap).toEqual({
        // word1, not word2 (which is what it ultimately resolves to)
        '#/hello': '#/word1',
        '#/word1': '#/word2',
      });
    });

    test('should handle remote authorities', async () => {
      const data = {
        obj1: {
          inner: {
            foo: {
              $ref: 'custom://obj2#/two',
            },
          },
        },
        obj2: {
          two: true,
        },
      };

      const source = {
        inner: {
          data: {
            $ref: 'custom://obj1',
          },
          dataInner: {
            $ref: 'custom://obj1#/inner/foo',
          },
          dataInner2: {
            $ref: '#/data2',
          },
        },
        data2: {
          $ref: 'custom://ob2#/two',
        },
      };

      const reader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          return data[ref.authority()];
        },
      };

      const resolver = new Resolver({
        resolvers: {
          custom: reader,
        },
      });

      const resolved = await resolver.resolve(source);

      expect(resolved.refMap).toEqual({
        '#/inner/data': 'custom://obj1/',
        '#/inner/dataInner': 'custom://obj1/#/inner/foo',
        '#/inner/dataInner2': '#/data2',
        '#/data2': 'custom://ob2/#/two',
      });
    });
  });

  describe('circular handling', () => {
    test('should handle indirect circular pointer refs', async () => {
      const source = {
        ref1: {
          $ref: '#/ref3',
        },
        ref2: {
          $ref: '#/ref1',
        },
        ref3: {
          $ref: '#/ref2',
        },
      };

      const resolver = new Resolver();
      const resolved = await resolver.resolve(source);

      expect(resolved.result).toEqual({
        ref1: {
          $ref: '#/ref3',
        },
        ref2: {
          $ref: '#/ref1',
        },
        ref3: {
          $ref: '#/ref2',
        },
      });

      // should resolve to same object in memory
      expect(resolved.result.ref2 === source.ref2).toBe(true);
    });

    test('should not have circular pointers in JS memory', async () => {
      const resolver = new Resolver();

      // this particular structure is tricky and leads to circular refs in memory
      // unless we decycle or otherwise track circular refs in a smart way
      const circularObj = {
        definitions: {
          Customer: {
            properties: {
              partners: {
                items: {
                  $ref: '#/definitions/Partner',
                },
              },
            },
          },
          Partner: {
            properties: {
              customers: {
                items: {
                  $ref: '#/definitions/Customer',
                },
              },
            },
          },
        },
      };

      const resolved = await resolver.resolve(circularObj);

      let err;
      try {
        // this will throw if there are circular js references
        JSON.stringify(resolved.result);
      } catch (e) {
        err = e;
      }

      expect(err).toBeUndefined();
      expect(resolved.result).toEqual(circularObj);
    });

    test('should handle indirect circular uri refs', async () => {
      const data = {
        obj1: {
          one: true,
          foo: {
            $ref: 'custom://obj2',
          },
        },
        obj2: {
          two: true,
          foo: {
            $ref: 'custom://obj3',
          },
        },
        obj3: {
          three: true,
          foo: {
            $ref: 'custom://obj1',
          },
        },
      };

      const source = {
        inner: {
          data: {
            $ref: 'custom://obj1',
          },
        },
      };

      const reader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          return data[ref.authority()];
        },
      };

      const resolver = new Resolver({
        resolvers: {
          custom: reader,
        },
      });

      const resolved = await resolver.resolve(source);

      expect(resolved.result).toEqual({
        inner: {
          data: {
            one: true,
            foo: {
              two: true,
              foo: {
                three: true,
                foo: {
                  $ref: 'custom://obj1',
                },
              },
            },
          },
        },
      });

      // should only have read 3 times
      expect(resolver.uriCache.stats.misses).toEqual(3);
    });
  });

  describe('cache', () => {
    test('should resolve equal refs to the same object in memory', async () => {
      const source = {
        val: {
          hello: 'world',
        },
        ref1: {
          $ref: 'custom://val',
        },
        ref2: {
          $ref: 'custom://val',
        },
      };

      const reader: Types.IResolver = {
        async resolve(): Promise<any> {
          return source.val;
        },
      };

      const resolver = new Resolver({
        resolvers: {
          custom: reader,
        },
      });

      const resolved = await resolver.resolve(source);

      // should resolve to this object
      expect(resolved.result).toEqual({
        val: {
          hello: 'world',
        },
        ref1: {
          hello: 'world',
        },
        ref2: {
          hello: 'world',
        },
      });
    });

    test('should support _stdTTL', async () => {
      const data = {
        hello: 'world',
      };

      const source = {
        root: {
          $ref: 'custom://whatever',
        },
      };

      const reader: Types.IResolver = {
        async resolve(): Promise<any> {
          return data;
        },
      };

      const resolver = new Resolver({
        resolvers: {
          custom: reader,
        },
        uriCache: new Cache({
          stdTTL: 1000, // 1s cache
        }),
      });

      let resolved = await resolver.resolve(source);

      await new Promise(resolve => setTimeout(resolve, 500));

      resolved = await resolver.resolve(source);

      // second lookup should be cached since under stdTTL, so only 1 miss
      expect(resolver.uriCache.stats.misses).toEqual(1);

      await new Promise(resolve => setTimeout(resolve, 600));

      resolved = await resolver.resolve(source);

      // we waited over our cache time, so should have another miss
      expect(resolver.uriCache.stats.misses).toEqual(2);

      expect(resolved.result).toEqual({
        root: {
          hello: 'world',
        },
      });
    });
  });

  describe('error handling', () => {
    test('should track missing pointers', async () => {
      const source = {
        foo: 'bar',
        inner: {
          $ref: '#/missing',
        },
      };

      const resolver = new Resolver();
      const result = await resolver.resolve(source);

      expect({ ...result.errors[0], uri: undefined }).toEqual({
        code: 'POINTER_MISSING',
        message: "'#/missing' does not exist",
        path: ['inner'],
        uriStack: [],
        pointerStack: [],
        uri: undefined,
      });
      expect(result.errors.length).toEqual(1);
    });

    test('should throw error if no resolver defined for ref scheme', async () => {
      const source = {
        inner: {
          $ref: 'a.json',
        },
      };

      const resolver = new Resolver();
      const result = await resolver.resolve(source);

      expect({ ...result.errors[0], uri: undefined }).toEqual({
        code: 'RESOLVE_URI',
        message: "Error: No resolver defined for scheme 'file' in ref a.json",
        path: ['inner'],
        uriStack: [],
        pointerStack: [],
        uri: undefined,
      });
      expect(result.errors.length).toEqual(1);
    });

    test('should track uri errors', async () => {
      const data = {
        bar: {
          hello: 'world',
        },
      };

      const source = {
        definitions: {
          foo: {
            $ref: 'custom://missing',
          },
          bar: {
            $ref: 'custom://bar',
          },
        },
      };

      const reader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          if (data[ref.authority()]) {
            return data[ref.authority()];
          }

          throw new Error('not found!');
        },
      };

      const resolver = new Resolver({
        resolvers: {
          custom: reader,
        },
      });

      const result = await resolver.resolve(source);

      expect(result.result).toEqual({
        definitions: {
          foo: {
            $ref: 'custom://missing',
          },
          bar: {
            hello: 'world',
          },
        },
      });
      expect({ ...result.errors[0], uri: undefined }).toEqual({
        code: 'RESOLVE_URI',
        message: 'Error: not found!',
        uriStack: [],
        pointerStack: [],
        path: ['definitions', 'foo'],
        uri: undefined,
      });
      expect(result.errors[0].uri.toString()).toBe('custom://missing/');
      expect(result.errors.length).toEqual(1);
    });

    test('should track uri + pointer errors', async () => {
      const data = {
        bar: {
          hello: 'world',
          inner: {
            $ref: '#/missing',
          },
        },
      };

      const source = {
        definitions: {
          foo: {
            $ref: 'custom://bar#/hello',
          },
          bar: {
            $ref: 'custom://bar#/inner',
          },
        },
      };

      const reader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          if (data[ref.authority()]) {
            return data[ref.authority()];
          }

          throw new Error('not found!');
        },
      };

      const resolver = new Resolver({
        resolvers: {
          custom: reader,
        },
      });

      const result = await resolver.resolve(source);

      expect(result.result).toEqual({
        definitions: {
          foo: 'world',
          bar: {
            $ref: 'custom://bar#/inner',
          },
        },
      });
      expect(result.errors[0]).toMatchObject({
        code: 'POINTER_MISSING',
        message: "'#/missing' does not exist",
        path: ['inner'],
        uriStack: [],
        pointerStack: [],
      });
      expect(result.errors[0].uri.toString()).toEqual('custom://bar/');
      expect(result.errors.length).toEqual(1);
    });

    test('should replace what it can even if some inner remote refs fail', async () => {
      const source = {
        inner: {
          $ref: 'https://exporter.stoplight.io/with-dead-refs#/data',
        },
      };

      const resolver = new Resolver({
        resolvers: {
          https: new HttpReader(),
        },
      });

      const result = await resolver.resolve(source);

      expect(result.result).toEqual({
        inner: {
          car: true,
          deadInner: {
            $ref: 'https://exporter.stoplight.io/i-do-not-exist-inner',
          },
        },
      });
    });

    test('should replace what it can when some inner refs fail', async () => {
      const source = {
        schema: {
          $ref: './b#/definitions/Full Order',
        },
      };

      const resolver = new Resolver({
        resolvers: {
          https: new HttpReader(),
        },
      });

      const reader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          if (ref.path() === '/b') {
            return {
              definitions: {
                'Full Order': {
                  data: {
                    $ref: './a#/defs/does-not-exist',
                  },
                  'another-data': {
                    $ref: './path-404#/foo/bar',
                  },
                },
              },
            };
          }
        },
      };

      const result = await resolver.resolve(source, {
        baseUri: 'https://foo.com/a',
        resolvers: {
          https: reader,
        },
      });

      expect(result.result).toEqual({
        schema: {
          data: {
            $ref: './a#/defs/does-not-exist',
          },
          'another-data': {
            $ref: './path-404#/foo/bar',
          },
        },
      });
    });

    test('should replace what it can when originating ref includes a fragment', async () => {
      const source = {
        inner: {
          $ref: 'https://exporter.stoplight.io/with-dead-refs#/deadLocal',
        },
      };

      const resolver = new Resolver({
        resolvers: {
          https: new HttpReader(),
        },
      });

      const result = await resolver.resolve(source);

      expect(result.result).toEqual({
        inner: {
          car: true,
          deadInner: {
            $ref: '#/i-do-not-exist',
          },
        },
      });
    });
  });

  describe('hooks', () => {
    // allows the consumer to decide exactly which parts of the object should be resolved,
    // and transform URIs before resolving
    test('should support `transformRef` hook', async () => {
      let transformRefCalled = false;

      const source = {
        inner: {
          $ref: '#/foo',
        },
        foo: 'hello1',
        bar: 'hello2',
      };

      const resolver = new Resolver();
      const resolved = await resolver.resolve(source, {
        transformRef(opts) {
          transformRefCalled = true;
          return opts.ref && opts.ref.fragment('/bar');
        },
      });

      expect(transformRefCalled).toBeTruthy();

      // we redirected the ref to /bar instead of /foo
      expect(resolved.result.inner).toEqual('hello2');
    });

    /**
     * This allows the end user to completely customize which properties are resolved.
     */
    test('should support `getRef` hook', async () => {
      const source = {
        inner: {
          randomProp: '#/foo',
        },
        foo: 'hello1',
      };

      const resolver = new Resolver({
        getRef(_key, val) {
          if (typeof val === 'string' && val.startsWith('#/')) return val;
          return;
        },
      });

      const resolved = await resolver.resolve(source);
      expect(resolved.result.inner).toEqual({
        randomProp: 'hello1',
      });
    });

    /**
     * This version preserves the original $ref handling, combined with our custom getRef logic.
     */
    test('should support `getRef` hook combined with defaultGetRef', async () => {
      const source = {
        inner: {
          randomProp: '#/foo',
        },
        inner2: {
          $ref: '#/bar',
        },
        foo: 'hello1',
        bar: 'hello2',
      };

      const resolver = new Resolver({
        getRef(key, val) {
          if (typeof val === 'string' && val.startsWith('#/')) return val;
          return defaultGetRef(key, val);
        },
      });

      const resolved = await resolver.resolve(source);
      expect(resolved.result).toEqual({
        inner: {
          randomProp: 'hello1',
        },
        inner2: 'hello2',
        foo: 'hello1',
        bar: 'hello2',
      });
    });

    /**
     * Allows the consumer to provide a custom parser to parse lookup results before they get
     * cached and returned.
     *
     * Examples:
     * yaml -> json
     * oas json -> hub json
     */
    test('should support `parseAuthorityResult` hook', async () => {
      const data = {
        markdown: '# hello',
        bar: `{
          "hello": "world"
        }`,
      };

      const source = {
        definitions: {
          foo: {
            $ref: 'http://foo.com/foo.md',
          },
          bar: {
            // IMPORTANT: including a pointer to test that the target is parsed before looking up #/hello
            $ref: 'http://foo.com/bar.json#/hello',
          },
        },
      };

      const reader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          if (ref.path().split('.')[1] === 'md') {
            return data.markdown;
          }

          return data.bar;
        },
      };

      const resolver = new Resolver({
        resolvers: {
          http: reader,
        },
        parseResolveResult: async opts => {
          if (opts.targetAuthority.path().split('.')[1] === 'md') {
            opts.result = {
              heading1: 'hello',
            };
          } else {
            opts.result = JSON.parse(opts.result);
          }

          return opts;
        },
      });

      const result = await resolver.resolve(source);

      expect(result.result).toEqual({
        definitions: {
          foo: {
            heading1: 'hello',
          },
          bar: 'world',
        },
      });
    });

    test('should pass `parseAuthorityResult` to child runners', async () => {
      const data = {
        foo: {
          $ref: 'http://foo.com/hi',
        },
        hi: {
          $ref: 'http://foo.com/bye',
        },
        bye: {
          adios: true,
        },
        bar: {
          hello: 'world',
        },
      };

      const source = {
        definitions: {
          foo: {
            $ref: 'http://foo.com/foo',
          },
          bar: {
            $ref: 'http://foo.com/bar',
          },
        },
      };

      const reader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          return data[ref.path().slice(1)];
        },
      };

      let counter = 0;
      const resolver = new Resolver({
        resolvers: {
          http: reader,
        },
        parseResolveResult: async opts => {
          counter += 1;
          return opts;
        },
      });

      const result = await resolver.resolve(source);

      expect(result.result).toEqual({
        definitions: {
          foo: {
            adios: true,
          },
          bar: {
            hello: 'world',
          },
        },
      });
      expect(counter).toEqual(4);
    });

    test('should support catching error in `parseAuthorityResult` hook', async () => {
      const data = {
        markdown: '# hello',
      };

      const source = {
        definitions: {
          foo: {
            $ref: 'http://foo',
          },
        },
      };

      const reader: Types.IResolver = {
        async resolve(): Promise<any> {
          return data.markdown;
        },
      };

      const resolver = new Resolver({
        resolvers: {
          http: reader,
        },
        parseResolveResult: async () => {
          throw new Error('some parse error!');
        },
      });

      const result = await resolver.resolve(source);

      expect(result.result).toEqual({
        definitions: {
          foo: {
            $ref: 'http://foo',
          },
        },
      });

      expect({ ...result.errors[0], uri: undefined }).toEqual({
        code: 'RESOLVE_URI',
        message: "Error: Could not parse remote reference response for 'http://foo/' - Error: some parse error!",
        pointerStack: [],
        uriStack: [],
        path: ['definitions', 'foo'],
        uri: undefined,
      });
      expect(result.errors[0].uri.toString()).toEqual(new URI('http://foo').toString());
    });

    /**
     * Allows the consumer to provide a custom ref transformer to transform a fully resolved object.
     *
     */
    test('should support `transformDereferenceResult` hook', async () => {
      const data = {
        markdown: '# hello',
        bar: {
          hello: `{ "hello": "world" }`,
        },
      };

      const source = {
        definitions: {
          foo: {
            $ref: 'http://foo.com/foo.md#/markdown',
          },
          bar: {
            $ref: 'http://foo.com/bar.json#/hello',
          },
        },
      };

      const reader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          if (ref.path().split('.')[1] === 'md') {
            return data;
          }

          return data.bar;
        },
      };

      const resolver = new Resolver({
        resolvers: {
          http: reader,
        },
        transformDereferenceResult: async opts => {
          if (opts.parentAuthority.path().split('.')[1] === 'md') {
            opts.result = {
              heading1: 'hello',
            };
          } else if (opts.parentAuthority.toString() === 'http://foo.com/bar.json' && opts.fragment === '/hello') {
            // Can transform the result however you want
            opts.result = {
              pooh: 'bear',
            };
          }

          return opts;
        },
      });

      const result = await resolver.resolve(source);

      expect(result.result).toEqual({
        definitions: {
          foo: {
            heading1: 'hello',
          },
          bar: {
            pooh: 'bear',
          },
        },
      });
    });

    test('should pass `transformDereferenceResult` to child runners', async () => {
      const data = {
        foo: {
          $ref: 'http://foo.com/hi',
        },
        hi: {
          $ref: 'http://foo.com/bye',
        },
        bye: {
          adios: true,
        },
        bar: {
          hello: 'world',
        },
      };

      const source = {
        definitions: {
          foo: {
            $ref: 'http://foo.com/foo',
          },
          bar: {
            $ref: 'http://foo.com/bar',
          },
        },
      };

      const reader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          return data[ref.path().slice(1)];
        },
      };

      let counter = 0;
      const resolver = new Resolver({
        resolvers: {
          http: reader,
        },
        transformDereferenceResult: async opts => {
          counter += 1;
          return opts;
        },
      });

      const result = await resolver.resolve(source);

      expect(result.result).toEqual({
        definitions: {
          foo: {
            adios: true,
          },
          bar: {
            hello: 'world',
          },
        },
      });

      expect(counter).toEqual(5);
    });

    test('should support catching error in `transformDereferenceResult` hook', async () => {
      const data = {
        markdown: '# hello',
      };

      const source = {
        definitions: {
          foo: {
            $ref: 'http://foo.com#/markdown',
          },
        },
      };

      const reader: Types.IResolver = {
        async resolve(): Promise<any> {
          return data;
        },
      };

      const resolver = new Resolver({
        resolvers: {
          http: reader,
        },
        transformDereferenceResult: async opts => {
          if (opts.parentAuthority.toString() === 'http://foo.com/') throw new Error('some transform error!');

          return opts;
        },
      });

      const result = await resolver.resolve(source);

      expect(result.result).toEqual({
        definitions: {
          foo: '# hello',
        },
      });

      expect({ ...result.errors[0], uri: undefined }).toEqual({
        code: 'TRANSFORM_DEREFERENCED',
        message:
          "Error: Could not transform dereferenced result for 'http://foo.com/#/markdown' - Error: some transform error!",
        pointerStack: [],
        uriStack: [],
        path: ['markdown'],
        uri: undefined,
      });
      expect(result.errors[0].uri.toString()).toEqual(new URI('#/markdown').toString());
    });

    test('should pass context to transformRef and read', async () => {
      let t1;
      let t2;
      let r1;
      let r2;

      const source = {
        inner: {
          $ref: 'http://foo.com#/foo',
        },
      };

      const resolver = new Resolver({
        ctx: {
          rootProp: 'hi',
        },
      });

      await resolver.resolve(source, {
        ctx: {
          prop: 'bye',
        },
        transformRef(opts, ctx) {
          t1 = ctx.rootProp;
          t2 = ctx.prop;
          return opts.ref;
        },
        resolvers: {
          http: {
            resolve: async (_uri, ctx) => {
              r1 = ctx.rootProp;
              r2 = ctx.prop;
            },
          },
        },
      });

      expect(t1).toEqual('hi');
      expect(t2).toEqual('bye');
      expect(r1).toEqual('hi');
      expect(r2).toEqual('bye');
    });
  });

  describe('relative paths', () => {
    test('should not call resolver if resolved path points to current uri', async () => {
      const source = {
        schema: {
          $ref: './spec.json#/definitions/user',
        },
        definitions: {
          user: {
            $ref: './models/user.json#/inner',
          },
        },
      };

      const remotes = {
        '/root/models/user.json': {
          inner: {
            address: {
              $ref: 'user.json#/definitions/address',
            },
          },
          definitions: {
            address: {
              street: '123',
            },
          },
        },
      };

      const uris: string[] = [];
      const reader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          const uri = ref.toString();
          uris.push(uri);
          return remotes[uri];
        },
      };

      const resolver = new Resolver();

      const result = await resolver.resolve(source, {
        baseUri: '/root/spec.json',
        resolvers: {
          file: reader,
        },
      });

      // should only have called read on
      expect(uris).toEqual(['/root/models/user.json']);

      expect(result.result).toEqual({
        schema: {
          address: {
            street: '123',
          },
        },
        definitions: {
          user: {
            address: {
              street: '123',
            },
          },
        },
      });
    });

    test('should resolve http relative paths', async () => {
      const source = httpMocks['https://root.com/foo.yml'];

      const resolver = new Resolver({
        resolvers: {
          https: new HttpReader(),
        },
      });

      const result = await resolver.resolve(source, {
        baseUri: 'https://root.com/foo.yml',
      });

      expect(result.result).toEqual({
        foo: 'bear',
      });
    });

    test('should resolve http relative paths in deep chain', async () => {
      const source = httpMocks['https://exporter.stoplight.io/4254/master/main.oas2.yml'];

      const resolver = new Resolver({
        resolvers: {
          https: new HttpReader(),
        },
      });

      const result = await resolver.resolve(source, {
        baseUri: 'https://exporter.stoplight.io/4254/master/main.oas2.yml',
      });

      expect(result.result).toEqual(resolvedResults['https://exporter.io/resolved']);
    });

    // ./a#/foo -> ./b#bar -> ./a#/xxx -> ./c -> ./b#/zzz
    test('should resolve http relative paths + back pointing uri refs', async () => {
      const source = httpMocks['https://back-pointing.com/a'];

      const resolver = new Resolver({
        resolvers: {
          https: new HttpReader(),
        },
      });

      const result = await resolver.resolve(source, {
        baseUri: 'https://back-pointing.com/a',
      });

      expect(result.result).toEqual({
        name: 'a',
        value: {
          name: 'b1',
          value: {
            name: 'a1',
            value: {
              name: 'c',
              value: 'b2',
            },
          },
        },
        defs: {
          one: {
            name: 'a1',
            value: {
              name: 'c',
              value: 'b2',
            },
          },
        },
      });
    });
  });

  describe('print tree', () => {
    test('should handle local refs', async () => {
      const data = {
        title: 'Example',
        type: 'object',
        definitions: {
          bear: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
              },
              diet: {
                type: 'string',
              },
              age: {
                type: 'number',
              },
            },
            required: ['type', 'diet', 'age'],
          },
        },
        description: 'Bears are awesome',
        properties: {
          id: {
            type: 'string',
          },
          bear: {
            $ref: '#/definitions/bear',
          },
        },
      };

      const resolver = new Resolver();
      const { graph } = await resolver.resolve(data);

      expect(graph.dependenciesOf('root')).toMatchSnapshot();
    });

    // ./a#/foo -> ./b#bar -> ./a#/xxx -> ./c -> ./b#/zzz
    test('should resolve http relative paths + back pointing uri refs', async () => {
      const source = httpMocks['https://back-pointing.com/a'];

      const resolver = new Resolver({
        resolvers: {
          https: new HttpReader(),
        },
      });

      const baseUri = 'https://back-pointing.com/a';
      const { graph } = await resolver.resolve(source, {
        baseUri,
      });

      expect(graph.dependenciesOf[baseUri]).toMatchSnapshot();
    });

    test('circular refs', async () => {
      const source = {
        ref1: {
          $ref: '#/ref3',
        },
        ref2: {
          $ref: '#/ref1',
        },
        ref3: {
          $ref: '#/ref2',
        },
      };

      const resolver = new Resolver();
      const { graph } = await resolver.resolve(source);

      expect(graph.dependenciesOf('root')).toMatchSnapshot();
    });

    test('indirect circular refs', async () => {
      const data = {
        obj1: {
          one: true,
          foo: {
            $ref: 'custom://obj2',
          },
        },
        obj2: {
          two: true,
          foo: {
            $ref: 'custom://obj3',
          },
        },
        obj3: {
          three: true,
          foo: {
            $ref: 'custom://obj1',
          },
        },
      };

      const source = {
        inner: {
          data: {
            $ref: 'custom://obj1',
          },
        },
      };

      const reader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          return data[ref.authority()];
        },
      };

      const resolver = new Resolver({
        resolvers: {
          custom: reader,
        },
      });

      const { graph } = await resolver.resolve(source);

      expect(graph.dependenciesOf('root')).toMatchSnapshot();
    });
  });

  describe('use cases', () => {
    test('mixture of file and http', async () => {
      const data = {
        oas: {
          swagger: '2.0',
          definitions: {
            user: {
              title: 'User',
            },
          },
        },
        'https://foo.com/intro.md': `Here is **my markdown**.`,
      };

      const httpReader: Types.IResolver = {
        async resolve(ref: uri.URI): Promise<any> {
          return data[ref.toString()];
        },
      };

      const fileReader: Types.IResolver = {
        async resolve(): Promise<any> {
          return data.oas;
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

      const resolver = new Resolver({
        resolvers: {
          http: httpReader,
          https: httpReader,
          file: fileReader,
        },
      });

      const result = await resolver.resolve(source);

      expect(result.result).toEqual({
        definitions: {
          someOASFile: data.oas.definitions.user,
          someMarkdownFile: data['https://foo.com/intro.md'],
        },
      });
    });

    // this was derived from a real world customer use case
    test('deep uri + pointer chain', async () => {
      const source = {
        $ref: 'https://foo.com/1/master/main.hub.yml#/pages/~1/data',
      };

      const resolver = new Resolver({
        resolvers: {
          https: new HttpReader(),
        },
      });

      const result = await resolver.resolve(source);

      expect(result.result).toEqual({
        children: [
          {
            data: {
              foo: 'bar',
            },
          },
        ],
      });
    });
  });
});
