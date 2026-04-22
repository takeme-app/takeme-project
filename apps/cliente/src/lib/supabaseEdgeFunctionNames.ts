/**
 * Slug em `/functions/v1/<slug>` — alinhado a `supabase/config.toml` e pasta `supabase/functions/charge-shipment/`.
 * Se o projeto remoto usar outro nome, ajuste e faça deploy com o mesmo slug.
 */
export const EDGE_CHARGE_SHIPMENT_SLUG = 'charge-shipment' as const;
