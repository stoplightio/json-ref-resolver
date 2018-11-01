import fastStringify from '@stoplight/fast-safe-stringify';

const _get = require('lodash/get');
const _set = require('lodash/set');
const _trimStart = require('lodash/trimStart');

export const stringify = (target: any, replacer?: (key: any, value: any) => any, offset?: number) => {
  if (!target || typeof target === 'string') return target;

  try {
    // try regular stringify first as mentioned in this tip: https://github.com/davidmarkclements/fast-safe-stringify#protip
    return JSON.stringify(target, replacer, offset);
  } catch (_) {
    // @ts-ignore
    return fastStringify(target, replacer, offset);
  }
};

export const parse = (target: string): any => {
  if (typeof target !== 'string') return target;
  return JSON.parse(target);
};

export const getValue = (obj: any, path: string | string[], defaultVal?: any): any => {
  return _get(obj, path, defaultVal);
};

export const setValue = (obj: any, path: string | string[], value: any): any => {
  return _set(obj, path, value);
};

export const startsWith = (source: any[] | string, val: any[] | string): boolean => {
  if (source instanceof Array) {
    if (val instanceof Array) {
      if (val.length > source.length) return false;

      for (const i in val) {
        if (!val.hasOwnProperty(i)) continue;

        const si = parseInt(source[i]);
        const vi = parseInt(val[i]);

        // support if numeric index is stringified in one but not the other
        if (!isNaN(si) || !isNaN(vi)) {
          if (si !== vi) {
            return false;
          }
        } else if (source[i] !== val[i]) {
          return false;
        }
      }
    }
  } else if (typeof source === 'string') {
    if (typeof val === 'string') {
      return source.startsWith(val);
    }
  } else {
    return false;
  }

  return true;
};

/**
 * Removes elems from target, matched in order, starting on the left
 * trimStart([1, 2, 3], [1, 2]) === [3]
 * trimStart([1, 2, 3], [999, 2]) === [1, 2, 3] since source[0] does not equal elems[0]
 */
export const trimStart = (target: any[] | string, elems: any[] | string) => {
  if (typeof target === 'string') {
    return _trimStart(target, elems);
  }

  if (!elems || !elems.length || !(elems instanceof Array)) return target;

  let toRemove = 0;
  for (const i in target) {
    if (!target.hasOwnProperty(i)) continue;
    if (target[i] !== elems[i]) break;
    toRemove++;
  }

  return target.slice(toRemove);
};
