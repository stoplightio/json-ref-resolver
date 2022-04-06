import * as BaseURI from 'urijs';

export class ExtendedURI extends BaseURI {
  private readonly _value: string;
  constructor(_value: string) {
    super(_value);
    this._value = _value.trim();
  }

  public get length() {
    return this._value.length;
  }
}
