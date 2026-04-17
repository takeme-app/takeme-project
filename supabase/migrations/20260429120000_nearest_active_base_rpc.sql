-- RPC usada pelo admin e pelo app motorista (ActiveShipmentScreen / cenário com base).
-- Retorna bases ativas ordenadas por distância aproximada (Haversine) até (p_lat, p_lng).

CREATE OR REPLACE FUNCTION public.nearest_active_base (p_lat double precision, p_lng double precision)
RETURNS SETOF public.bases
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT b.*
  FROM public.bases b
  WHERE
    b.is_active = true
    AND b.lat IS NOT NULL
    AND b.lng IS NOT NULL
    AND p_lat IS NOT NULL
    AND p_lng IS NOT NULL
  ORDER BY
    (
      6371000.0 * 2.0 * asin(
        least(
          1.0::double precision,
          sqrt(
            power(sin(radians((b.lat - p_lat) / 2.0)), 2)
            + cos(radians(p_lat)) * cos(radians(b.lat)) * power(sin(radians((b.lng - p_lng) / 2.0)), 2)
          )
        )
      )
    ) ASC
  LIMIT 10;
$$;

COMMENT ON FUNCTION public.nearest_active_base (double precision, double precision) IS
  'Bases ativas mais próximas de (p_lat, p_lng); primeira linha = mais próxima.';

REVOKE ALL ON FUNCTION public.nearest_active_base (double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nearest_active_base (double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nearest_active_base (double precision, double precision) TO service_role;
