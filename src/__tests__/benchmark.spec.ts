/**
 * @jest-environment node
 */

import Circular from './fixtures/circular';

const Benchmark = require('benchmark');

const { ResolveCrawler } = require('../crawler');
const { Resolver } = require('../resolver');
const { ResolveRunner } = require('../runner');

/**
 * To run benchmark:
 *
 * 1. remove `.skip` below
 * 2. `yarn test tests/benchmark.spec.ts`
 */

describe.skip('benchmark', () => {
  test('huge circular resolve', async () => {
    const suite = new Benchmark.Suite();
    await new Promise(resolve => {
      // add tests
      suite
        .add('huge circular resolve', async () => {
          const resolver = new Resolver();
          await resolver.resolve(Circular);
        })
        .on('cycle', (event: any) => {
          console.log(String(event.target));
        })
        .on('complete abort', function() {
          // hz = ops / sec
          // at the time i'm writing this, i get ~45 op/s on my macbook pro
          // @ts-ignore
          expect(this['0'].hz).toBeGreaterThan(40);
          resolve();
        })
        .run();
    });
  });

  test('crawler', async () => {
    const suite = new Benchmark.Suite();

    const source = {
      description: 'Just a basic schema.',
      title: 'Basic Object',
      type: 'object',
      definitions: {
        foo: {
          $ref: '#/definitions/bar',
        },
        bar: {
          $ref: '#/definitions/foo',
        },
        RegexNodeDto: {
          id: 'RegexNodeDto',
          properties: {
            Children: {
              required: true,
              items: {
                $ref: '#/definitions/RegexNodeDto',
              },
              type: 'Array',
            },
            NodeType: {
              required: true,
              type: 'string',
            },
            Pattern: {
              required: true,
              type: 'string',
            },
            Index: {
              required: true,
              type: 'int',
            },
            Id: {
              required: true,
              type: 'int',
            },
          },
        },
      },
      properties: {
        foo: {
          $ref: '#/definitions/foo',
        },
        bar: {
          $ref: '#/definitions/bar',
        },
      },
    };

    const sharedRunner = new ResolveRunner();

    await new Promise(resolve => {
      // add tests
      suite
        .add('crawler', () => {
          // create our crawler instance
          const crawler = new ResolveCrawler(sharedRunner);

          try {
            // crawl to build up the authorityResolvers and pointerGraph
            crawler.computeGraph(source);
          } catch (e) {
            console.log(e);
            throw e;
          }
        })
        .on('cycle', (event: any) => {
          console.log(String(event.target));
        })
        .on('complete abort', function() {
          // hz = ops / sec
          // at the time i'm writing this, i get ~24,000 op/s on my macbook pro
          // @ts-ignore
          expect(this['0'].hz).toBeGreaterThan(20000);
          resolve();
        })
        .run();
    });
  });
});
