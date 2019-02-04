import { pathToPointer, pointerToPath, startsWith, trimStart } from '@stoplight/json';
import produce from 'immer';
import _get = require('lodash/get');
import _set = require('lodash/set');
import * as URI from 'urijs';

import { Cache } from './cache';
import { ResolveCrawler } from './crawler';
import * as Types from './types';
import * as Utils from './utils';

const memoize = require('fast-memoize');

let resolveRunnerCount = 0;

export const defaultGetRef = (key: string, val: any) => {
  if (val && typeof val === 'object' && val.$ref) {
    const { $ref } = val;
    if (typeof $ref === 'string') return val.$ref;
  }

  return;
};

/** @hidden */
export class ResolveRunner implements Types.IResolveRunner {
  public readonly id: number;
  public readonly authority: uri.URI;
  public readonly authorityCache: Types.ICache;

  public depth: number;
  public authorityStack: string[];

  public readonly resolvePointers: boolean;
  public readonly resolveAuthorities: boolean;
  public ctx: any = {};
  public readonly readers: {
    [scheme: string]: Types.IReader;
  };

  public readonly getRef: (key: string, val: any) => string | void;
  public readonly transformRef?: (opts: Types.IRefTransformer, ctx: any) => uri.URI | any;
  public readonly parseAuthorityResult?: (opts: Types.IAuthorityParser) => Promise<Types.IAuthorityParserResult>;

  private _source: any;

  constructor(source: any, opts: Types.IResolveRunnerOpts = {}) {
    this.id = resolveRunnerCount += 1;
    this.depth = opts.depth || 0;
    this._source = source;
    this.authority = opts.authority || new URI('');
    this.authorityStack = opts.authorityStack || [];
    this.authorityCache = opts.authorityCache || new Cache();

    if (this.authority && this.depth === 0) {
      // if this first runner is an authority, seed the cache so we don't create another one for
      // this authority later
      this.authorityCache.set(this.computeAuthorityCacheKey(this.authority), this);
    }

    this.readers = opts.readers || {};
    this.getRef = opts.getRef || defaultGetRef;
    this.transformRef = opts.transformRef;
    // Need to resolve pointers if depth is greater than zero because that means the autority has changed, and the
    // local refs need to be resolved.
    if (this.depth) {
      this.resolvePointers = true;
    } else {
      this.resolvePointers = typeof opts.resolvePointers !== 'undefined' ? opts.resolvePointers : true;
    }

    this.resolveAuthorities = typeof opts.resolveAuthorities !== 'undefined' ? opts.resolveAuthorities : true;
    this.parseAuthorityResult = opts.parseAuthorityResult;
    this.ctx = opts.ctx;

    this.lookupAuthority = memoize(this.lookupAuthority, {
      serializer: this._cacheKeySerializer,
      cache: {
        create: () => {
          return this.authorityCache;
        },
      },
    });
  }

  public get source() {
    return this._source;
  }

