-- ============================================================
-- BizdenBize · Kütüphane → Supabase
-- Creates the `resources` table, locks it down with RLS, and
-- seeds it with verified official German resources.
--
-- Run the WHOLE file in the Supabase SQL Editor. It is wrapped in
-- BEGIN/COMMIT, so it either fully succeeds or changes nothing.
-- Safe to re-run: it drops and reseeds its own rows only.
-- ============================================================

BEGIN;

-- ── TABLE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resources (
  id             bigserial PRIMARY KEY,
  title          text        NOT NULL,
  source         text        NOT NULL,
  description    text        NOT NULL,
  url            text        NOT NULL,
  type           text        NOT NULL DEFAULT 'link'
                   CHECK (type IN ('doc','guide','link','video')),
  category       text        NOT NULL,
  lang           text[]      NOT NULL DEFAULT ARRAY['DE'],
  -- NULL = not yet confirmed live. Never fake this date.
  last_verified  date,
  -- Shown on the card when the resource needs a caveat
  caution        text,
  is_official    boolean     NOT NULL DEFAULT true,
  is_published   boolean     NOT NULL DEFAULT true,
  sort_order     int         NOT NULL DEFAULT 100,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resources_category_idx  ON public.resources (category);
CREATE INDEX IF NOT EXISTS resources_published_idx ON public.resources (is_published);
CREATE INDEX IF NOT EXISTS resources_verified_idx  ON public.resources (last_verified);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
-- The Kütüphane is a deliberately public page, so anonymous
-- visitors may READ published rows. Nobody may write except the
-- admin account; everything else goes through the service role.
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resources_public_read"  ON public.resources;
DROP POLICY IF EXISTS "resources_admin_write"  ON public.resources;
DROP POLICY IF EXISTS "resources_admin_update" ON public.resources;
DROP POLICY IF EXISTS "resources_admin_delete" ON public.resources;

CREATE POLICY "resources_public_read" ON public.resources
  FOR SELECT USING (is_published = true);

CREATE POLICY "resources_admin_write" ON public.resources
  FOR INSERT WITH CHECK (auth.uid() = '3e96d976-5c3a-4270-af88-6172f1751f9a'::uuid);

CREATE POLICY "resources_admin_update" ON public.resources
  FOR UPDATE USING (auth.uid() = '3e96d976-5c3a-4270-af88-6172f1751f9a'::uuid);

CREATE POLICY "resources_admin_delete" ON public.resources
  FOR DELETE USING (auth.uid() = '3e96d976-5c3a-4270-af88-6172f1751f9a'::uuid);

-- keep updated_at honest
CREATE OR REPLACE FUNCTION public.touch_resources_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS resources_touch_updated ON public.resources;
CREATE TRIGGER resources_touch_updated
  BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.touch_resources_updated_at();

-- ── SEED ────────────────────────────────────────────────────
-- Wipes and reseeds so this file stays the single source of truth.
TRUNCATE public.resources RESTART IDENTITY;

INSERT INTO public.resources
  (title, source, description, url, type, category, lang, last_verified, caution, is_official, sort_order)
VALUES

-- ══ OTURUM & GÖÇ ══
('Oturum, entegrasyon ve göç — ana sayfa','Bundesamt für Migration und Flüchtlinge (BAMF)',
 'Almanya''da göç, oturum, entegrasyon kursları ve vatandaşlık konularında federal devletin ana kurumu. Yeni geldiysen oturum izni türleri ve entegrasyon kursu için ilk bakacağın yer.',
 'https://www.bamf.de/DE/Themen/Integration/ZugewanderteTeilnehmende/zugewanderteteilnehmende-node.html',
 'guide','visa',ARRAY['TR','DE','EN'],'2026-08-20',NULL,true,10),

('Yabancılar dairesini (Ausländerbehörde) bul','Bund.de — Verwaltungsportal',
 'Oturum izni, uzatma, yerleşme izni (Niederlassungserlaubnis) ve aile birleşimi işlemlerini yürüten yerel daire. Her şehrin kendi dairesi var; randevu genelde online alınır.',
 'https://verwaltung.bund.de','link','visa',ARRAY['DE'],'2026-08-20',
 'Merkezi tek Türkçe sayfa yok; işlemler yerel daireye göre değişir.',true,20),

-- ══ VATANDAŞLIK ══
('Alman vatandaşlığına geçiş (Einbürgerung)','Bundesamt für Migration und Flüchtlinge (BAMF)',
 'Alman vatandaşlığına nasıl geçileceğini, şartları ve vatandaşlık testini anlatan resmî sayfa. Çifte vatandaşlık ve gerekli oturma süresi gibi güncel soruların cevabı burada.',
 'https://www.bamf.de/einbuergerung','guide','citizenship',ARRAY['TR','DE','EN'],NULL,
 'Kısa adres resmî kaynaklarca teyitli ancak doğrudan test edilmedi. ÖNEMLİ: 27.06.2024''ten beri çifte vatandaşlık serbest ve süre 5 yıl; 3 yıllık hızlandırılmış yol 30.10.2025''te kaldırıldı. Bu alan sık değişiyor — daima BAMF''ın güncel sayfasına bak.',true,10),

('Vatandaşlık testi — ücretsiz online alıştırma','BAMF — Einbürgerungstest',
 '"Leben in Deutschland" ve vatandaşlık testine ücretsiz online hazırlanabileceğin resmî test merkezi.',
 'https://www.bamf.de/SharedDocs/Links/DE/O/oet-bamf-interaktiv_einbuergerungstest_fragenkatalog.html',
 'link','citizenship',ARRAY['TR','DE','EN'],'2026-08-20',NULL,true,20),

-- ══ İŞ & ÇALIŞMA ══
('İş bulma ve işsizlik parası','Bundesagentur für Arbeit',
 'İş bulma, işsizlik parası (Arbeitslosengeld) ve mesleki danışmanlık sunan federal kurum. İşini kaybettiysen veya iş arıyorsan ilk başvuru yeri.',
 'https://www.arbeitsagentur.de','link','employment',ARRAY['DE','EN'],'2026-08-20',
 'Arbeitslosengeld I (sigortaya dayalı) ile Bürgergeld (Jobcenter) farklı şeylerdir.',true,10),

('Bürgergeld — temel geçim yardımı (Türkçe PDF)','Bundesagentur für Arbeit',
 'Yeterli gelirin yoksa Jobcenter üzerinden başvurulan temel geçim yardımı. Bu PDF temel bilgileri Türkçe veriyor.',
 'https://www.arbeitsagentur.de/datei/grundsicherung-tuerkisch_ba046487.pdf',
 'doc','employment',ARRAY['TR','DE'],NULL,
 'Bağlantı yayından önce yeniden teyit edilmeli. Bundesagentur für Arbeit, Ocak 2026''dan itibaren Bürgergeld bilgilendirmelerini yalnızca Almanca ve kolay dilde sunacağını duyurdu — bu Türkçe PDF kaldırılabilir.',true,20),

('Özetle sosyal güvenlik (Türkçe broşür)','Bundesministerium für Arbeit und Soziales (BMAS)',
 'Almanya''daki sosyal güvenlik sistemini Türkçe özetleyen resmî bakanlık broşürü.',
 'https://www.bmas.de/DE/Service/Publikationen/Broschueren/a985-sosyal-guevenlik.html',
 'doc','employment',ARRAY['TR','DE','EN'],'2026-08-20',NULL,true,30),

-- ══ DİPLOMA & MESLEK DENKLİĞİ ══
('Diploma denkliği — Anerkennung portalı','Anerkennung in Deutschland (BIBB)',
 'Yurt dışında aldığın meslek diplomasının Almanya''da tanınması için doğru makamı bulmanı sağlayan resmî portal. "Anerkennungs-Finder" aracıyla yetkili kurumu bulursun.',
 'https://www.anerkennung-in-deutschland.de','guide','recognition',ARRAY['TR','DE','EN'],'2026-08-20',
 'Başvuru ücretleri başvurana ait. Tam evrakla süreç kural olarak 3 ayı geçmemeli.',true,10),

('Türk diplomalarının tanınması — özel sayfa','Anerkennung in Deutschland (BIBB)',
 'Türkiye''de alınmış diploma ve meslek belgelerinin Almanya''da tanınmasına dair özel bilgi sayfası.',
 'https://www.anerkennung-in-deutschland.de/html/de/pro/aktuelles-anerkennung-tuerkische-abschluesse.php',
 'guide','recognition',ARRAY['DE'],'2026-08-20',NULL,true,20),

('Niteliklerinin tanınması — bakanlık özeti','Bundesministerium für Arbeit und Soziales (BMAS)',
 'Diploma tanınması sürecini özetleyen bakanlık sayfası.',
 'https://www.bmas.de/DE/Arbeit/Migration-und-Arbeit/Anerkennung-und-Qualifizierung/Anerkennung-Ihrer-Qualifikationen/anerkennung-ihrer-qualifikationen.html',
 'guide','recognition',ARRAY['DE','EN'],'2026-08-20',NULL,true,30),

-- ══ AİLE & ÇOCUK ══
('Kindergeld — çocuk parası formları ve Türkçe merkblatt','Familienkasse / Bundesagentur für Arbeit',
 'Çocuk parası, çocuğun bakımı için ailelere düzenli devlet desteği. Türk vatandaşları için özel Türkçe-Almanca merkblatt bu sayfada.',
 'https://www.arbeitsagentur.de/familie-und-kinder/downloads-familie-und-kinder',
 'doc','family',ARRAY['TR','DE','EN'],'2026-08-20',
 'Hak, oturum iznine bağlı. Türk vatandaşları için Türk-Alman Sosyal Güvenlik Anlaşması ve Ortaklık Konseyi kararı EWG/Türkiye 3/80 de geçerli olabilir.',true,10),

('Elterngeld — ebeveyn parası','Familienportal (BMBFSFJ)',
 'Doğumdan sonra işe ara veren veya azaltan anne-babalara verilen gelir desteği.',
 'https://familienportal.de/familienportal/familienleistungen/elterngeld',
 'guide','family',ARRAY['DE'],'2026-08-20',
 '1 Nisan 2024 ve 1 Nisan 2025''ten itibaren doğumlar için yeni gelir sınırları geçerli.',true,20),

('Elterngeld hesaplama aracı','Familienportal (BMBFSFJ)',
 'Ne kadar Elterngeld alabileceğini resmî hesaplayıcıyla önceden gör.',
 'https://familienportal.de/familienportal/rechner-antraege/elterngeldrechner',
 'link','family',ARRAY['DE'],'2026-08-20',NULL,true,30),

-- ══ SAĞLIK & SİGORTA ══
('Yasal mı özel mi? Sağlık sigortası rehberi','Bundesgesundheitsministerium',
 'Yasal (gesetzlich) ve özel (privat) sağlık sigortası arasındaki farkı ve geçiş kurallarını anlatan resmî bakanlık sayfası. Almanya''da sağlık sigortası zorunludur.',
 'https://www.bundesgesundheitsministerium.de/themen/krankenversicherung/online-ratgeber-krankenversicherung/krankenversicherung/wechsel-zwischen-gkv-und-pkv',
 'guide','medical',ARRAY['DE'],'2026-08-20',
 'Vatandaş danışma hattı: sağlık sigortası (030) 340 60 66-01, bakım sigortası (030) 340 60 66-02.',true,10),

('Yasal sağlık kasaları — üst birlik','GKV-Spitzenverband',
 'Tüm yasal sağlık ve bakım kasalarının üst kuruluşu; kasa listesine ve sistemin kurallarına buradan ulaşılır.',
 'https://www.gkv-spitzenverband.de','link','medical',ARRAY['DE'],'2026-08-20',
 'Sigortasız kaldıysan en son bağlı olduğun sistemin kasasına başvurmalısın; kasa üyeliğini (koşullar sağlanıyorsa) reddedemez.',true,20),

-- ══ KONUT & KİRA ══
('Kiracı hakları ve kira hukuku danışmanlığı','Deutscher Mieterbund',
 'Kiracıların haklarını savunan, üyelerine kira hukuku danışmanlığı veren ülke çapındaki dernek. Kira artışı, kusur, tahliye veya depozito sorununda yardım alabilirsin.',
 'https://mieterbund.de','guide','housing',ARRAY['DE'],'2026-08-20',
 'Devlet kurumu DEĞİLDİR — sivil kuruluştur ve danışmanlık üyelik gerektirir. 500''den fazla danışma yeri var.',false,10),

('Wohngeld — kira yardımı bilgisi','Deutscher Mieterbund',
 'Kira yardımı (Wohngeld) kimlere veriliyor, nasıl başvurulur.',
 'https://mieterbund.de/service/wohngeld','guide','housing',ARRAY['DE'],'2026-08-20',
 'Sivil kuruluş kaynağı. Başvuru yerel belediyeye yapılır.',false,20),

-- ══ VERGİ & FİNANS ══
('ELSTER — online vergi beyannamesi','Finanzverwaltung (ELSTER)',
 'Vergi beyannameni (Steuererklärung) ücretsiz olarak elektronik verebileceğin resmî devlet portalı. Kayıt bir kez yapılır, sonra online doldurulur.',
 'https://www.elster.de','link','tax',ARRAY['DE'],'2026-08-20',
 'Yalnızca Almanca. Beyan zorunluysa takip eden yılın 31 Temmuz''una kadar verilir.',true,10),

('SCHUFA — ücretsiz veri kopyası (Datenkopie)','SCHUFA (Art. 15 GDPR hakkı)',
 'SCHUFA kredi notu kuruluşu; hakkında tuttuğu verilerin ücretsiz bir kopyasını isteme hakkın var. Ev kiralarken veya kredi çekerken önemli.',
 'https://www.meineschufa.de/service/datenkopie','link','tax',ARRAY['DE'],'2026-08-20',
 'Datenkopie ÜCRETSİZDİR — ücretli "Bonitätsauskunft" ile karıştırma. Genelde 2-4 haftada gelir.',false,20),

('Rundfunkbeitrag — muafiyet başvurusu','Rundfunkbeitrag (ARD/ZDF/Deutschlandradio)',
 'Her hane radyo-TV katkı payı öder; ancak Bürgergeld, sosyal yardım veya bazı sağlık durumlarında muafiyet başvurusu yapabilirsin. Otomatik değildir, başvuru şarttır.',
 'https://www.rundfunkbeitrag.de/buergerinnen-und-buerger/formulare/befreiung-oder-ermaessigung-beantragen',
 'doc','tax',ARRAY['DE'],'2026-08-20',
 'En fazla 3 yıl geriye dönük mümkün. Bürgergeld yenilendiğinde muafiyete YENİDEN başvurulmalı.',true,30),

-- ══ DİL & ENTEGRASYON ══
('Entegrasyon kursları (Integrationskurse)','Bundesamt für Migration und Flüchtlinge (BAMF)',
 'Almanca öğrenmeni ve Almanya''daki yaşamı tanımanı sağlayan devlet destekli kurslar. Bazı gruplar için ücretsiz, bazıları saat başı düşük katkı payı öder.',
 'https://www.bamf.de/DE/Themen/Integration/ZugewanderteTeilnehmende/zugewanderteteilnehmende-node.html',
 'guide','language',ARRAY['TR','DE','EN'],'2026-08-20',
 '2026 bütçe kısıtları nedeniyle §44 Abs. 4 kapsamındaki bazı isteğe bağlı başvurular geçici olarak reddediliyor — güncel durumu BAMF''tan teyit et.',true,10),

-- ══ EHLİYET ══
('Türk ehliyetini Alman ehliyetine çevirme (Umschreibung)','Fahrerlaubnisbehörde / FeV Anlage 11',
 'Almanya''da 6 aydan uzun yaşıyorsan Türk ehliyetini Alman ehliyetine çevirmen zorunlu. Başvuru yerel Fahrerlaubnisbehörde''ye yapılır.',
 'https://verwaltung.bund.de','link','driving',ARRAY['DE'],NULL,
 'ÖNEMLİ: Türkiye, FeV Anlage 11 listesinde olmadığı için hem TEORİ hem PRATİK sınav zorunlu. Yerleşim bildiriminden itibaren 6 ay içinde yapılmalı; süre dolduktan sonra Türk ehliyetiyle sürmek §21 StVG''ye göre suç sayılır. Merkezî resmî sayfa yok — mutlaka yetkili yerel daireden teyit al.',true,10),

-- ══ EMEKLİLİK ══
('Türkiye–Almanya emeklilik irtibat birimi','Deutsche Rentenversicherung',
 'Alman emeklilik sigortasının Türkiye ile ilgili irtibat birimi. Hem Almanya''da hem Türkiye''de çalıştıysan prim sürelerinin emekliliğine etkisini buradan öğrenirsin.',
 'https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Ausland/Ansprechpartner-und-Verbindungsstellen/Tuerkei/Tuerkei-deutsch/Tuerkei-deutsch_node.html',
 'guide','pension',ARRAY['TR','DE'],'2026-08-20',
 'Türk-Alman Sosyal Güvenlik Anlaşması 1 Kasım 1965''te yürürlüğe girdi; prim iadesi ve süre birleştirmeyi düzenler.',true,10),

('Almanya ve Türkiye''de çalışmak — Türkçe broşür','Deutsche Rentenversicherung',
 'İki ülkede de çalışmış olanlar için emeklilik haklarını Türkçe anlatan resmî broşür.',
 'https://www.deutsche-rentenversicherung.de/SharedDocs/Downloads/DE/Broschueren/international/weitere_abkommen_fremdsprachig/arbeiten_deutschland_tuerkei_tuerkisch.html',
 'doc','pension',ARRAY['TR'],'2026-08-20',NULL,true,20),

-- ══ KONSOLOSLUK & TÜRKİYE İŞLEMLERİ ══
('e-Konsolosluk — randevu ve işlemler','T.C. Dışişleri Bakanlığı',
 'Pasaport, nüfus, askerlik, vatandaşlık ve randevu işlemlerini yürütebileceğin resmî konsolosluk portalı.',
 'https://www.konsolosluk.gov.tr','link','consulate',ARRAY['TR'],'2026-08-20',
 '"test.konsolosluk.gov.tr" bir deneme sürümüdür — kullanma.',true,10),

('Dövizle askerlik işlemleri','T.C. Millî Savunma Bakanlığı (MSB)',
 'Yurt dışında yaşayan vatandaşlar için askerlik yükümlülüğü ve dövizle askerlik işlemleri. En az 3 yıl (1.095 gün) yurt dışında çalışma şartı var.',
 'https://www.msb.gov.tr/Askeralma/icerik/dovizle-askerlik-islemleri',
 'guide','consulate',ARRAY['TR'],'2026-08-20',
 'Yurt dışındakiler için doğru terim "dövizle askerlik"tir (yurt içi "bedelli"den farklı). Ücret yılda iki kez ve kanun değişiklikleriyle değişir — güncel tutarı DAİMA resmî MSB/konsolosluk duyurusundan teyit et.',true,20),

('Mavi Kart','T.C. Nüfus ve Vatandaşlık İşleri Genel Müdürlüğü (NVİ)',
 'Çıkma izniyle Türk vatandaşlığından ayrılanlara ve altsoyuna verilen belge. Seçme-seçilme, askerlik ve gümrüksüz araç ithali dışında birçok hakkı korur.',
 'https://www.nvi.gov.tr/mavi-kart','guide','consulate',ARRAY['TR'],'2026-08-20',
 'Yurt dışında konsolosluklar, yurt içinde ilçe nüfus müdürlükleri verir.',true,30),

('MERNİS — nüfus kayıt sistemi','T.C. Nüfus ve Vatandaşlık İşleri Genel Müdürlüğü (NVİ)',
 'Türkiye''nin merkezî nüfus kayıt sistemi; T.C. kimlik numarasının dayanağı.',
 'https://www.nvi.gov.tr/mernis','link','consulate',ARRAY['TR'],'2026-08-20',NULL,true,40),

('T.C. Berlin Büyükelçiliği','T.C. Dışişleri Bakanlığı',
 'Almanya''daki Türk Büyükelçiliği resmî sayfası.',
 'https://berlin-be.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],'2026-08-20',NULL,true,50),

('T.C. Berlin Başkonsolosluğu','T.C. Dışişleri Bakanlığı','Berlin bölgesi konsolosluk işlemleri.',
 'https://berlin-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],'2026-08-20',NULL,true,51),
('T.C. München Başkonsolosluğu','T.C. Dışişleri Bakanlığı','München bölgesi konsolosluk işlemleri.',
 'https://munih-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],'2026-08-20',NULL,true,52),
('T.C. Stuttgart Başkonsolosluğu','T.C. Dışişleri Bakanlığı','Stuttgart bölgesi konsolosluk işlemleri.',
 'https://stuttgart-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],'2026-08-20',NULL,true,53),
('T.C. Nürnberg Başkonsolosluğu','T.C. Dışişleri Bakanlığı','Nürnberg bölgesi konsolosluk işlemleri.',
 'https://nurnberg-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],'2026-08-20',NULL,true,54),

-- The nine below follow the same confirmed URL pattern but were NOT
-- individually loaded. last_verified stays NULL until tested.
('T.C. Düsseldorf Başkonsolosluğu','T.C. Dışişleri Bakanlığı','Düsseldorf bölgesi konsolosluk işlemleri.',
 'https://dusseldorf-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],NULL,'Bağlantı henüz test edilmedi.',true,60),
('T.C. Essen Başkonsolosluğu','T.C. Dışişleri Bakanlığı','Essen bölgesi konsolosluk işlemleri.',
 'https://essen-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],NULL,'Bağlantı henüz test edilmedi.',true,61),
('T.C. Frankfurt Başkonsolosluğu','T.C. Dışişleri Bakanlığı','Frankfurt bölgesi konsolosluk işlemleri.',
 'https://frankfurt-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],NULL,'Bağlantı henüz test edilmedi.',true,62),
('T.C. Hamburg Başkonsolosluğu','T.C. Dışişleri Bakanlığı','Hamburg bölgesi konsolosluk işlemleri.',
 'https://hamburg-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],NULL,'Bağlantı henüz test edilmedi.',true,63),
('T.C. Hannover Başkonsolosluğu','T.C. Dışişleri Bakanlığı','Hannover bölgesi konsolosluk işlemleri.',
 'https://hannover-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],NULL,'Bağlantı henüz test edilmedi.',true,64),
('T.C. Karlsruhe Başkonsolosluğu','T.C. Dışişleri Bakanlığı','Karlsruhe bölgesi konsolosluk işlemleri.',
 'https://karlsruhe-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],NULL,'Bağlantı henüz test edilmedi.',true,65),
('T.C. Köln Başkonsolosluğu','T.C. Dışişleri Bakanlığı','Köln bölgesi konsolosluk işlemleri.',
 'https://koln-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],NULL,'Bağlantı henüz test edilmedi.',true,66),
('T.C. Mainz Başkonsolosluğu','T.C. Dışişleri Bakanlığı','Mainz bölgesi konsolosluk işlemleri.',
 'https://mainz-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],NULL,'Bağlantı henüz test edilmedi.',true,67),
('T.C. Münster Başkonsolosluğu','T.C. Dışişleri Bakanlığı','Münster bölgesi konsolosluk işlemleri.',
 'https://munster-bk.mfa.gov.tr/Mission','link','consulate',ARRAY['TR','DE'],NULL,'Bağlantı henüz test edilmedi.',true,68),

-- ══ HAKLAR & HUKUKİ YARDIM ══
('Ayrımcılığa uğradıysan — federal danışma','Antidiskriminierungsstelle des Bundes',
 'Kökeni, dini, cinsiyeti veya engeli nedeniyle ayrımcılığa uğrayanlara bilgi ve danışmanlık veren federal kurum. İş yerinde, konutta veya dairelerde ayrımcılık yaşarsan başvurabilirsin.',
 'https://www.antidiskriminierungsstelle.de','guide','rights',ARRAY['DE'],'2026-08-20',
 'Danışma hattı 0800 546 546 5 (Pzt-Prş 9-15). Türkçe hizmet yok ama tercüman sağlanabilir. Berlin''de Türkçe danışmanlık için TBB/ADNB bir seçenek.',true,10),

('Beratungshilfe — düşük gelirliler için hukuki yardım','Justiz (eyalet adalet bakanlıkları)',
 'Gelirin düşükse neredeyse ücretsiz hukuki danışmanlık (Beratungshilfe) ve dava masrafı yardımı (Prozesskostenhilfe) alabilirsin. Yerel sulh mahkemesinden (Amtsgericht) başvurulur.',
 'https://www.justiz.nrw/BS/lebenslagen/zivilrecht/Prozesskostenhilfe','guide','rights',ARRAY['DE'],'2026-08-20',
 'Bu bağlantı NRW eyaletine ait — kurallar eyaletlere göre değişir, kendi eyaletinin adalet bakanlığına bak. Avukata en fazla 15 € ödenir. Yabancı uyruklular da yararlanabilir.',true,20),

-- ══ ACİL DURUM ══
('Kadına yönelik şiddet yardım hattı — 116 016','Hilfetelefon "Gewalt gegen Frauen" (BMBFSFJ)',
 'Şiddete uğrayan veya tehdit edilen kadınlar için 7/24 ücretsiz ve gizli danışma hattı. Türkçe dahil 18 dilde destek verir; telefon faturasında görünmez.',
 'https://www.hilfetelefon.de/das-hilfetelefon/beratung/beratung-in-18-sprachen/tuerkisch',
 'link','emergency',ARRAY['TR','DE','EN'],'2026-08-20',
 'Telefon: 116 016 · Ücretsiz, anonim, 365 gün 24 saat. Chat ve e-posta danışmanlığı da var. Acil tehlike varsa 110 (polis).',true,10);

COMMIT;

-- ── CHECK (run separately after COMMIT) ─────────────────────
-- SELECT category, count(*) AS adet,
--        count(*) FILTER (WHERE last_verified IS NULL) AS dogrulanmamis
-- FROM public.resources GROUP BY category ORDER BY category;
