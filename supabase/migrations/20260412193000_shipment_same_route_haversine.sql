-- Mesma rota: tolerância em metros (geocodificação cliente vs viagem no BD).
-- Alinha com apps/cliente/src/lib/routeCoordsMatch.ts (1500 m por extremo).

CREATE OR REPLACE FUNCTION public.shipment_same_route_as_trip(
  s_origin_lat double precision,
  s_origin_lng double precision,
  s_dest_lat double precision,
  s_dest_lng double precision,
  t_origin_lat double precision,
  t_origin_lng double precision,
  t_dest_lat double precision,
  t_dest_lng double precision
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    (
      6371000::double precision * 2::double precision * asin(
        sqrt(
          least(
            1::double precision,
            greatest(
              0::double precision,
              power(sin((radians(t_origin_lat) - radians(s_origin_lat)) / 2::double precision), 2::double precision)
              + cos(radians(s_origin_lat)) * cos(radians(t_origin_lat)) * power(
                sin((radians(t_origin_lng) - radians(s_origin_lng)) / 2::double precision),
                2::double precision
              )
            )
          )
        )
      )
    ) < 1500::double precision
    AND (
      6371000::double precision * 2::double precision * asin(
        sqrt(
          least(
            1::double precision,
            greatest(
              0::double precision,
              power(sin((radians(t_dest_lat) - radians(s_dest_lat)) / 2::double precision), 2::double precision)
              + cos(radians(s_dest_lat)) * cos(radians(t_dest_lat)) * power(
                sin((radians(t_dest_lng) - radians(s_dest_lng)) / 2::double precision),
                2::double precision
              )
            )
          )
        )
      )
    ) < 1500::double precision;
$$;

COMMENT ON FUNCTION public.shipment_same_route_as_trip(
  double precision, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision
) IS 'Origem e destino do envio a até 1500 m dos pontos da viagem (haversine).';
