import { pathToPointer, pointerToPath, startsWith, trimStart } from '@stoplight/json';
import { DepGraph } from 'dependency-graph';
import produce, { original } from 'immer';
import { get, set } from 'lodash';
import { dirname, join } from 'path';
import * as URI from 'urijs';
import { URI as VSURI } from 'vscode-uri';

import { Cache } from './cache';
import { ResolveCrawler } from './crawler';
import * as Types from './types';
import * as Utils from './utils';

const memoize = require('fast-memoize');

let resolveRunnerCount = 0;

export const defaultGetRef = (key: string, val: any) => {
  if (val && typeof val === 'object' && typeof val.$ref === 'string') return val.$ref;
  return;
};

/** @hidden */
export class ResolveRunner implements Types.IResolveRunner {
  public readonly id: number;
  public readonly baseUri: uri.URI;
  public readonly uriCache: Types.ICache;
  public readonly graph: Types.IResolveRunner['graph'];
  public readonly root: string;

  public depth: number;
  public uriStack: string[];

  public readonly dereferenceInline: boolean;
  public readonly dereferenceRemote: boolean;
  public ctx: any = {};
  public readonly resolvers: {
    [scheme: string]: Types.IResolver;
  };

  public readonly getRef: (key: string, val: any) => string | void;
  public readonly transformRef?: (opts: Types.IRefTransformer, ctx: any) => uri.URI | any;
  public readonly parseResolveResult?: (opts: Types.IUriParser) => Promise<Types.IUriParserResult>;
  public readonly transformDereferenceResult?: (
    opts: Types.IDereferenceTransformer,
  ) => Promise<Types.ITransformerResult>;

  private _source: any;

  constructor(
    source: any,
    graph: DepGraph<any> = new DepGraph<any>({ circular: true }),
    opts: Types.IResolveRunnerOpts = {},
  ) {
    this.id = resolveRunnerCount += 1;
    this.depth = opts.depth || 0;
    this._source = source;
    this.resolvers = opts.resolvers || {};

    const baseUri = opts.baseUri || '';
    let uri = new URI(baseUri || '');
    if (this.isFile(uri)) {
      uri = new URI(VSURI.file(baseUri).fsPath.replace(/\\/g, '/'));
    }

    this.baseUri = uri;
    this.uriStack = opts.uriStack || [];
    this.uriCache = opts.uriCache || new Cache();

    this.root = (opts.root && opts.root.toString()) || this.baseUri.toString() || 'root';

    this.graph = graph;
    if (!this.graph.hasNode(this.root)) {
      this.graph.addNode(this.root);
    }

    if (this.baseUri && this.depth === 0) {
      // if this first runner has a baseUri, seed the cache so we don't create another one for this uri later
      this.uriCache.set(this.computeUriCacheKey(this.baseUri), this);
    }

    this.getRef = opts.getRef || defaultGetRef;
    this.transformRef = opts.transformRef;
    // Need to resolve pointers if depth is greater than zero because that means the autority has changed, and the
    // local refs need to be resolved.
    if (this.depth) {
      this.dereferenceInline = true;
    } else {
      this.dereferenceInline = typeof opts.dereferenceInline !== 'undefined' ? opts.dereferenceInline : true;
    }

    this.dereferenceRemote = typeof opts.dereferenceRemote !== 'undefined' ? opts.dereferenceRemote : true;
    this.parseResolveResult = opts.parseResolveResult;
    this.transformDereferenceResult = opts.transformDereferenceResult;
    this.ctx = opts.ctx;

    this.lookupUri = memoize(this.lookupUri, {
      serializer: this._cacheKeySerializer,
      cache: {
        create: () => {
          return this.uriCache;
        },
      },
    });
  }

  public get source() {
    return this._source;
  }

