import { getValue, setValue, startsWith } from '@stoplight/json/lib/json';
import { trimStart } from '@stoplight/json/lib/json';
import { URI } from '@stoplight/uri/lib/uri';
import produce from 'immer';
const memoize = require('fast-memoize');

import { Cache } from './cache';
import { ResolveCrawler } from './crawler';
import * as Types from './types';
import * as Utils from './utils';

let resolveRunnerCount = 0;

const _removeRootPath = (root: string, child: string): string => {
  const rootPathParts = root.split('/');
  const childPathParts = child.split('/');

  for (const rootPathPart of rootPathParts) {
    if (!rootPathPart) continue;
    if (childPathParts.length === 0) break;
    if (rootPathPart === childPathParts[0]) {
      childPathParts.shift();
    } else {
      break;
    }
  }

  return childPathParts.join('/');
};

const _resolvePaths = (root: string, child: string): string => {
  const filePath = root.split('/');
  filePath[filePath.length - 1] = child;

  return filePath.join('/');
};

export class ResolveRunner implements Types.IResolveRunner {
  public readonly id: number;
  public depth: number;
  public authorityStack: string[];
  public readonly authority: URI;
  public readonly authorityCache: Types.ICache;
  public readonly readers: {
    [scheme: string]: Types.IReader;
  };
  public readonly parseAuthorityResult?: (
    opts: Types.IParseAuthorityOpts
  ) => Promise<Types.IParseAuthorityResult>;
  public readonly debug: boolean;
  public readonly resolvePointers: boolean;
  public readonly resolveAuthorities: boolean;
  public readonly transformRef?: (opts: Types.ITransformRefOpts, ctx: any) => URI | any;
  public ctx: any = {};

  private _source: any;

  constructor(source: any, opts: Types.IResolveRunnerOpts = {}) {
    this.id = resolveRunnerCount += 1;
    this.depth = opts.depth || 0;
    this._source = source;
    this.authority = opts.authority || URI.parse('');
    this.authorityStack = opts.authorityStack || [];
    this.authorityCache = opts.authorityCache || new Cache();

    if (this.authority && this.depth === 0) {
      // if this first runner is an authority, seed the cache so we don't create another one for
      // this authority later
      this.authorityCache.set(this.computeAuthorityCacheKey(this.authority), this);
    }

    this.readers = opts.readers || {};
    this.parseAuthorityResult = opts.parseAuthorityResult;
    this.transformRef = opts.transformRef;
    this.debug = opts.debug || false;
    this.resolvePointers =
      typeof opts.resolvePointers !== 'undefined' ? opts.resolvePointers : true;
    this.resolveAuthorities =
      typeof opts.resolveAuthorities !== 'undefined' ? opts.resolveAuthorities : true;
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
      errors: [],
      runner: this,
    };

    let targetPath: any;
    jsonPointer = jsonPointer && jsonPointer.trim();
    if (jsonPointer && jsonPointer !== '#' && jsonPointer !== '#/') {
      targetPath = Utils.jsonPointerToPath(jsonPointer);
      resolved.result = getValue(resolved.result, targetPath);
    }

