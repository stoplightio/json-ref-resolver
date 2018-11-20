import { Cache } from './cache';
import * as Types from './types';

import { ResolveRunner } from './runner';

/**
 * This is the primary class.
 *
 * See IResolverOptions for available options that you can pass in.
 */
export class Resolver {
  public readonly authorityCache: Types.ICache;

  protected resolvePointers: boolean;
  protected resolveAuthorities: boolean;
  protected ctx: any = {};
  protected debug: boolean;
  protected readers: {
    [scheme: string]: Types.IReader;
  };

  protected isRef?: (key: string, val: any) => string | void;
  protected transformRef?: (opts: Types.IRefTransformer, ctx: any) => uri.URI | any;
  protected parseAuthorityResult?: (opts: Types.IAuthorityParser) => Promise<Types.IAuthorityParserResult>;

  constructor(opts: Types.IResolverOpts = {}) {
    this.authorityCache = opts.authorityCache || new Cache();
    this.readers = opts.readers || {};
    this.debug = opts.debug || false;
    this.isRef = opts.isRef;
    this.transformRef = opts.transformRef;
    this.resolvePointers = typeof opts.resolvePointers !== 'undefined' ? opts.resolvePointers : true;
    this.resolveAuthorities = typeof opts.resolveAuthorities !== 'undefined' ? opts.resolveAuthorities : true;
    this.parseAuthorityResult = opts.parseAuthorityResult;
    this.ctx = opts.ctx;
  }

  public resolve(source: any, opts: Types.IResolveOpts = {}): Promise<Types.IResolveResult> {
    const runOpts = Object.assign(
      {},
      {
        authorityCache: this.authorityCache,
        readers: this.readers,
        debug: this.debug,
        isRef: this.isRef,
        transformRef: this.transformRef,
        resolvePointers: this.resolvePointers,
        resolveAuthorities: this.resolveAuthorities,
        parseAuthorityResult: this.parseAuthorityResult,
      },
      opts
    );

    // merge ctx
    runOpts.ctx = Object.assign({}, this.ctx || {}, opts.ctx || {});

    const runner = new ResolveRunner(source, runOpts);

    return runner.resolve(opts.jsonPointer);
  }
}
