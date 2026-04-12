/**
 * Slugs em `/functions/v1/<slug>` devem coincidir com o deploy no Supabase.
 * O projeto remoto (via MCP) publicou `charge-shipments`; o código-fonte no repo fica em `supabase/functions/charge-shipment/`.
 * Se você republicar com `supabase functions deploy charge-shipment`, altere aqui para `charge-shipment`.
 */
export const EDGE_CHARGE_SHIPMENT_SLUG = 'charge-shipments' as const;
