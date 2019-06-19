import { isAbsolute, normalize } from '../path';

describe('Path utils', () => {
  describe('isAbsolute fn', () => {
    test.each([
      'c:\\foo\\bar.json',
      'c:\\',
      'c:/',
      'c:/foo/bar.json',
      '/home/test',
      '/',
      '/var/lib/test/',
      '/var/bin.d',
    ])('should treat %s path as absolute', filepath => {
      expect(isAbsolute(filepath)).toBe(true);
    });
  });

  test.each(['\\foo\\bar.json', 'foo/bar', 'test'])('should treat %s path as non-absolute', filepath => {
    expect(isAbsolute(filepath)).toBe(false);
  });

  describe('normalize fn', () => {
    test('should replace windows-like slashes with POSIX-compatible ones', () => {
      expect(normalize('c:\\foo\\bar')).toEqual('c:/foo/bar');
    });

    test('should ignore POSIX slashes', () => {
      expect(normalize('/d/foo')).toEqual('/d/foo');
    });
  });
});
