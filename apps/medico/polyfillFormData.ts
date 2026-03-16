/**
 * Primeiro módulo carregado — garante FormData no global (Hermes em monorepo).
 */
const g = typeof globalThis !== 'undefined' ? globalThis : (typeof global !== 'undefined' ? global : (typeof self !== 'undefined' ? self : {}));
if (typeof (g as any).FormData === 'undefined') {
  (g as any).FormData = class FormData {
    _entries: Array<{ name: string; value: unknown; filename?: string }> = [];
    append(name: string, value: unknown, filename?: string) {
      this._entries.push({ name, value, filename });
    }
  };
}
