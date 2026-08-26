-- ============================================================
-- BizdenBize — Etkinlik sahibinin kendi etkinliğini düzenlemesi
--
-- DURUM: events tablosunda DELETE için events_delete_own_or_admin var,
-- ama UPDATE için yalnızca events_update_admin vardı. Yani üye kendi
-- etkinliğini SİLEBİLİYOR ama DÜZENLEYEMİYORDU.
--
-- GÜVENLİK: WITH CHECK, düzenlenen satırın status'ünü 'pending'e
-- zorlar. Böylece bir üye zararsız bir etkinliği onaylatıp sonra
-- içeriğini değiştiremez — her düzenleme yeniden onaya düşer.
-- created_by de değiştirilemez (sahiplik devri engellenir).
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS events_update_own ON public.events;

CREATE POLICY events_update_own
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
  )
  WITH CHECK (
    auth.uid() = created_by
    AND status = 'pending'
  );

COMMIT;
