import * as path from 'path';
import * as URI from 'urijs';
import { URI as VSURI } from 'vscode-uri';

export const isAbsolute = (filepath: string) => path.isAbsolute(filepath) || new URI(filepath).is('absolute');

export const join = (...parts: string[]) => parts.join('/');
export const normalize = (filepath: string) => path.normalize(filepath).replace(/\\/g, '/');

export function toFSPath(uri: string) {
  return path.normalize(VSURI.file(uri).fsPath);
}
