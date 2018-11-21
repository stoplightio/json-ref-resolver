const replace = (str: string, find: string, repl: string): string => {
  // modified from http://jsperf.com/javascript-replace-all/10
  const orig = str.toString();
  let res = '';
  let rem = orig;
  let beg = 0;
  let end = rem.indexOf(find);

  while (end > -1) {
    res += orig.substring(beg, beg + end) + repl;
    rem = rem.substring(end + find.length, rem.length);
    beg += end + find.length;
    end = rem.indexOf(find);
  }

  if (rem.length > 0) {
    res += orig.substring(orig.length - rem.length, orig.length);
  }

  return res;
};

const encodeFragmentSegment = (segment: string): string => {
  if (typeof segment === 'string') {
    return replace(replace(segment, '~', '~0'), '/', '~1');
  }

  return segment;
};

// TODO: move to @stoplight/json
/** @hidden */
export const addToJSONPointer = (pointer: string, part: string): string => {
  return `${pointer}/${encodeFragmentSegment(part)}`;
};

/** @hidden */
export const uriToJSONPointer = (uri: uri.URI): string => {
  return uri && uri.fragment() ? `#${uri.fragment()}` : '';
};

/** @hidden */
export const uriIsJSONPointer = (ref: uri.URI): boolean => {
  return ref.toString().slice(0, 2) === '#/';
};