    if (!resolved.result) {
      resolved.errors.push({
        code: 'POINTER_MISSING',
        message: `'${jsonPointer}' does not exist @ '${this.authority.toString(true)}'`,
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
        if (r.error) {
          resolved.errors.push(r.error);
        }

        if (!r.resolved) continue;

        if (r.resolved.errors) {
          resolved.errors = resolved.errors.concat(r.resolved.errors);
        }

        if (!r.resolved.result) continue;

        // does this resolved result belong somewhere specific in the source data?
        let resolvedTargetPath = r.targetPath;

        // if not, we should set on our targetPath
        if (!resolvedTargetPath.length) resolvedTargetPath = targetPath || [];

        this._source = produce(this._source, draft => {
          if (r.resolved) {
            if (!resolvedTargetPath.length) {
              return r.resolved.result;
            } else {
              setValue(draft, resolvedTargetPath, r.resolved.result);
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

            const pointerPath = Utils.jsonPointerToPath(pointer);
            const val = getValue(draft, pointerPath);
            for (const dependant of dependants) {
              // check to prevent circular references in the resulting JS object
              // this implementation is MUCH more performant than decycling the final object to remove circulars
              let isCircular;
              const dependantPath = Utils.jsonPointerToPath(dependant);
              const dependantStems = crawler.pointerStemGraph.dependenciesOf(pointer);
              for (const stem of dependantStems) {
                if (startsWith(dependantPath, Utils.jsonPointerToPath(stem))) {
                  isCircular = true;
                  break;
                }
              }

              // TODO: we might want to track and expose these circulars in the future?
              if (isCircular) continue;

              if (val) {
                setValue(draft, dependantPath, val);
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
      resolved.result = getValue(this._source, targetPath);
    } else {
      resolved.result = this._source;
    }

    return resolved;
  }

  /**
   * Determine if we should resolve this part of source
   * If so, return the appropriate URI object
   */
  public computeRef = (opts: Types.IComputeRefOpts): URI | void => {
    let ref;
    if (opts.key === '$ref') {
      ref = opts.val;
    } else if (opts.val && typeof opts.val === 'object' && opts.val.$ref) {
      ref = opts.val.$ref;
    }

    if (!ref) return;

    ref = URI.parse(ref);
    // Does ref only have a fragment
    if (ref.toString(true) !== `#${ref.fragment}`) {
      // if we're working with a file
      if (ref.isFile(this.authority)) {
        if (this.authority.scheme && !this.authority.isFile()) {
          // TODO: should error here, cannot resolve file refs if the parent is not a file (for example if parent was http)
          return ref;
        }

        const resolvedPath = _resolvePaths(this.authority.fsPath, ref.fsPath);
        ref = ref.with({ scheme: 'file', path: resolvedPath });
      } else if (
        (ref.scheme.includes('http') ||
          (ref.scheme === '' && this.authority.scheme.includes('http'))) &&
        ref.toString(true) !== this.authority.toString(true)
      ) {
        if (this.authority.authority !== '' && ref.authority === '') {
          const child = _removeRootPath(this.authority.fsPath, ref.fsPath);
          const resolvedPath = _resolvePaths(this.authority.fsPath, child);
          ref = this.authority.with({
            path: resolvedPath,
            fragment: ref.fragment,
          });
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

  public lookupAuthority = async (opts: { ref: URI; cacheKey: string }): Promise<ResolveRunner> => {
    const { ref } = opts;

    const reader = this.readers[ref.scheme];
    if (!reader) {
      throw new Error(`No reader defined for scheme '${ref.scheme}' in ref ${ref.toString(true)}`);
    }

    const result = await reader.read(ref, this.ctx);

    return new ResolveRunner(result, {
      depth: this.depth + 1,
      authority: ref,
      authorityStack: this.authorityStack,
      authorityCache: this.authorityCache,
      readers: this.readers,
      debug: this.debug,
      transformRef: this.transformRef,
      parseAuthorityResult: this.parseAuthorityResult,
      resolveAuthorities: this.resolveAuthorities,
      resolvePointers: this.resolvePointers,
      ctx: this.ctx,
    });
  };

  public lookupAndResolveAuthority = async (
    opts: Types.IRefHandlerOpts
  ): Promise<Types.IAuthorityLookupResult> => {
    const { val, ref, resolvingPointer, parentPointer, pointerStack } = opts;

    // slice to make a fresh copy since we mutate in crawler for performance
    const parentPath = (opts.parentPath || []).slice();

    const authorityCacheKey = this.computeAuthorityCacheKey(ref);
    const lookupResult: Types.IAuthorityLookupResult = {
      pointerStack,
      targetPath: resolvingPointer === parentPointer ? [] : parentPath,
    };

    if (this.authorityStack.includes(authorityCacheKey)) {
      lookupResult.resolved = {
        result: val,
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
            `Max authority depth (${
              this.authorityStack.length
            }) reached. Halting, this is probably a circular loop.`
          );
        }

        authorityResolver = await this.lookupAuthority({
          ref: ref.with({ fragment: '' }),
          cacheKey: authorityCacheKey,
        });

        const currentAuthority = this.authority.toString(true);
        if (currentAuthority && this.depth !== 0) {
          authorityResolver.authorityStack = authorityResolver.authorityStack.concat([
            currentAuthority,
          ]);
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
        try {
          lookupResult.resolved = await authorityResolver.resolve(ref.toJSONPointer());

          // if pointer resolution failed, revert to the original value (which will be a $ref most of the time)
          if (lookupResult.resolved.errors.length) {
            for (const error of lookupResult.resolved.errors) {
              if (
                error.code === 'POINTER_MISSING' &&
                error.path.join('/') === ref.fragment.slice(1) // only reset result value if the error is specifically for this fragment
              ) {
                // if the original authority request had a #/fragment on it, we wont be working with the root
                // result value, but rather whatever was at #/fragment
                // so this just trims #/fragment off the front of the error path (which is relative to the root), so that we can effectively
                // set the correct property on the result fragment
                const errorPathInResult = ref.fragment
                  ? trimStart(error.path, trimStart(ref.fragment, '/').split('/'))
                  : error.path;

                if (errorPathInResult && errorPathInResult.length) {
                  setValue(lookupResult.resolved.result, errorPathInResult, val);
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
                message: `Error parsing lookup result for '${ref.toString(e)}': ${String(e)}`,
                authority: ref,
                authorityStack: this.authorityStack,
                pointerStack,
                path: parentPath,
              };
            }
          }
        } catch (e) {
          lookupResult.error = {
            code: 'RESOLVE_POINTER',
            message: `Error resolving pointer @ ${ref.toJSONPointer()}: ${String(e)}`,
            path: parentPath,
            authority: ref,
            authorityStack: this.authorityStack,
            pointerStack,
          };
        }
      }
    }

    return lookupResult;
  };

  public _cacheKeySerializer(sOpts: any) {
    return sOpts && typeof sOpts === 'object' && sOpts.cacheKey
      ? sOpts.cacheKey
      : JSON.stringify(arguments);
  }

  private computeAuthorityCacheKey(ref: URI) {
    // don't include the fragment on authority cache key
    return ref.with({ fragment: '' }).toString(true);
  }
}
