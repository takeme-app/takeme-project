# Edge functions — um arquivo para colar no painel

O código do token HMAC está **dentro** de cada `index.ts`:

- `verify-email-code/index.ts`
- `create-motorista-account/index.ts`

Copie o **conteúdo inteiro** do `index.ts` da função e cole no editor da edge no Supabase (um arquivo só).

Se alterar a lógica do token, atualize **os dois** `index.ts` (trecho entre `// --- Token HMAC` e `// --- fim token`).
