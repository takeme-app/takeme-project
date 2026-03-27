-- Corrige trigger handle_new_user para não derrubar auth.signUp quando o
-- telefone já existe em profiles (profiles_phone_key unique constraint).
-- Antes: unique_violation propagava → "Database error saving new user".
-- Depois: insere sem telefone quando há conflito; o app faz profiles.update logo em seguida.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  raw_phone  text := coalesce(trim(new.raw_user_meta_data->>'phone'), '');
  norm_phone text := nullif(regexp_replace(raw_phone, '\D', '', 'g'), '');
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, updated_at)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    norm_phone,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = coalesce(excluded.full_name,  profiles.full_name),
    phone      = coalesce(excluded.phone,      profiles.phone),
    updated_at = now();

  RETURN new;

EXCEPTION
  WHEN unique_violation THEN
    -- Telefone já cadastrado: insere só com id + nome para não bloquear o signUp.
    -- O app chama profiles.update logo após o signUp e lida com o conflito de telefone lá.
    INSERT INTO public.profiles (id, full_name, updated_at)
    VALUES (new.id, new.raw_user_meta_data->>'full_name', now())
    ON CONFLICT (id) DO UPDATE SET
      full_name  = coalesce(excluded.full_name, profiles.full_name),
      updated_at = now();

    RETURN new;
END;
$$;
