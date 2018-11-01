import * as URI from 'urijs';

import { uriIsJSONPointer, uriToJSONPointer } from '../utils';

describe('uri', () => {
  test('toString()', () => {
    expect(new URI('#/foo').toString()).toEqual('#/foo');
    expect(new URI('http://foo.com?foo=bar#/foo').toString()).toEqual('http://foo.com/?foo=bar#/foo');
    expect(uriToJSONPointer(new URI('http://foo.com?foo=bar#/foo'))).toEqual('#/foo');
    expect(URI.parse('http://foo.com/foo/bar?foo=bar#/fee')).toEqual({
      protocol: 'http',
      username: null,
      password: null,
      hostname: 'foo.com',
      port: null,
      path: '/foo/bar',
      query: 'foo=bar',
      fragment: '/fee',
      preventInvalidHostname: false,
    });
  });

  test('mailto scheme', () => {
    expect(new URI('mailto:foo@example.com').toString()).toEqual('mailto:foo@example.com');
    expect(URI.parse('mailto:foo@example.com')).toEqual({
      path: 'foo@example.com',
      protocol: 'mailto',
      urn: true,
      preventInvalidHostname: false,
    });
  });

  test('file', () => {
    expect(URI.parse('/foo/bar/file.md')).toEqual({
      path: '/foo/bar/file.md',
      preventInvalidHostname: false,
    });

    // normalizing paths
    expect(URI.parse(new URI('/foo/bar/../file.md').normalize().toString())).toEqual({
      path: '/foo/file.md',
      preventInvalidHostname: false,
    });
  });

  test('is', () => {
    expect(new URI('/foo/bar').is('relative')).toBe(true);
    expect(new URI('/foo/bar').is('absolute')).toBe(false);
    expect(new URI('/foo/bar').is('urn')).toBe(false);
    expect(new URI('file:foo/bar').is('urn')).toBe(true);
  });

  test('side effects', () => {
    const x = new URI('http://foo.com?foo=bar#/foo');
    const y = x.clone().fragment('');
    expect(x.toString()).toBe('http://foo.com/?foo=bar#/foo');
    expect(y.toString()).toBe('http://foo.com/?foo=bar');
  });

  test('uriIsJSONPointer()', () => {
    expect(uriIsJSONPointer(new URI('#/foo'))).toBe(true);
    expect(uriIsJSONPointer(new URI('http://foo.com?foo=bar#/foo'))).toBe(false);
  });
});
