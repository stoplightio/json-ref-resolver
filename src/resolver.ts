import { URI } from '@stoplight/uri';

import { Cache } from './cache';
import * as Types from './types';

import { ResolveRunner } from './runner';

export class Resolver implements Types.IResolver {
  public authorityCache: Types.ICache;
  public readers: {
    [scheme: string]: Types.IReader;
  };
  public transformRef?: (opts: Types.ITransformRefOpts, ctx: any) => URI | any;
  public parseAuthorityResult?: (
    opts: Types.IParseAuthorityOpts
  ) => Promise<Types.IParseAuthorityResult>;
  public debug: boolean;
  public resolvePointers: boolean;
  public resolveAuthorities: boolean;
  public ctx: any = {};

  constructor(opts: Types.IResolverOptions = {}) {
    this.authorityCache = opts.authorityCache || new Cache(opts.authorityCacheOpts);
    this.readers = opts.readers || {};
    this.debug = opts.debug || false;
    this.transformRef = opts.transformRef;
    this.resolvePointers = opts.resolvePointers || true;
    this.resolveAuthorities = opts.resolveAuthorities || true;
    this.parseAuthorityResult = opts.parseAuthorityResult;
    this.ctx = opts.ctx;
  }

  public resolve(source: any, opts: Types.IResolveOptions = {}): Promise<Types.IResolveResult> {
    const runOpts = Object.assign(
      {},
      {
        authorityCache: this.authorityCache,
        readers: this.readers,
        debug: this.debug,
        transformRef: this.transformRef,
        resolvePointers: this.resolvePointers,
        resolveAuthorities: this.resolveAuthorities,
        parseAuthorityResult: this.parseAuthorityResult,
      },
      opts
    );

    // console.log(JSON.stringify(runOpts, null, 2));

    // merge ctx
    runOpts.ctx = Object.assign({}, this.ctx || {}, opts.ctx || {});

    const runner = new ResolveRunner(source, runOpts);

    return runner.resolve(opts.jsonPointer);
  }
}
