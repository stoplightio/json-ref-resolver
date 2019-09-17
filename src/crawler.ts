import { pointerToPath } from '@stoplight/json';
import { DepGraph } from 'dependency-graph';
import { get } from 'lodash';

import * as Types from './types';
import * as Utils from './utils';

/** @hidden */
export class ResolveCrawler implements Types.ICrawler {
  public readonly resolvers: Array<Promise<Types.IUriResult>> = [];

  // jsonPointer = the jsonPointer the runner was originally called with
  // need to use this when calculating parentPath for lookupAndResolveAuthority
  // to properly calculate the resolve target
  public jsonPointer?: string;

  // @ts-ignore
  public readonly pointerGraph = new DepGraph<string>({ circular: true });

  // @ts-ignore
  public readonly pointerStemGraph = new DepGraph<string>({ circular: true });

  private _runner: Types.IResolveRunner;

  constructor(runner: Types.IResolveRunner, jsonPointer?: string) {
    this.jsonPointer = jsonPointer;
    this._runner = runner;
  }

  public computeGraph = (target: any, parentPath: string[] = [], parentPointer = '#', pointerStack: string[] = []) => {
    if (!parentPointer) parentPointer = '#';

    let ref = this._runner.computeRef({
      val: target,
      jsonPointer: parentPointer,
      pointerStack,
    });

    /**
     * Is this entire target something that we want to resolve? For example:
     *
     * target = {
     *   "$ref": "#/hi"
     * }
     */
    if (ref) {
      this._resolveRef({
        ref,
        val: target,
        parentPath,
        pointerStack,
        parentPointer,
        cacheKey: parentPointer,
        resolvingPointer: this.jsonPointer,
      });
    } else if (typeof target === 'object') {
      for (const key in target) {
        if (!target.hasOwnProperty(key)) continue;

        const val = target[key];
        const currentPointer = Utils.addToJSONPointer(parentPointer, key);

        ref = this._runner.computeRef({
          key,
          val,
          jsonPointer: currentPointer,
          pointerStack,
        });

        parentPath.push(key);

        // if this value a ref, resolve and continue on to the next property
        if (ref) {
          this._resolveRef({
            ref,
            val,
            parentPath,
            parentPointer: currentPointer,
            pointerStack,
            cacheKey: Utils.uriToJSONPointer(ref),
            resolvingPointer: this.jsonPointer,
          });
        } else if (typeof val === 'object') {
          // recurse into the object
          this.computeGraph(val, parentPath, currentPointer, pointerStack);
        }

        parentPath.pop();
      }
    }
  };

  private _resolveRef = (opts: Types.IRefHandlerOpts) => {
    const { pointerStack, parentPath, parentPointer, ref } = opts;

    // local pointer
    if (Utils.uriIsJSONPointer(ref)) {
      if (this._runner.dereferenceInline) {
        const targetPointer = Utils.uriToJSONPointer(ref);
        const targetPath = pointerToPath(targetPointer);

        /**
         * Protects against circular references back to something higher up in the tree
         * Will stop #/definitions/columns/rows -> #/definitions/columns
         */
        let referencesParent = true;
        for (const i in targetPath) {
          if (parentPath[i] !== targetPath[i]) {
            referencesParent = false;
            break;
          }
        }
        if (referencesParent) return;

        // pointerStemGraph tracks all of the stem dependency and is used later
        // in the runner to protect against circular refs in the final JS object
        if (!this.pointerStemGraph.hasNode(targetPointer)) {
          this.pointerStemGraph.addNode(targetPointer);
        }

        let stem = '#';
        let tail = '';
        for (let i = 0; i < parentPath.length; i++) {
          const part = parentPath[i];
          if (part === targetPath[i]) {
            stem += `/${part}`;
          } else {
            tail += `/${part}`;
            const dep = `${stem}${tail}`;
            if (dep !== parentPointer && dep !== targetPointer) {
              if (!this.pointerStemGraph.hasNode(dep)) {
                this.pointerStemGraph.addNode(dep);
              }

              this.pointerStemGraph.addDependency(dep, targetPointer);
            }
          }
        }

        if (!this.pointerGraph.hasNode(parentPointer)) {
          this.pointerGraph.addNode(parentPointer);
        }

        if (!this.pointerGraph.hasNode(targetPointer)) {
          this.pointerGraph.addNode(targetPointer);
        }

        const srn = `${this._runner.baseUri.toString()}${targetPointer}`;
        if (!this._runner.graph.hasNode(srn)) this._runner.graph.addNode(srn);
        if (this._runner.root !== srn) this._runner.graph.addDependency(this._runner.root, srn);

        // register parent as a dependant of the target
        this.pointerGraph.addDependency(parentPointer, targetPointer);

        // if we are partially resolving, we need to follow refs (since they might point outside of our initial target object tree)
        // only need to initiate when top of pointer stack
        if (this.jsonPointer) {
          pointerStack.push(targetPointer);

          // if we are partially resolving
          this.computeGraph(get(this._runner.source, targetPath), targetPath as string[], targetPointer, pointerStack);

          pointerStack.pop();
        }
      }
    } else {
      // remote pointer
      const srn = ((ref.query(true) as unknown) as { srn: string }).srn;
      if (!this._runner.graph.hasNode(srn)) this._runner.graph.addNode(srn);
      if (this._runner.root !== srn) this._runner.graph.addDependency(this._runner.root, srn);

      if (this._runner.dereferenceRemote && !this._runner.atMaxUriDepth()) {
        this.resolvers.push(this._runner.lookupAndResolveUri(opts));
      }
    }
  };
}
