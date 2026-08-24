-- ============================================================
-- BizdenBize — AbiBOT Adım 1 / Step 1
-- Günlük soru limitini SUNUCU tarafında, atomik olarak uygular.
--
-- NEDEN: Limit şimdiye kadar tarayıcıda sayılıyordu. Kullanıcı
-- güncellemeyi atlayabiliyor veya sıfırlayabiliyordu. Ayrıca
-- "oku → hesapla → yaz" deseni iki sekmede yarış durumuna açıktı.
--
-- Bu fonksiyon satırı FOR UPDATE ile kilitler, bu yüzden aynı anda
-- gelen iki istek aynı hakkı iki kez harcayamaz.
--
-- Sadece service_role çağırabilir (yani yalnızca Edge Function).
-- Üye kendi tarayıcısından bunu çağıramaz.
-- ============================================================

BEGIN;

-- Imza degisti (p_consume eklendi). Eski surumu birakirsak PostgREST
-- iki overload arasinda kalir; onun icin once dusuruyoruz.
DROP FUNCTION IF EXISTS public.abibot_consume_prompt(uuid);
DROP FUNCTION IF EXISTS public.abibot_consume_prompt(uuid, boolean);

-- p_consume = false  -> sadece BAKAR (hak harcamaz)
-- p_consume = true   -> hakki HARCAR
-- Boylece kapsam disi sorular uyenin hakkindan dusmez.
CREATE FUNCTION public.abibot_consume_prompt(p_user uuid, p_consume boolean DEFAULT true)
RETURNS TABLE (
  allowed     boolean,
  used        integer,
  day_limit   integer,
  is_premium  boolean,
  user_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today  date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_used   integer;
  v_reset  date;
  v_prem   boolean;
  v_status text;
  v_limit  integer;
BEGIN
  SELECT p.daily_prompts_used,
         p.daily_prompts_reset_at::date,
         COALESCE(p.is_premium, false),
         p.status
    INTO v_used, v_reset, v_prem, v_status
    FROM public.profiles p
   WHERE p.id = p_user
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, false, 'missing'::text;
    RETURN;
  END IF;

  -- Onaylanmamış üye hiç hak harcamaz — sadece reddedilir.
  IF v_status IS DISTINCT FROM 'approved' THEN
    RETURN QUERY SELECT false, COALESCE(v_used, 0), 0, v_prem, v_status;
    RETURN;
  END IF;

  v_limit := CASE WHEN v_prem THEN 10 ELSE 2 END;

  -- Yeni gün: sayaç sıfırlanır.
  IF v_reset IS DISTINCT FROM v_today THEN
    v_used := 0;
  END IF;

  v_used := COALESCE(v_used, 0);

  IF v_used >= v_limit THEN
    UPDATE public.profiles
       SET daily_prompts_used     = v_used,
           daily_prompts_reset_at = v_today
     WHERE id = p_user;
    RETURN QUERY SELECT false, v_used, v_limit, v_prem, v_status;
    RETURN;
  END IF;

  -- Sadece bakiliyorsa yazma.
  IF NOT p_consume THEN
    RETURN QUERY SELECT true, v_used, v_limit, v_prem, v_status;
    RETURN;
  END IF;

  UPDATE public.profiles
     SET daily_prompts_used     = v_used + 1,
         daily_prompts_reset_at = v_today
   WHERE id = p_user;

  RETURN QUERY SELECT true, v_used + 1, v_limit, v_prem, v_status;
END;
$$;

-- Tarayıcıdan çağrılamasın: sadece service_role (Edge Function).
REVOKE ALL ON FUNCTION public.abibot_consume_prompt(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.abibot_consume_prompt(uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.abibot_consume_prompt(uuid, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.abibot_consume_prompt(uuid, boolean) TO service_role;

COMMIT;
