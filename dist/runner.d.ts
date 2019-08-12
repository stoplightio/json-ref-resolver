/// <reference types="urijs" />
import * as Types from './types';
export declare const defaultGetRef: (key: string, val: any) => any;
export declare class ResolveRunner implements Types.IResolveRunner {
    readonly id: number;
    readonly baseUri: uri.URI;
    readonly uriCache: Types.ICache;
    depth: number;
    uriStack: string[];
    readonly dereferenceInline: boolean;
    readonly dereferenceRemote: boolean;
    ctx: any;
    readonly resolvers: {
        [scheme: string]: Types.IResolver;
    };
    readonly getRef: (key: string, val: any) => string | void;
    readonly transformRef?: (opts: Types.IRefTransformer, ctx: any) => uri.URI | any;
    readonly parseResolveResult?: (opts: Types.IUriParser) => Promise<Types.IUriParserResult>;
    readonly transformDereferenceResult?: (opts: Types.IDereferenceTransformer) => Promise<Types.ITransformerResult>;
    private _source;
    constructor(source: any, opts?: Types.IResolveRunnerOpts);
    readonly source: any;
    resolve(jsonPointer?: string, opts?: Types.IResolveOpts): Promise<Types.IResolveResult>;
    computeRef: (opts: Types.IComputeRefOpts) => void | uri.URI;
    atMaxUriDepth: () => boolean;
    lookupUri: (opts: {
        fragment: string;
        ref: uri.URI;
        cacheKey: string;
        parentPath: string[];
    }) => Promise<ResolveRunner>;
    lookupAndResolveUri: (opts: Types.IRefHandlerOpts) => Promise<Types.IUriResult>;
    _cacheKeySerializer(sOpts: any): any;
    private computeUriCacheKey;
    private isFile;
}
