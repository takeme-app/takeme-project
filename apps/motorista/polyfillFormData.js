/**
 * Polyfill FormData — sem imports, roda antes de qualquer outro módulo.
 * Hermes em monorepo não expõe FormData.
 */
var g = typeof globalThis !== 'undefined' ? globalThis : (typeof global !== 'undefined' ? global : (typeof self !== 'undefined' ? self : {}));
if (typeof g.FormData === 'undefined') {
  g.FormData = function FormData() {
    this._entries = [];
  };
  g.FormData.prototype.append = function (name, value, filename) {
    this._entries.push({ name: name, value: value, filename: filename });
  };
}