  public async resolve(opts?: Types.IResolveOpts): Promise<Types.IResolveResult> {
    const resolved: Types.IResolveResult = {
      result: this.source,
      graph: this.graph,
      refMap: {},
      errors: [],
      runner: this,
    };

    let targetPath: any;
    const jsonPointer = opts && opts.jsonPointer && opts.jsonPointer.trim();
    if (jsonPointer && jsonPointer !== '#' && jsonPointer !== '#/') {
      targetPath = pointerToPath(jsonPointer);
      resolved.result = get(resolved.result, targetPath);
    }

    if (resolved.result === void 0) {
      resolved.errors.push({
        code: 'POINTER_MISSING',
        message: `'${jsonPointer}' does not exist @ '${this.baseUri.toString()}'`,
        uri: this.baseUri,
        uriStack: this.uriStack,
        pointerStack: [],
        path: targetPath || [],
      });

      return resolved;
    }

    // create our crawler instance
    const crawler = new ResolveCrawler(this, jsonPointer);

    // crawl to build up the uriResolvers and pointerGraph
    crawler.computeGraph(resolved.result, targetPath, jsonPointer || '');

    // only wait on uri resolvers if we have some
    let uriResults: Types.IUriResult[] = [];
    if (crawler.resolvers.length) {
      uriResults = await Promise.all(crawler.resolvers);
    }

    // wrap all the mutations in a producer, for structural sharing + immutability
    // Wait for all of the uri resolvers to complete
    if (uriResults.length) {
      // Set the uri resolver results correctly
      for (const r of uriResults) {
        // does this resolved result belong somewhere specific in the source data?
        let resolvedTargetPath = r.targetPath;

        // if not, we should set on our targetPath
        if (!resolvedTargetPath.length) resolvedTargetPath = targetPath || [];

        resolved.refMap[String(this.baseUri.clone().fragment(pathToPointer(resolvedTargetPath)))] = String(r.uri);

        if (r.error) {
          resolved.errors.push(r.error);
        }

        if (!r.resolved) continue;

        if (r.resolved.errors) {
          resolved.errors = resolved.errors.concat(r.resolved.errors);
        }

        if (r.resolved.result === void 0) continue;

        this._source = produce(this._source, (draft: any) => {
          if (r.resolved) {
            if (!resolvedTargetPath.length) {
              return r.resolved.result;
            } else {
              set(draft, resolvedTargetPath, r.resolved.result);

              this._setGraphNodeData(String(r.uri), resolvedTargetPath, r.resolved.result);
            }
          }
        });
      }
    }

    if (typeof this._source === 'object') {
      // If using parseAuthorityResult, do not need to replace local pointers here (parseAuthorityResult is responsible)
      // if this is not an uri, then we should parse even if parseAuthorityResult is present
      if (this.dereferenceInline) {
        this._source = produce(this._source, (draft: any) => {
          let processOrder: any[] = [];

          try {
            processOrder = crawler.pointerGraph.overallOrder();

            // loop through the pointer graph in the correct order, setting values we go
            // this is where local pointers are replaced with their resolved values
            for (const pointer of processOrder) {
              const dependants = crawler.pointerGraph.dependantsOf(pointer);
              if (!dependants.length) continue;

              const pointerPath = pointerToPath(pointer);
              const val = get(draft, pointerPath);
              for (const dependant of dependants) {
                // check to prevent circular references in the resulting JS object
                // this implementation is MUCH more performant than decycling the final object to remove circulars
                let isCircular;
                const dependantPath = pointerToPath(dependant);
                const dependantStems = crawler.pointerStemGraph.dependenciesOf(pointer);
                for (const stem of dependantStems) {
                  if (startsWith(dependantPath, pointerToPath(stem))) {
                    isCircular = true;
                    break;
                  }
                }

                // TODO: we might want to track and expose these circulars in the future?
                if (isCircular) continue;

                resolved.refMap[pathToPointer(dependantPath)] = pathToPointer(pointerPath);

                if (val !== void 0) {
                  set(draft, dependantPath, val);

                  this._setGraphNodeData(pathToPointer(pointerPath), dependantPath as string[], original(val));
                } else {
                  resolved.errors.push({
                    code: 'POINTER_MISSING',
                    message: `'${pointer}' does not exist`,
                    path: dependantPath,
                    uri: this.baseUri,
                    uriStack: this.uriStack,
                    pointerStack: [],
                  });
                }
              }
            }
          } catch (e) {
            // (MM) TODO: report this error? usually means some sort of uncaught circular structure
          }
        });
      }

      if (targetPath) {
        resolved.result = get(this._source, targetPath);
      } else {
        resolved.result = this._source;
      }
    } else {
      resolved.result = this._source;
    }

    // support custom transformers
    if (this.transformDereferenceResult) {
      const ref = new URI(jsonPointer || '');
      try {
        const { result, error } = await this.transformDereferenceResult({
          source: this.source,
          result: resolved.result,
          targetAuthority: ref,
          parentAuthority: this.baseUri,
          parentPath: opts ? opts.parentPath || [] : [],
          fragment: ref.fragment(),
        });

        resolved.result = result;
        if (error) {
          throw new Error(`Could not transform dereferenced result for '${ref.toString()}' - ${String(error)}`);
        }
      } catch (e) {
        resolved.errors.push({
          code: 'TRANSFORM_DEREFERENCED',
          message: `Error: Could not transform dereferenced result for '${this.baseUri.toString()}${
            ref.fragment() !== '' ? `#${ref.fragment()}` : ``
          }' - ${String(e)}`,
          uri: ref,
          uriStack: this.uriStack,
          pointerStack: [],
          path: targetPath,
        });
      }
    }

