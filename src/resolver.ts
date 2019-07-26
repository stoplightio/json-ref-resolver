import { Cache } from './cache';
import { ResolveRunner } from './runner';
import * as Types from './types';

/**
 * This is the primary class.
 *
 * See IResolverOptions for available options that you can pass in.
 */
export class Resolver {
  public readonly uriCache: Types.ICache;

  protected dereferenceInline: boolean;
  protected dereferenceRemote: boolean;
  protected ctx: any = {};
  protected resolvers: {
    [scheme: string]: Types.IResolver;
  };

  protected getRef?: (key: string, val: any) => string | void;
  protected transformRef?: (opts: Types.IRefTransformer, ctx: any) => uri.URI | any;
  protected parseResolveResult?: (opts: Types.IUriParser) => Promise<Types.IUriParserResult>;
  protected transformDereferenceResult?: (opts: Types.ITransformerOptions) => Promise<Types.ITransformerResult>;

  constructor(opts: Types.IResolverOpts = {}) {
    this.uriCache = opts.uriCache || new Cache();
    this.resolvers = opts.resolvers || {};
    this.getRef = opts.getRef;
    this.transformRef = opts.transformRef;
    this.dereferenceInline = typeof opts.dereferenceInline !== 'undefined' ? opts.dereferenceInline : true;
    this.dereferenceRemote = typeof opts.dereferenceRemote !== 'undefined' ? opts.dereferenceRemote : true;
    this.parseResolveResult = opts.parseResolveResult;
    this.transformDereferenceResult = opts.transformDereferenceResult;
    this.ctx = opts.ctx;
  }

  public resolve(source: any, opts: Types.IResolveOpts = {}): Promise<Types.IResolveResult> {
    const runner = new ResolveRunner(source, {
      uriCache: this.uriCache,
      resolvers: this.resolvers,
      getRef: this.getRef,
      transformRef: this.transformRef,
      dereferenceInline: this.dereferenceInline,
      dereferenceRemote: this.dereferenceRemote,
      parseResolveResult: this.parseResolveResult,
      transformDereferenceResult: this.transformDereferenceResult,
      ...opts,
      ctx: Object.assign({}, this.ctx || {}, opts.ctx || {}),
    });

    return runner.resolve(opts.jsonPointer);
  }
}
