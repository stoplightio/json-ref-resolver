import { DepGraph } from 'dependency-graph';
import * as treeify from 'treeify';

import { Cache } from './cache';
import { ResolveRunner } from './runner';
import * as Types from './types';

export interface IEdge {
  source: INode;
  target: INode;
}

interface INode {
  name: string;
  children: INode[];
  incomingEdges: IEdge[];
  outgoingEdges: IEdge[];
}

/**
 * This is the primary class.
 *
 * See IResolverOptions for available options that you can pass in.
 */
export class Resolver {
  public readonly uriCache: Types.ICache;
  public readonly graph: DepGraph<string>;

  protected dereferenceInline: boolean;
  protected dereferenceRemote: boolean;
  protected ctx: any = {};
  protected resolvers: {
    [scheme: string]: Types.IResolver;
  };

  protected getRef?: (key: string, val: any) => string | void;
  protected transformRef?: (opts: Types.IRefTransformer, ctx: any) => uri.URI | any;
  protected parseResolveResult?: (opts: Types.IUriParser) => Promise<Types.IUriParserResult>;
  protected transformDereferenceResult?: (opts: Types.IDereferenceTransformer) => Promise<Types.ITransformerResult>;

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
    this.graph = new DepGraph<string>({ circular: true });
  }

  public printRefTree(node: string) {
    const nodes = [];
    const root = {
      name: node,
      children: [],
      outgoingEdges: [],
      incomingEdges: [],
    };
    const nodeMap: {
      [key: string]: INode;
    } = {
      [node]: root,
    };

    for (const name of this.graph.overallOrder()) {
      let n = nodeMap[name];
      if (!n) {
        n = {
          name,
          children: [],
          outgoingEdges: [],
          incomingEdges: [],
        };

        nodeMap[name] = n;
      }

      // @ts-ignore
      if (this.graph.incomingEdges[n.name]) {
        // @ts-ignore
        for (const incoming of this.graph.incomingEdges[n.name]) {
          let source = nodeMap[incoming];
          if (!source) {
            source = {
              name: incoming,
              children: [],
              outgoingEdges: [],
              incomingEdges: [],
            };

            nodeMap[incoming] = source;
          }

          const edge = {
            source,
            target: n,
          };

          n.incomingEdges.push(edge);
        }
      }

      // @ts-ignore
      if (this.graph.outgoingEdges[n.name]) {
        // @ts-ignore
        for (const outgoing of this.graph.outgoingEdges[n.name]) {
          let target = nodeMap[outgoing];
          if (!target) {
            target = {
              name: outgoing,
              children: [],
              outgoingEdges: [],
              incomingEdges: [],
            };
            nodeMap[outgoing] = target;
          }

          const edge = {
            target,
            source: n,
          };

          n.children.push(target);
          n.outgoingEdges.push(edge);
        }
      }

      nodes.push(n);
    }

    return printTree(root);
  }

  public resolve(source: any, opts: Types.IResolveOpts = {}): Promise<Types.IResolveResult> {
    const runner = new ResolveRunner(source, {
      uriCache: this.uriCache,
      resolvers: this.resolvers,
      graph: this.graph,
      getRef: this.getRef,
      transformRef: this.transformRef,
      dereferenceInline: this.dereferenceInline,
      dereferenceRemote: this.dereferenceRemote,
      parseResolveResult: this.parseResolveResult,
      transformDereferenceResult: this.transformDereferenceResult,
      ...opts,
      ctx: Object.assign({}, this.ctx || {}, opts.ctx || {}),
    });

    return runner.resolve(opts);
  }
}

const printTree = (nodes: INode[] | INode) => {
  return treeify.asTree(nodeTree(nodes), false, false);
};

const nodeTree = (nodes: INode[] | INode) => {
  const tree: treeify.TreeObject = {};
  nodes = Array.isArray(nodes) ? nodes : [nodes];

  for (const node of nodes) {
    const children = node.children;
    const incomingEdges = node.incomingEdges;
    const outgoingEdges = node.outgoingEdges;

    let subtree: treeify.TreeObject = {};
    if (children && children.length) {
      subtree = nodeTree(children);
    }

    if (incomingEdges && incomingEdges.length) {
      subtree.incomingEdges = {};
      incomingEdges.forEach(edge => {
        // Always format edge URIs as relative to remove /Users/me/dir/stoplight/graphite from path
        subtree.incomingEdges[edge.source.name] = '';
      });
    }

    if (outgoingEdges && outgoingEdges.length) {
      subtree.outgoingEdges = {};
      outgoingEdges.forEach(edge => {
        // Always format edge URIs as relative to remove /Users/me/dir/stoplight/graphite from path
        subtree.outgoingEdges[edge.target.name] = '';
      });
    }

    tree[node.name] = Object.keys(subtree).length ? subtree : '';
  }

  return tree;
};
