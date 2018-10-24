/**
 * @jest-environment node
 */

const Benchmark = require('benchmark');

const { ResolveCrawler } = require('../src/crawler');
const { Resolver } = require('../src/resolver');
const { ResolveRunner } = require('../src/runner');

import Circular from './fixtures/circular';

describe('resolver', () => {
  test.skip('benchmark', async () => {
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
        .add('basic resolve', async () => {
          const resolver = new Resolver();
          await resolver.resolve(Circular);
        })
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
          // at the time i'm writing this, i get ~5k op/s on my macbook pro
          // @ts-ignore
          expect(this['0'].hz).toBeGreaterThan(3000);
          resolve();
        })
        .run();
    });
  });
});