  public async resolve(jsonPointer?: string): Promise<Types.IResolveResult> {
    const resolved: Types.IResolveResult = {
      result: this.source,
      refMap: {},
      errors: [],
      runner: this,
    };

    let targetPath: any;
    jsonPointer = jsonPointer && jsonPointer.trim();
    if (jsonPointer && jsonPointer !== '#' && jsonPointer !== '#/') {
      targetPath = pointerToPath(jsonPointer);
      resolved.result = _get(resolved.result, targetPath);
    }

    if (!resolved.result) {
      resolved.errors.push({
        code: 'POINTER_MISSING',
        message: `'${jsonPointer}' does not exist @ '${this.authority.toString()}'`,
        authority: this.authority,
        authorityStack: this.authorityStack,
        pointerStack: [],
        path: targetPath || [],
      });

      return resolved;
    }

    // create our crawler instance
    const crawler = new ResolveCrawler(this, jsonPointer);

    // crawl to build up the authorityResolvers and pointerGraph
    crawler.computeGraph(resolved.result, targetPath, jsonPointer || '');

    // only wait on authority resolvers if we have some
    let authorityResults: Types.IAuthorityLookupResult[] = [];
    if (crawler.authorityResolvers.length) {
      authorityResults = await Promise.all(crawler.authorityResolvers);
    }

    // wrap all the mutations in a producer, for structural sharing + immutability
    // Wait for all of the authority resolvers to complete
    if (authorityResults.length) {
      // Set the authority resolver results correctly
      for (const r of authorityResults) {
        // does this resolved result belong somewhere specific in the source data?
        let resolvedTargetPath = r.targetPath;

        // if not, we should set on our targetPath
        if (!resolvedTargetPath.length) resolvedTargetPath = targetPath || [];

        resolved.refMap[String(this.authority.clone().fragment(pathToPointer(resolvedTargetPath)))] = String(r.uri);

        if (r.error) {
          resolved.errors.push(r.error);
        }

        if (!r.resolved) continue;

        if (r.resolved.errors) {
          resolved.errors = resolved.errors.concat(r.resolved.errors);
        }

        if (!r.resolved.result) continue;

        this._source = produce(this._source, draft => {
          if (r.resolved) {
            if (!resolvedTargetPath.length) {
              return r.resolved.result;
            } else {
              _set(draft, resolvedTargetPath, r.resolved.result);
            }
          }
        });
      }
    }

    if (typeof this._source !== 'object') {
      resolved.result = this._source;
      return resolved;
    }

    // If using parseAuthorityResult, do not need to replace local pointers here (parseAuthorityResult is responsible)
    // if this is not an authority, then we should parse even if parseAuthorityResult is present
    if (this.resolvePointers) {
      this._source = produce(this._source, draft => {
        let processOrder: any[] = [];

        try {
          processOrder = crawler.pointerGraph.overallOrder();

          // loop through the pointer graph in the correct order, setting values we go
          // this is where local pointers are replaced with their resolved values
          for (const pointer of processOrder) {
            const dependants = crawler.pointerGraph.dependantsOf(pointer);
            if (!dependants.length) continue;

            const pointerPath = pointerToPath(pointer);
            const val = _get(draft, pointerPath);
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

              if (val) {
                _set(draft, dependantPath, val);
              } else {
                resolved.errors.push({
                  code: 'POINTER_MISSING',
                  message: `'${pointer}' does not exist`,
                  path: dependantPath,
                  authority: this.authority,
                  authorityStack: this.authorityStack,
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
      resolved.result = _get(this._source, targetPath);
    } else {
      resolved.result = this._source;
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
    if (ref.toString() !== `#${ref.fragment()}`) {
      let isFile = ref.scheme() === 'file';

      // if the file scheme is not explicitly set, check the authority
      if (!isFile && !ref.scheme()) {
        const scheme = this.authority.scheme();
        // if the authority has no scheme, then assume it is a file (urls will have http, etc)
        isFile = scheme === '' || scheme === 'file';
      }

      // if we're working with a file, resolve any path diferences and make sure the scheme is set
      if (isFile) {
        ref = ref.absoluteTo(this.authority).scheme('file');
      } else if (ref.scheme().includes('http') || (ref.scheme() === '' && this.authority.scheme().includes('http'))) {
        if (this.authority.authority() !== '' && ref.authority() === '') {
          ref = ref.absoluteTo(this.authority);
        }
      }
    }

    if (this.transformRef) {
      return this.transformRef(
        {
          ...opts,
          ref,
          authority: this.authority,
        },
        this.ctx
      );
    }

    return ref;
  };

  public atMaxAuthorityDepth = () => {
    return this.authorityStack.length >= 100;
  };

  public lookupAuthority = async (opts: { ref: uri.URI; cacheKey: string }): Promise<ResolveRunner> => {
    const { ref } = opts;

    const reader = this.readers[ref.scheme()];
    if (!reader) {
      throw new Error(`No reader defined for scheme '${ref.scheme()}' in ref ${ref.toString()}`);
    }

    const result = await reader.read(ref, this.ctx);

    return new ResolveRunner(result, {
      depth: this.depth + 1,
      authority: ref,
      authorityStack: this.authorityStack,
      authorityCache: this.authorityCache,
      readers: this.readers,
      transformRef: this.transformRef,
      parseAuthorityResult: this.parseAuthorityResult,
      resolveAuthorities: this.resolveAuthorities,
      resolvePointers: this.resolvePointers,
      ctx: this.ctx,
    });
  };

  public lookupAndResolveAuthority = async (opts: Types.IRefHandlerOpts): Promise<Types.IAuthorityLookupResult> => {
    const { val, ref, resolvingPointer, parentPointer, pointerStack } = opts;

    // slice to make a fresh copy since we mutate in crawler for performance
    const parentPath = (opts.parentPath || []).slice();

    const authorityCacheKey = this.computeAuthorityCacheKey(ref);
    const lookupResult: Types.IAuthorityLookupResult = {
      uri: ref,
      pointerStack,
      targetPath: resolvingPointer === parentPointer ? [] : parentPath,
    };

    if (this.authorityStack.includes(authorityCacheKey)) {
      lookupResult.resolved = {
        result: val,
        refMap: {},
        errors: [],
        runner: this,
      };

      return lookupResult;
    } else {
      let authorityResolver: ResolveRunner;

      try {
        if (this.atMaxAuthorityDepth()) {
          // safe guard against edge cases we might not have caught yet..
          // TODO: report this to bugsnag so we can track? throw it as some special
          // fatal error, that platform can look for and report (maybe other errors as well)?
          throw new Error(
            `Max authority depth (${this.authorityStack.length}) reached. Halting, this is probably a circular loop.`
          );
        }

        authorityResolver = await this.lookupAuthority({
          ref: ref.clone().fragment(''),
          cacheKey: authorityCacheKey,
        });

        const currentAuthority = this.authority.toString();
        if (currentAuthority && this.depth !== 0) {
          authorityResolver.authorityStack = authorityResolver.authorityStack.concat([currentAuthority]);
        }
      } catch (e) {
        lookupResult.error = {
          code: 'RESOLVE_AUTHORITY',
          message: String(e),
          authority: ref,
          authorityStack: this.authorityStack,
          pointerStack,
          path: parentPath,
        };
      }

      // only resolve the authority result if we were able to look it up and create the resolver
      // @ts-ignore
      if (authorityResolver) {
        lookupResult.resolved = await authorityResolver.resolve(Utils.uriToJSONPointer(ref));

        // if pointer resolution failed, revert to the original value (which will be a $ref most of the time)
        if (lookupResult.resolved.errors.length) {
          for (const error of lookupResult.resolved.errors) {
            if (
              error.code === 'POINTER_MISSING' &&
              error.path.join('/') === ref.fragment().slice(1) // only reset result value if the error is specifically for this fragment
            ) {
              // if the original authority request had a #/fragment on it, we wont be working with the root
              // result value, but rather whatever was at #/fragment
              // so this just trims #/fragment off the front of the error path (which is relative to the root), so that we can effectively
              // set the correct property on the result fragment
              const errorPathInResult = ref.fragment
                ? trimStart(error.path, trimStart(ref.fragment(), '/').split('/'))
                : error.path;

              if (errorPathInResult && errorPathInResult.length) {
                _set(lookupResult.resolved.result, errorPathInResult, val);
              } else if (lookupResult.resolved.result) {
                lookupResult.resolved.result = val;
              }
            }
          }
        }

        // support custom parsers
        if (this.parseAuthorityResult) {
          try {
            // TODO: rework this to pass in an addValidation function to allow custom parsers to add their own validations
            // then generally re-work the error system here to be based around more flexible validations
            const parsed = await this.parseAuthorityResult({
              authorityResult: lookupResult,
              result: lookupResult.resolved.result,
              targetAuthority: ref,
              parentAuthority: this.authority,
              parentPath,
            });

            // if (parsed.errors) {
            // TODO: as mentioned above, allow caller to add errors/validations
            // }

            lookupResult.resolved.result = parsed.result;
          } catch (e) {
            // could not parse... roll back to original value
            lookupResult.resolved.result = val;

            lookupResult.error = {
              code: 'PARSE_AUTHORITY',
              message: `Error parsing lookup result for '${ref.toString()}': ${String(e)}`,
              authority: ref,
              authorityStack: this.authorityStack,
              pointerStack,
              path: parentPath,
            };
          }
        }
      }
    }

    return lookupResult;
  };

  public _cacheKeySerializer(sOpts: any) {
    return sOpts && typeof sOpts === 'object' && sOpts.cacheKey ? sOpts.cacheKey : JSON.stringify(arguments);
  }

  private computeAuthorityCacheKey(ref: uri.URI) {
    // don't include the fragment on authority cache key
    return ref
      .clone()
      .fragment('')
      .toString();
  }
}
