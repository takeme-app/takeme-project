-- CHECK de produção em worker_profiles.subtype:
--   ('takeme', 'partner', 'shipments', 'excursions')
-- O app motorista envia take_me | parceiro; a edge create-motorista-account mapeia para takeme | partner.
-- NÃO dropar worker_profiles_subtype_check aqui — outros subtipos (shipments, excursions) continuam válidos.
--
-- Se em algum ambiente foi criado worker_profiles_subtype_allowed (migration antiga conflitante), remove só esse nome.
alter table public.worker_profiles drop constraint if exists worker_profiles_subtype_allowed;
