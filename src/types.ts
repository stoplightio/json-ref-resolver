import { DepGraph } from 'dependency-graph';

/**
 * The following interfaces are the primary interaction points for json-ref-resolver.
 *
 * IResolverOpts
 * IResolveOpts
 * IResolveResult
 */

/** The options that you can pass to `new Resolver(opts)` */
export interface IResolverOpts {
  /** Used to store authority lookup results. If no cache passed in, one will be created for you. */
  authorityCache?: ICache;

  /**
   * Readers define how to read pointers for different schemes (http, file, mongo, whatever).
   *
   * If you do not pass in any readers, only local pointer resolution will work `#/foo/bar`.
   */
  readers?: {
    [scheme: string]: IReader;
  };

  /**
   * Hook to customize which properties are resolved.
   *
   * By default, only `$ref` keys are considered and processed.
   *
   * If defined, this hook is called for every single property in source, so it should be performant!
   *
   * It should return the string to be resolved, or nothing to skip.
   *
   * Note, this overrides the default behavior. If you would like to preserve that, call the exported `defaultGetRef`
   * as part of your custom `getRef` function.
   */
  getRef?: (key: string, val: any) => string | void;

  /**
   * Hook to transform the final ref value before it is resolved.
   *
   * It should return a URI object to change the value being resolved, or void to make no changes.
   */
  transformRef?: (opts: IRefTransformer, ctx: any) => uri.URI | void;

  /**
   * Hook to customize how the result of an authority look is parsed.
   *
   * For example, could use `js-yaml` to parse a yaml string returned from the authority.
   */
  parseAuthorityResult?: (opts: IAuthorityParser) => Promise<IAuthorityParserResult>;

  /** Should we resolve local pointers? true by default. */
  resolvePointers?: boolean;

  /**
   * Should we resolve authorities? true by default.
   *
   * Note, must have a reader defined for the authority scheme in question.
   */
  resolveAuthorities?: boolean;

  /** Does not do much right now... */
  debug?: boolean;

  /**
   * A spot to put your own arbitrary data.
   *
   * This is passed through to some hook functions, such as `transformRef` and `Reader.read`.
   */
  ctx?: any;
}

/** The options that you can pass to `resolver.resolve(opts)` */
export interface IResolveOpts extends IResolverOpts {
  // resolve a specific part of the source object
  jsonPointer?: string;

  // the parent authority. basically, where are we right now (current URL to help with relative $refs, or process.cwd() for files, etc)
  authority?: uri.URI;
}

/** The object returned from `await resolver.resolve()` */
export interface IResolveResult {
  /** The original source object, with all relevant references replaced. */
  result: any;

  /** A map of every single reference in source, and where it points. */
  refMap: {
    [source: string]: string;
  };

  /** Any errors that occured during the resolution process. */
  errors: IResolveError[];

  /** The runner itself, which can be useful in more advanced cases. */
  runner: IResolveRunner;
}

/**
 * The below are useful to reference, but mostly internal details.
 */

export interface IReader {
  read(ref: uri.URI, ctx: any): Promise<any>;
}

export interface IAuthorityParser {
  result: any;
  authorityResult: IAuthorityLookupResult;
  targetAuthority: uri.URI;
  parentAuthority: uri.URI;
  parentPath: string[];
}

export interface IAuthorityParserResult {
  result?: any;
  error?: Error;
}

export interface IAuthorityLookupResult {
  pointerStack: string[];
  targetPath: string[];
  resolved?: IResolveResult;
  error?: IResolveError;
}

/** @hidden */
export interface IComputeRefOpts {
  key?: any;
  val: any;
  pointerStack: string[];
  jsonPointer?: string;
}

export interface IRefTransformer extends IComputeRefOpts {
  ref?: uri.URI;
  authority: uri.URI;
}

export type ResolverErrorCode = 'POINTER_MISSING' | 'RESOLVE_AUTHORITY' | 'PARSE_AUTHORITY' | 'RESOLVE_POINTER';
export interface IResolveError {
  code: ResolverErrorCode;
  message: string;
  path: string[];
  authority: uri.URI;
  authorityStack: string[];
  pointerStack: string[];
}

export interface ICache {
  debug: boolean;
  readonly stats: {
    hits: number;
    misses: number;
  };

  get(key: string): any;
  set(key: string, val: any): void;
  has(key: string): boolean;
}

export interface ICacheOpts {
  // maxSize?: number;
  stdTTL?: number; // the ttl as number in ms for non-error cache element.
  // errTTL?: number; // the ttl as number in ms for every error cache element.
}

/** @hidden */
export interface IRefHandlerOpts {
  ref: uri.URI;
  val: any;
  pointerStack: string[];
  cacheKey: string;
  resolvingPointer?: string;
  parentPath: string[];
  parentPointer: string;
}

export interface IResolveOpts {
  parentPath?: string[];
  pointerStack?: string[];
}

export interface IResolveRunner {
  id: number;
  source: any;
  resolvePointers: boolean;
  resolveAuthorities: boolean;
  authorityCache: ICache;
  depth: number;
  atMaxAuthorityDepth: () => boolean;
  resolve: (source: any, opts?: IResolveOpts) => Promise<IResolveResult>;
  computeRef: (opts: IComputeRefOpts) => uri.URI | void | undefined;
  lookupAndResolveAuthority: (opts: IRefHandlerOpts) => Promise<IAuthorityLookupResult>;
}

/** @hidden */
export interface IResolveRunnerOpts extends IResolveOpts {
  depth?: number;
  authorityStack?: string[];
}

export interface ICrawler {
  jsonPointer?: string;
  pointerGraph: DepGraph<string>;
  pointerStemGraph: DepGraph<string>;
  computeGraph: (target: any, parentPath: string[], parentPointer: string, pointerStack: string[]) => void;
}

export interface ICrawlerResult {
  result: any;
  errors: IResolveError[];
}
