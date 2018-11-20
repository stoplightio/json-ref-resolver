import * as Types from './types';

/** @hidden */
export class Cache implements Types.ICache {
  public debug = false;

  private _stats: {
    hits: number;
    misses: number;
  } = {
    hits: 0,
    misses: 0,
  };

  // TODO: enforce these
  // private _size = 0;
  private readonly _stdTTL: number | undefined;
  // private readonly _errTTL = 0;

  private _data: {
    [key: string]: {
      ts: number;
      val: any;
    };
  } = {};

  constructor(opts: Types.ICacheOpts = {}) {
    this._stdTTL = opts.stdTTL;
  }

  public get stats() {
    return this._stats;
  }

  public get(key: string) {
    const d = this._data[key];

    // if we have a value and it is fresh, use it
    if (d && (!this._stdTTL || new Date().getTime() - d.ts < this._stdTTL)) {
      this._stats.hits += 1;
      if (this.debug) {
        console.log('cache.get.hit', { key, val: d });
      }

      return d.val;
    }

    this._stats.misses += 1;
    if (this.debug) {
      console.log('cache.get.miss', { key });
    }
  }

  public set(key: string, val: any) {
    if (this.debug) {
      console.log('cache.set', { key, val });
    }

    this._data[key] = {
      ts: new Date().getTime(),
      val,
    };
  }

  public has(key: string): boolean {
    return key in this._data;
  }
}
