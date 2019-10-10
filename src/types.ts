import { Segment } from '@stoplight/types';
import { Graph } from 'graphlib';

/**
 * The following interfaces are the primary interaction points for json-ref-resolver.
 *
 * IResolverOpts
 * IResolveOpts
 * IResolveResult
 */

/** The options that you can pass to `new Resolver(opts)` */
export interface IResolverOpts {
  /** Used to store uri lookup results. If no cache passed in, one will be created for you. */
  uriCache?: ICache;

  /**
   * Resolvers define how to fetch pointers for different URI schemes (http, https, file, mongo, whatever).
   *
   * If you do not pass in any resolvers, only inline pointer resolution will work `#/foo/bar`.
   */
  resolvers?: {
    [scheme: string]: IResolver;
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
   * Hook to customize how the result of an uri look is parsed.
   *
   * For example, could use `js-yaml` to parse a yaml string returned from the uri.
   */
  parseResolveResult?: (opts: IUriParser) => Promise<IUriParserResult>;

  /**
   * Hook to transform resolved object.
   *
   * For example, transform `OpenAPI` file to a `Hub Page`.
   */
  transformDereferenceResult?: (opts: IDereferenceTransformer) => Promise<ITransformerResult>;

  /** Should we resolve local pointers? true by default. */
  dereferenceInline?: boolean;

  /**
   * Should we resolve remote URIs? true by default.
   *
   * Note, must have a resolver defined for the uri scheme in question.
   */
  dereferenceRemote?: boolean;

  /**
   * A spot to put your own arbitrary data.
   *
   * This is passed through to some hook functions, such as `transformRef` and `Resolver.resolve`.
   */
  ctx?: any;
}

/** The options that you can pass to `resolver.resolve(opts)` */
export interface IResolveOpts extends IResolverOpts {
  // resolve a specific part of the source object
  jsonPointer?: string;

  // the base URI against which $ref URIs are resolved
  baseUri?: string;

  parentPath?: string[];

  pointerStack?: string[];
}

/** The object returned from `await resolver.resolve()` */
export interface IResolveResult {
  /** The original source object, with all relevant references replaced. */
  result: any;

  /**
   * A map of every single reference in source, and where it points, ie:
   *
   * ```json
   * {
   *   "#/source/user": "#/models/user",
   *   "#/source/card": "file:///api.json/#models/card"
   * }
   * ```
   */
  refMap: {
    [source: string]: string;
  };

  /**
   *
   * A graph of every single reference in source.
   *
   */
  graph: Graph;

  /** Any errors that occured during the resolution process. */
  errors: IResolveError[];

  /** The runner itself, which can be useful in more advanced cases. */
  runner: IResolveRunner;
}

/**
 * The below are useful to reference, but mostly internal details.
 */

export interface IResolver {
  resolve(ref: uri.URI, ctx: any): Promise<any>;
}

export interface IUriParser {
  result: any;
  fragment: string;
  uriResult: IUriResult;
  targetAuthority: uri.URI;
  parentAuthority: uri.URI;
  parentPath: string[];
}

export interface IUriParserResult {
  result?: any;
  error?: Error;
}

export interface IDereferenceTransformer {
  result: any;
  source: any;
  fragment: string;
  targetAuthority: uri.URI;
  parentAuthority: uri.URI;
  parentPath: string[];
}

export interface ITransformerResult {
  result?: any;
  error?: Error;
}

export interface IUriResult {
  pointerStack: string[];
  targetPath: string[];
  uri: uri.URI;
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
  uri: uri.URI;
}

export type ResolverErrorCode =
  | 'POINTER_MISSING'
  | 'RESOLVE_URI'
  | 'PARSE_URI'
  | 'RESOLVE_POINTER'
  | 'TRANSFORM_DEREFERENCED';
export interface IResolveError {
  code: ResolverErrorCode;
  message: string;
  path: Segment[];
  uri: uri.URI;
  uriStack: string[];
  pointerStack: string[];
}

export interface ICache {
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

export interface IResolveRunner {
  id: number;
  source: any;
  dereferenceInline: boolean;
  dereferenceRemote: boolean;
  uriCache: ICache;
  depth: number;
  baseUri: uri.URI;

  graph: Graph;
  root: string;

  atMaxUriDepth: () => boolean;
  resolve: (opts?: IResolveOpts) => Promise<IResolveResult>;
  computeRef: (opts: IComputeRefOpts) => uri.URI | void | undefined;
  lookupAndResolveUri: (opts: IRefHandlerOpts) => Promise<IUriResult>;
}

/** @hidden */
export interface IResolveRunnerOpts extends IResolveOpts {
  root?: uri.URI;

  depth?: number;
  uriStack?: string[];
}

export interface ICrawler {
  jsonPointer?: string;
  pointerGraph: Graph;
  pointerStemGraph: Graph;
  resolvers: Array<Promise<IUriResult>>;
  computeGraph: (target: any, parentPath: string[], parentPointer: string, pointerStack?: string[]) => void;
}

export interface ICrawlerResult {
  result: any;
  errors: IResolveError[];
}
