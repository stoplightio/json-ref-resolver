import * as BaseURI from 'urijs';

export class ExtendedURI extends BaseURI {
  constructor(private readonly _value: string) {
    super(_value);
  }

  public get length() {
    return this._value.length;
  }
}
