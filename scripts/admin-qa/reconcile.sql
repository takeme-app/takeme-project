-- Reconciliação rápida Admin Take Me (executar no SQL Editor ou via MCP execute_sql)
-- Projeto: xdxzxyzdgwpucwuaxvik

SELECT 'scheduled_trips' AS t, status, COUNT(*)::int AS n FROM public.scheduled_trips GROUP BY 1, 2 ORDER BY 2;
SELECT 'bookings' AS t, status, COUNT(*)::int AS n FROM public.bookings GROUP BY 1, 2 ORDER BY 2;
SELECT 'shipments' AS t, status, COUNT(*)::int AS n FROM public.shipments GROUP BY 1, 2 ORDER BY 2;
SELECT 'promotions' AS t, CASE WHEN is_active THEN 'active' ELSE 'inactive' END AS status, COUNT(*)::int AS n FROM public.promotions GROUP BY 1, 2 ORDER BY 2;
SELECT 'payouts' AS t, status, COUNT(*)::int AS n FROM public.payouts GROUP BY 1, 2 ORDER BY 2;
SELECT 'conversations' AS t, COALESCE(status, 'null') AS status, COUNT(*)::int AS n FROM public.conversations GROUP BY 1, 2 ORDER BY 2;

-- Limpeza dados QA (opcional)
-- DELETE FROM public.promotions WHERE title LIKE '[QA-TEST]%';
-- DELETE FROM public.conversations WHERE participant_name LIKE '[QA-TEST]%';
