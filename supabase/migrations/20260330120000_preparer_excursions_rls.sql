-- Preparador de excursões: ver/atualizar pedidos atribuídos e gerir passageiros.
-- Perfis de clientes só quando há excursão atribuída ao preparador (ex.: WhatsApp).

-- ---------------------------------------------------------------------------
-- excursion_requests
-- ---------------------------------------------------------------------------
CREATE POLICY "preparers_can_view_assigned_excursion_requests"
  ON public.excursion_requests FOR SELECT
  USING (preparer_id = auth.uid());

CREATE POLICY "preparers_can_update_assigned_excursion_requests"
  ON public.excursion_requests FOR UPDATE
  USING (preparer_id = auth.uid())
  WITH CHECK (preparer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- excursion_passengers (pedido atribuído ao preparador)
-- ---------------------------------------------------------------------------
CREATE POLICY "preparers_can_view_excursion_passengers"
  ON public.excursion_passengers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.excursion_requests er
      WHERE er.id = excursion_passengers.excursion_request_id
        AND er.preparer_id = auth.uid()
    )
  );

CREATE POLICY "preparers_can_insert_excursion_passengers"
  ON public.excursion_passengers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.excursion_requests er
      WHERE er.id = excursion_passengers.excursion_request_id
        AND er.preparer_id = auth.uid()
    )
  );

CREATE POLICY "preparers_can_update_excursion_passengers"
  ON public.excursion_passengers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.excursion_requests er
      WHERE er.id = excursion_passengers.excursion_request_id
        AND er.preparer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.excursion_requests er
      WHERE er.id = excursion_passengers.excursion_request_id
        AND er.preparer_id = auth.uid()
    )
  );

CREATE POLICY "preparers_can_delete_excursion_passengers"
  ON public.excursion_passengers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.excursion_requests er
      WHERE er.id = excursion_passengers.excursion_request_id
        AND er.preparer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- profiles: telefone/nome do cliente para excursões atribuídas
-- ---------------------------------------------------------------------------
CREATE POLICY "preparers_can_view_client_profiles_for_assigned_excursions"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.excursion_requests er
      WHERE er.user_id = profiles.id
        AND er.preparer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Justificativa de ausência no embarque
-- ---------------------------------------------------------------------------
ALTER TABLE public.excursion_passengers
  ADD COLUMN IF NOT EXISTS absence_justified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.excursion_passengers.absence_justified IS
  'Quando true, ausente no embarque foi justificado pelo preparador.';
