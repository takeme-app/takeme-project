-- Incluir tipos usados pelo app motorista / ensure_dependent_trip_stops.
-- O CHECK legado (create_trip_stops_and_routing) só permitia shipment_* sem dependent_* nem package_*.

ALTER TABLE public.trip_stops
  DROP CONSTRAINT IF EXISTS trip_stops_stop_type_check;

ALTER TABLE public.trip_stops
  ADD CONSTRAINT trip_stops_stop_type_check
  CHECK (
    lower(trim(stop_type)) = ANY (
      ARRAY[
        'driver_origin',
        'passenger_pickup',
        'passenger_dropoff',
        'dependent_pickup',
        'dependent_dropoff',
        'shipment_pickup',
        'shipment_dropoff',
        'package_pickup',
        'package_dropoff',
        'base_dropoff',
        'trip_destination',
        'excursion_stop'
      ]
    )
  );

COMMENT ON CONSTRAINT trip_stops_stop_type_check ON public.trip_stops IS
  'Tipos de parada: inclui dependent_* e package_* além de shipment_* / passageiro / destino.';
