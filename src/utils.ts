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

const decodeFragmentSegments = (segments: string[]): string[] => {
  const len = segments.length;
  const res = new Array(len);
  let i = -1;

  while (++i < len) {
    res[i] = replace(replace(decodeURIComponent('' + segments[i]), '~1', '/'), '~0', '~');
  }

  return res;
};

const decodeUriFragmentIdentifier = (ptr: string): string[] => {
  if (typeof ptr !== 'string') {
    throw new TypeError('Invalid type: JSON Pointers are represented as strings.');
  }

  if (ptr.length === 0 || ptr[0] !== '#') {
    throw new ReferenceError(
      'Invalid JSON Pointer syntax; URI fragment idetifiers must begin with a hash.'
    );
  }

  if (ptr.length === 1) {
    return [];
  }

  if (ptr[1] !== '/') {
    throw new ReferenceError('Invalid JSON Pointer syntax.');
  }

  return decodeFragmentSegments(ptr.substring(2).split('/'));
};

const encodeFragmentSegment = (segment: string): string => {
  if (typeof segment === 'string') {
    return replace(replace(segment, '~', '~0'), '/', '~1');
  }

  return segment;
};

const encodeFragmentSegments = (segments: string[]): string[] => {
  return segments.map(encodeFragmentSegment);
};

const encodeUriFragmentIdentifier = (path: string[]): string => {
  if (path && typeof path !== 'object') {
    throw new TypeError('Invalid type: path must be an array of segments.');
  }

  if (path.length === 0) {
    return '#';
  }

  return `#/${encodeFragmentSegments(path).join('/')}`;
};

export const jsonPointerToPath = (pointer: string): string[] => {
  return decodeUriFragmentIdentifier(pointer);
};

export const pathToJSONPointer = (path: string[]): string => {
  return encodeUriFragmentIdentifier(path);
};

export const addToJSONPointer = (pointer: string, part: string): string => {
  return `${pointer}/${encodeFragmentSegment(part)}`;
};

export const uriToJSONPointer = (uri: uri.URI): string => {
  return uri && uri.fragment() ? `#${uri.fragment()}` : '';
};

export const uriIsJSONPointer = (ref: uri.URI): boolean => {
  return ref.toString().slice(0, 2) === '#/';
};
