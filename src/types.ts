import { URI } from '@stoplight/uri/lib/uri';
import { DepGraph } from 'dependency-graph';

export interface IResolver {
  authorityCache: ICache;

  resolve(source: any, opts?: IResolveOptions): Promise<IResolveResult>;
}

export interface IResolverOptions {
  // if no cache passed in, one will be created
  authorityCache?: ICache;

  authorityCacheOpts?: ICacheOptions;

  // without readers, only pointer resolution will work
  readers?: {
    [scheme: string]: IReader;
  };

  // customize what is resolved and/or transform the standard $refs that are resolved
  transformRef?: (opts: ITransformRefOpts, ctx: any) => URI | void;

  parseAuthorityResult?: (opts: IParseAuthorityOpts) => Promise<IParseAuthorityResult>;

  // should we resolve pointers? true by default
  resolvePointers?: boolean;

  // should we resolve authorities? true by default
  resolveAuthorities?: boolean;

  // doesn't do much right now...
  debug?: boolean;

  // user provided data
  ctx?: any;
}

export interface IResolveOptions extends IResolverOptions {
  // resolve a specific part of the source object
  jsonPointer?: string;

  // the parent authority. basically, where are we right now (current URL to help with relative $refs, or process.cwd() for files, etc)
  authority?: URI;
}

export interface IReader {
  read(ref: URI, ctx: any): Promise<any>;
}

export interface IParseAuthorityOpts {
  result: any;
  authorityResult: IAuthorityLookupResult;
  targetAuthority: URI;
  parentAuthority: URI;
  parentPath: string[];
}

export interface IParseAuthorityResult {
  result?: any;
  error?: Error;
}

export interface IComputeRefOpts {
  key?: any;
  val: any;
  pointerStack: string[];
  jsonPointer?: string;
}

export interface ITransformRefOpts extends IComputeRefOpts {
  ref?: URI;
  authority: URI;
}

export type ResolverErrorCode =
  | 'POINTER_MISSING'
  | 'RESOLVE_AUTHORITY'
  | 'PARSE_AUTHORITY'
  | 'RESOLVE_POINTER';
export interface IResolveError {
  code: ResolverErrorCode;
  message: string;
  path: string[];
  authority: URI;
  authorityStack: string[];
  pointerStack: string[];
}

export interface IResolveResult {
  result: any;
  errors: IResolveError[];
  runner: IResolveRunner;
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

export interface ICacheOptions {
  // maxSize?: number;
  stdTTL?: number; // the ttl as number in ms for non-error cache element.
  // errTTL?: number; // the ttl as number in ms for every error cache element.
}

export interface IRefHandlerOpts {
  ref: URI;
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
  resolve: (source: any, opts?: IResolveOptions) => Promise<IResolveResult>;
  computeRef: (opts: IComputeRefOpts) => URI | void | undefined;
  lookupAndResolveAuthority: (opts: IRefHandlerOpts) => Promise<IAuthorityLookupResult>;
}

export interface IResolveCrawler {
  jsonPointer?: string;
  pointerGraph: DepGraph<string>;
  pointerStemGraph: DepGraph<string>;
  computeGraph: (
    target: any,
    parentPath: string[],
    parentPointer: string,
    pointerStack: string[]
  ) => void;
}

export interface ICrawlerResult {
  result: any;
  errors: IResolveError[];
}

export interface IAuthorityLookupResult {
  pointerStack: string[];
  targetPath: string[];
  resolved?: IResolveResult;
  error?: IResolveError;
}

export interface IResolveRunnerOpts extends IResolveOptions {
  depth?: number;
  authorityStack?: string[];
}
