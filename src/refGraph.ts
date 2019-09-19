import { DepGraph } from 'dependency-graph';
import * as treeify from 'treeify';

export interface INode<T> {
  id: string;
  data?: T;
}

export interface INodeTree<T> {
  node: INode<T>;
  children: { [id: string]: INodeTree<T> };
}

export class RefGraph<T> extends DepGraph<T> {
  /**
   * id of node
   * @param {string} id
   */
  public nodeTree(id: string): INodeTree<T> {
    return nodeTree(this, { id });
  }
  /**
   * id of node
   * @param {string} id
   */
  public nodeChildren(id: string): Array<INode<T>> {
    return nodeChildren(this, { id });
  }

  public serialize(id: string): string {
    return treeify.asTree(serialize(this, { id }), false, false);
  }
}

export const nodeChildren = <T>(graph: RefGraph<T>, node: INode<T>): Array<INode<T>> => {
  // @ts-ignore
  const edges = graph.outgoingEdges[node.id];
  if (!edges) return [];

  const children: Array<INode<T>> = [];
  for (const edge of edges) {
    const child: INode<T> = {
      id: edge,
      data: graph.getNodeData(edge),
    };

    children.push(child);
  }

  return children;
};

export const nodeTree = <T>(graph: RefGraph<T>, node: INode<T>): INodeTree<T> => {
  const tree: INodeTree<T> = {
    node,
    children: {},
  };

  for (const child of nodeChildren(graph, node)) {
    tree.children[child.id] = nodeTree(graph, child);
  }

  return tree;
};

export const serialize = <T>(graph: RefGraph<T>, ...nodes: Array<INode<T>>) => {
  const tree: treeify.TreeObject = {};

  for (const node of nodes) {
    const children = nodeChildren(graph, node);
    let subtree: treeify.TreeObject = {};
    if (children && children.length) {
      subtree = serialize(graph, ...children);
    }

    tree[node.id] = subtree;
  }

  return tree;
};