    return resolved;
  }

  /**
   * Determine if we should resolve this part of source.
   *
   * If so, return the appropriate URI object.
   */
  public computeRef = (opts: Types.IComputeRefOpts): uri.URI | void => {
    const refStr = this.getRef(opts.key, opts.val);

    if (!refStr) return;

    let ref = new URI(refStr);

    // Does ref only have a fragment
    if (ref.toString().charAt(0) !== '#') {
      const isFile = this.isFile(ref);

      // if we're working with a file, resolve any path diferences and make sure the scheme is set
      if (isFile) {
        let absRef = ref.toString();
        if (!ref.is('absolute')) {
          if (this.baseUri.toString()) {
            absRef = join(dirname(this.baseUri.toString()), absRef);
          } else {
            absRef = '';
          }
        }

        if (absRef) {
          ref = new URI(VSURI.file(absRef).fsPath.replace(/\\/g, '/')).fragment(ref.fragment());
        }
      } else if (ref.scheme().includes('http') || (ref.scheme() === '' && this.baseUri.scheme().includes('http'))) {
        if (this.baseUri.authority() !== '' && ref.authority() === '') {
          ref = ref.absoluteTo(this.baseUri);
        }
      }
    }

    if (this.transformRef) {
      return this.transformRef(
        {
          ...opts,
          ref,
          uri: this.baseUri,
        },
        this.ctx,
      );
    }

    return ref;
  };

  public atMaxUriDepth = () => {
    return this.uriStack.length >= 100;
  };

  public lookupUri = async (opts: {
    fragment: string;
    ref: uri.URI;
    cacheKey: string;
    parentPath: string[];
  }): Promise<ResolveRunner> => {
    const { ref } = opts;

    let scheme = ref.scheme();

    // if we have a scheme, but no resolver for it, attempt the file scheme
    // this covers windows specific cases such as c:/foo/bar.json
    if (!this.resolvers[scheme] && this.isFile(ref)) {
      scheme = 'file';
    }

    const resolver = this.resolvers[scheme];
    if (!resolver) {
      throw new Error(`No resolver defined for scheme '${ref.scheme() || 'file'}' in ref ${ref.toString()}`);
    }

    let result = await resolver.resolve(ref, this.ctx);

    // support custom parsers
    if (this.parseResolveResult) {
      try {
        const parsed = await this.parseResolveResult({
          uriResult: result,
          result,
          targetAuthority: ref,
          parentAuthority: this.baseUri,
          parentPath: opts.parentPath,
          fragment: opts.fragment,
        });

        result = parsed.result;
      } catch (e) {
        throw new Error(`Could not parse remote reference response for '${ref.toString()}' - ${String(e)}`);
      }
    }

    return new ResolveRunner(result, this.graph, {
      depth: this.depth + 1,
      baseUri: ref.toString(),
      root: ref,
      uriStack: this.uriStack,
      uriCache: this.uriCache,
      resolvers: this.resolvers,
      transformRef: this.transformRef,
      parseResolveResult: this.parseResolveResult,
      transformDereferenceResult: this.transformDereferenceResult,
      dereferenceRemote: this.dereferenceRemote,
      dereferenceInline: this.dereferenceInline,
      ctx: this.ctx,
    });
  };

  public lookupAndResolveUri = async (opts: Types.IRefHandlerOpts): Promise<Types.IUriResult> => {
    const { val, ref, resolvingPointer, parentPointer, pointerStack } = opts;

    // slice to make a fresh copy since we mutate in crawler for performance
    const parentPath = (opts.parentPath || []).slice();

    const uriCacheKey = this.computeUriCacheKey(ref);
    const lookupResult: Types.IUriResult = {
      uri: ref,
      pointerStack,
      targetPath: resolvingPointer === parentPointer ? [] : parentPath,
    };

    if (this.uriStack.includes(uriCacheKey)) {
      lookupResult.resolved = {
        result: val,
        graph: this.graph,
        refMap: {},
        errors: [],
        runner: this,
      };

      return lookupResult;
    } else {
      let uriResolver: ResolveRunner;

      try {
        if (this.atMaxUriDepth()) {
          // safe guard against edge cases we might not have caught yet..
          // TODO: report this to bugsnag so we can track? throw it as some special
          // fatal error, that platform can look for and report (maybe other errors as well)?
          throw new Error(
            `Max uri depth (${this.uriStack.length}) reached. Halting, this is probably a circular loop.`,
          );
        }

        uriResolver = await this.lookupUri({
          ref: ref.clone().fragment(''),
          fragment: ref.fragment(),
          cacheKey: uriCacheKey,
          parentPath,
        });

        const currentAuthority = this.baseUri.toString();
        if (currentAuthority && this.depth !== 0) {
          uriResolver.uriStack = uriResolver.uriStack.concat([currentAuthority]);
        }
      } catch (e) {
        lookupResult.error = {
          code: 'RESOLVE_URI',
          message: String(e),
          uri: ref,
          uriStack: this.uriStack,
          pointerStack,
          path: parentPath,
        };
      }

      // only resolve the uri result if we were able to look it up and create the resolver
      // @ts-ignore
      if (uriResolver) {
        lookupResult.resolved = await uriResolver.resolve({
          jsonPointer: Utils.uriToJSONPointer(ref),
          parentPath,
        });

        // if pointer resolution failed, revert to the original value (which will be a $ref most of the time)
        if (lookupResult.resolved.errors.length) {
          for (const error of lookupResult.resolved.errors) {
            if (
              error.code === 'POINTER_MISSING' &&
              error.path.join('/') === ref.fragment().slice(1) // only reset result value if the error is specifically for this fragment
            ) {
              // if the original uri request had a #/fragment on it, we wont be working with the root
              // result value, but rather whatever was at #/fragment
              // so this just trims #/fragment off the front of the error path (which is relative to the root), so that we can effectively
              // set the correct property on the result fragment
              const errorPathInResult = ref.fragment
                ? trimStart(error.path, trimStart(ref.fragment(), '/').split('/'))
                : error.path;

              if (errorPathInResult && errorPathInResult.length) {
                set(lookupResult.resolved.result, errorPathInResult, val);
              } else if (lookupResult.resolved.result) {
                lookupResult.resolved.result = val;
              }
            }
          }
        }
      }
    }

    return lookupResult;
  };

  public _cacheKeySerializer(sOpts: any) {
    return sOpts && typeof sOpts === 'object' && sOpts.cacheKey ? sOpts.cacheKey : JSON.stringify(arguments);
  }

  private computeUriCacheKey(ref: uri.URI) {
    // don't include the fragment on uri cache key
    return ref
      .clone()
      .fragment('')
      .toString();
  }

  private isFile(ref: uri.URI): boolean {
    const scheme = ref.scheme();

    if (scheme === 'file') return true;

    if (!scheme) {
      // if no scheme set, and ref starts with a '/', assume it's a file
      if (ref.toString().charAt(0) === '/') return true;

      if (this.baseUri) {
        // if the file scheme is not explicitly set, check the uri
        const uriScheme = this.baseUri.scheme();

        // if the uri has no scheme, then assume it is a file (urls will have http, etc)
        return Boolean(!uriScheme || uriScheme === 'file' || !this.resolvers[uriScheme]);
      }
    } else if (!this.resolvers[scheme]) {
      // if we have a scheme, but no resolver for it, attempt the file scheme
      // this covers windows specific cases such as c:/foo/bar.json
      return true;
    }

    return false;
  }

  private _setGraphNodeData(nodeId: string, propertyPath: string[], data: any) {
    if (!this.graph.hasNode(nodeId)) return;

    const graphNodeData = this.graph.getNodeData(nodeId);

    let propertyPaths = {};

    // create an empty placeholder in case graphNodeData isn't an object
    propertyPaths[this.root] = [];

    if (typeof graphNodeData === 'object') {
      propertyPaths = {
        ...propertyPaths,
        ...graphNodeData.propertyPaths,
      };
    }

    propertyPaths[this.root].push(pathToPointer(propertyPath));

    this.graph.setNodeData(nodeId, {
      propertyPaths,

      data,
    });
  }
}
