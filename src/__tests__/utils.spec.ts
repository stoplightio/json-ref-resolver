import * as Utils from '../utils';

describe('utils', () => {
  test('jsonPointerToPath', () => {
    expect(Utils.jsonPointerToPath('#/foo')).toEqual(['foo']);
    expect(Utils.jsonPointerToPath('#/foo/bar')).toEqual(['foo', 'bar']);
    expect(Utils.jsonPointerToPath('#/0')).toEqual(['0']);
    expect(Utils.jsonPointerToPath('#/paths/~1users')).toEqual(['paths', '/users']);
    expect(Utils.jsonPointerToPath('#/paths/foo~0users')).toEqual(['paths', 'foo~users']);
    expect(Utils.jsonPointerToPath('#')).toEqual([]);
    expect(Utils.jsonPointerToPath('#/')).toEqual(['']);
  });

  test('pathToJSONPointer', () => {
    expect(Utils.pathToJSONPointer(['foo'])).toEqual('#/foo');
    expect(Utils.pathToJSONPointer(['foo', 'bar'])).toEqual('#/foo/bar');
    expect(Utils.pathToJSONPointer(['0'])).toEqual('#/0');
    expect(Utils.pathToJSONPointer(['paths', '/users'])).toEqual('#/paths/~1users');
    expect(Utils.pathToJSONPointer(['paths', 'foo~users'])).toEqual('#/paths/foo~0users');
    expect(Utils.pathToJSONPointer([])).toEqual('#');
    expect(Utils.pathToJSONPointer([''])).toEqual('#/');
  });
});
