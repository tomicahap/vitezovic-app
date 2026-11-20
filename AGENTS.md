# Pravila rada na projektu HRD-CMS („Rodoslovac” — Pavao Ritter Vitezović)

Ova datoteka definira obavezna pravila, vizualne standarde, poslovnu logiku i tehničke norme projekta HRD-CMS za Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”. Agent MORA automatski poštovati sva navedena pravila u svakoj sesiji bez potrebe za ponovnim podsjećanjem korisnika.

---

## 1. Obavezni završni koraci nakon svake promjene u kodu
Nakon svake implementirane izmjene, nove funkcionalnosti ili ispravka u aplikaciji, agent MORA automatski izvršiti sve korake u nastavku:

1. **Provjera i ažuriranje verzije aplikacije:**
   - Format verzije u aplikaciji je `vDD.MM.YYYY` prema trenutnom datumu (a u `package.json` u formatu `YYYY.MM.DD`).
   - Verzija mora biti usklađena na svim sljedećim mjestima:
     - `lib/changelog-data.ts` (vršni zapis u `CHANGELOG_DATA` s `isLatest: true` i `badge: "Najnovije izdanje"`; starijim zapisima ukloniti `isLatest: true`)
     - `components/changelog-content.tsx` (bedž `Aktualna verzija: vDD.MM.YYYY`)
     - `components/app-sidebar.tsx` (sve oznake verzije i link na `/changelog`)
     - `components/boot-splash.tsx` (oznaka verzije na uvodnom zaslonu)
     - `components/manual-content.tsx` (tekst, gumb i podnožje korisničkog priručnika)
     - `package.json` (`version` polje u formatu `"YYYY.MM.DD"`)

2. **Dopuna popisa promjena (Changelog) i priručnika:**
   - U `lib/changelog-data.ts` unutar aktivne verzije (`CHANGELOG_DATA[0].changes`) dodati jasan i strukturiran opis svake promjene na hrvatskom jeziku (`type: "novo" | "poboljsanje" | "ispravak"`).
   - Kod novih korisničkih funkcionalnosti po potrebi dopuniti i odgovarajuću sekciju u `components/manual-content.tsx`.

3. **Obavezna provjera sigurnosnih kopija, baza i prava pristupa:**
   - Prije gradnje provjeriti sve točke **Sekcije 7** (jesu li nove tablice/stupci/privitci pokriveni u backupu, povratu i Dry-Run simulaciji te jesu li baze strogo odvojene) i **Sekcije 8** (je li svaka nova korisnička funkcionalnost dodana u pojedinačna prava pristupa po članu).

4. **Provjera tipova, gradnje i slanje na GitHub:**
   - Obavezno pokrenuti `npx tsc --noEmit` (izlaz mora biti `0`).
   - Kod dodavanja novih ruta, dinamičkih komponenti ili većih izmjena pokrenuti i produkcijski build (`$env:NODE_OPTIONS='--max-old-space-size=2048'; npm run build` u Windows PowerShellu).
   - Izvršiti `git add -A`, `git commit -m "vDD.MM.YYYY: <opis na hrvatskom>"` te `git push origin main` (u PowerShellu ne koristiti `&&`, već `; if ($LASTEXITCODE -eq 0) { ... }`).

---

## 2. Jezik i komunikacijski standard
- Sav tekst korisničkog sučelja, gumbi, dijalozi, e-mailovi, PDF izvješća, zapisi u dnevniku rada (`activity_logs`), poruke pogrešaka i Git commit poruke pišu se na **hrvatskom jeziku** uz ispravne dijakritičke znakove (`č, ć, ž, š, đ, Č, Ć, Ž, Š, Đ`).
- Svaki datum i vrijeme u sučelju, tablicama, izvješćima, e-mailovima i izvozima MORA biti u formatu:
  - Datum: `DD/MM/YYYY` putem `formatDateDMY` iz `lib/utils.ts` (odnosno `formatHrdEmailDate` u e-mailovima).
  - Datum i vrijeme: `DD/MM/YYYY HH:mm` putem `formatDateTimeDMY` iz `lib/utils.ts`.
  - U e-mailovima vrijeme koristiti u 24-satnom formatu `HH:mm` (`formatHrdEmailTime`).

---

## 3. Paleta boja, tipografija i dizajn sustava

### 3.1. Web sučelje (`app/globals.css`, `app/layout.tsx`)
Glavni izgled aplikacije koristi klasični arhivski/institucionalni vizualni identitet s toplim pergamentom, dubokom tamnoplavom i zlatno-oker naglaskom:
- **Pozadina stranice (`--background`):** `#F2EFE9` (topli pergament)
- **Glavni tekst i primarna boja (`--foreground`, `--primary`, `--card-foreground`):** `#1B2B36` (tamnoplava / škriljevac)
- **Tekst na primarnoj podlozi (`--primary-foreground`):** `#F2EFE9`
- **Kartice i skočni prozori (`--card`, `--popover`):** `#FFFFFF`
- **Bočna navigacijska traka (`--sidebar`):** `#FBF9F6`
- **Sekundarne površine i obrubi (`--secondary`, `--muted`, `--border`, `--input`):** `#E8E4DE`
- **Prigušeni tekst (`--muted-foreground`):** `#6B7280`
- **Naglasak i fokus prsten (`--accent`, `--ring`, `--chart-1`):** `#CEA369` (zlatno-oker)
- **Destruktivne radnje i upozorenja (`--destructive`):** `#DC2626`
- **Zaobljenje (`--radius`):** `0.75rem` (kartice često `rounded-xl`, `rounded-2xl`, `rounded-3xl`, gumbi `rounded-full` ili standardni shadcn gumbi).
- **Tipografija:**
  - `--font-sans`: `Geist`, sans-serif (tijelo sučelja, tablice, kontrole)
  - `--font-serif`: `Libre Baskerville`, Georgia, serif (glavni naslovi stranica, naslovi modula i kartica)
  - `--font-mono`: `Geist Mono`, monospace (matični brojevi, kodovi, vremenske oznake, verzije)
- **Pristupačnost i mobilni prikaz (`app/globals.css`):**
  - Očuvati podršku za uvećani prikaz slabovidnih (`html.zoom-a11y` = 125% skaliranje).
  - Na ekranima `< 768px` ostaviti `padding-bottom` za donju navigacijsku traku i držati `font-size: 16px !important` na `input, select, textarea` kako iOS ne bi automatski zumirao polja.

### 3.2. Službeni HRD E-mail standard (`lib/hrd-email-system.ts`)
Svi sustavni i ručni e-mailovi MORAJU koristiti centralizirani generator `buildHrdMasterEmail` (maksimalna širina 600 px, tablični HTML kompatibilan s Gmailom, Outlookom i Apple Mailom):
- **Obvezna e-mail paleta (`DEFAULT_HRD_EMAIL_PALETTE`):**
  - Zaglavlje (`navyBlue`): `#1E3A5F` (institucionalna tamnoplava; naslov `HRVATSKO RODOSLOVNO DRUŠTVO`, podnaslov `Pavao Ritter Vitezović` — logotip se NIKADA ne stavlja u zaglavlje)
  - Akcent i 4 px linija ispod zaglavlja (`goldOrange`): `#D97706` (koristi se i za lijevi obrub informativnog bloka i donji obrub CTA gumba)
  - Naslovi sadržaja i informativnih blokova (`terracotta`): `#7C2D12`
  - Glavni tekst (`graphite`): `#1F2937`
  - Poveznice (`linkBlue`): `#1F77C5`
  - Glavna podloga sadržaja (`white`): `#FFFFFF`
  - Vanjska podloga (`lightGrayBg`): `#F8FAFC`
  - Informativni / istaknuti blok (`lightCream`): `#FEFCE8`
  - Obrubi i linija iznad potpisa (`borderGray`): `#E2E8F0`
- **Zaglavlje modala za slanje e-pošte u UI-ju:** koristi `bg-[#1E3A5F] border-b-2 border-[#D97706] text-white`, a gumbi koriste `border-[#D97706] text-[#1E3A5F]` (test) i `bg-[#1E3A5F] border border-[#D97706] text-white` (slanje).
- **Potpis (`resolveStandardizedSignature`):** Automatski se dodaje u podnožje ispod linije `#E2E8F0`. Logotip društva (`settings.logoUrl`) ugrađuje se isključivo u potpis (kao CID privitak `hrd_official_logo_cid` kod slanja, odnosno URL u pregledniku).
- **Obavezne opcije svakog modula za slanje e-pošte:**
  1. Vizualni pregled uživo (`forBrowserPreview: true`) ili uređivanje poruke.
  2. Mogućnost slanja **testnog maila** (`testOnly: true`, predmet s prefiksom `[TEST]`, bez promjene produkcijskih statusa i bez upisa masovnog slanja).
  3. Evidentiranje stvarnog slanja u `activity_logs` (`DatabaseService.insertLog` / `addLog`).

---

## 4. PDF dokumenti i podrška za hrvatske znakove
- Svi PDF dokumenti (`lib/report-pdf.ts`, `lib/event-pdf.ts`, `lib/member-pdf.ts`) MORAJU koristiti ugrađene TrueType fontove iz `lib/pdf-font-data.ts` (`PDF_REGULAR_FONT`, `PDF_BOLD_FONT`, `PDF_CROATIAN_BYTE_MAP`) i centralni sastavljač `assemblePdfDocument` s ispravnim `/Widths` tablicama, `/ToUnicode` CMap-om i `.normalize("NFC")` obradom ulaznog teksta.
- Zabranjeno je uvođenje neugrađenog standardnog PDF fonta (Helvetica) bez punog WinAnsi/hrvatskog mapiranja i `/ToUnicode` tablice jer uzrokuje lomljenje i pogrešnu širinu znakova `č, ć, ž, š, đ`.
- Nazive preuzetih PDF datoteka čistiti kroz `sanitizePdfFileNamePart` (`lib/member-pdf.ts`) kako bi `đ/Đ` pravilno prešli u `d/D`, bez oštećenja imena datoteka.

---

## 5. Poslovna pravila aplikacije i prava pristupa
1. **Administrator i baza članova:**
   - Administrator (`role === 'admin'`, `id: 2579` ili rezervni `id: 0`) NIKADA se ne smije pojavljivati ni spremati kao zapis u tablici `members` (`isAdminAccountEntry`, `isAdminRecord`).
   - Osobne bilješke i zadaci administratora čuvaju se u tablici `settings` (`adminPersonalNotes`, `adminPersonalTodos`).
2. **Statusi članova i podsjetnici (`lib/member-status.ts`, `components/members-content.tsx`):**
   - Živi status člana (`status`, `paymentStatus`, `status_clana`, `datum_zadnje_uplate`) uvijek se izvodi putem `computeMemberStates`.
   - Ikona (`€`) za pojedinačni podsjetnik za plaćanje u pregledu članova prikazuje se **isključivo** članovima koji imaju upisanu e-mail adresu i imaju evidentiran dug (`DUG` / `overdue`) ili su ispisani (`expelled` / `expired`) — nikada preminulima (`deceased`).
   - Kada je nakon zadnjeg poslanog podsjetnika evidentirana nova uplata ili podmirena članarina za tekuće razdoblje, oznaka i ikona podsjetnika skrivaju se u općem pregledu članova, ali evidencija (`lastPaymentReminderAt`) trajno ostaje vidljiva u pojedinačnom kartonu člana.
3. **Dopuna podataka člana (`components/members-content.tsx`, `components/missing-data-email-dialog.tsx`, `app/api/public/member-data/[token]/route.ts`):**
   - Pravilo nepotpunog profila i slanja zahtjeva za dopunu podataka (pojedinačna oznaka s brojem polja koja nedostaju i skupno slanje) vrijedi jednako za **sve članove** s e-mail adresom (uključujući neaktivne i ispisane); jedina iznimka su **preminuli** (`deceased`) članovi i članovi s oznakom **Ne kontaktirati**.
   - Svaki novo poslani podsjetnik za dopunu podataka izdaje novu **jednokratnu** poveznicu (`data_form_single_use = 1`): dopušten je **isključivo 1 pristup**, u e-mailu mora pisati obavezna napomena da svaki sljedeći pristup nije dopušten, a odmah po predaji podataka `data_form_token` i `data_form_session_nonce` trajno se brišu u bazi (evidencija predaje ostaje sačuvana). Ranije poslane poveznice za koje podaci još nisu predani (`data_form_single_use = 0`) vrijede do predaje.
4. **Članovi tijela društva (`lib/utils.ts`):**
   - Trenutni sastav tijela društva određuje se putem `isBoardMember(m)` i `getMemberActiveFunctions(m)` (aktivne funkcije s važećim mandatom `isMandateActive`, isključujući admin račune, preminule i ispisane).
   - E-mail komunikacija prema članovima tijela (sjednice, predavanja, obavijesti tijelima putem `/api/board/announcement`) smije slati poruke isključivo validiranim primateljima iz aktivnog sastava tijela (osim `testOnly` slanja na navedenu testnu adresu) i uvijek mora sadržavati tko je obavijest podijelio.
5. **Odvojeni moduli Projekti i Istraživanja:**
   - **Projekti** (`/projects`) i **Istraživanja** (`/research`) su odvojeni top-level moduli u bočnoj traci, vršnoj navigaciji, `GlobalQuickSearch` pretraživanju (`Ctrl+K`), Nadzornoj ploči i `ProtectedRoute` zaštiti.
   - Prava za Istraživanja čitaju se putem `getInquiryPermissions(user)` (3 razine: `zaprimljeno`, `uradu`, `zavrseno`), neovisno o modulu `projects`. Stara poveznica `/projects?tab=inquiries` preusmjerava na `/research`.
   - U Istraživanjima održavati kronološki prikaz komunikacije te evidenciju datuma i odgovora/opravdanja osobe na poslane provjere statusa.
6. **Zaštita od brisanja — „Smeće” (`lib/trash.ts`):**
   - Svako brisanje entiteta ili osjetljivo čišćenje podataka (članovi, uplate, sjednice, predavanja, knjige, časopisi, projekti, upiti, kontakti, linkovi, ankete, todo stavke) MORA ići preko `TrashService` uz `extractActor(request, body)` kako bi administrator na `/trash` mogao vidjeti tko je i kada obrisao podatak te ga po potrebi vratiti (*Undelete*).
7. **Zabrana kontaktiranja člana — „Ne kontaktirati” (`do_not_contact`, `lib/do-not-contact.ts`):**
   - Kada član izričito zatraži da ga se više ne kontaktira (`do_not_contact = 1`, `do_not_contact_date`, `do_not_contact_note`), zabranjeno je slanje bilo kakvog e-maila (pozivnice, podsjetnici za članarinu, dopune podataka, rođendanske čestitke, obavijesti tijelima, sjednice/predavanja, ankete, Gmail, istraživanja, donacije) i označavanje novih kontakata u modulu Arhiv.
   - U cijelom sučelju mora biti jasno istaknuta crvena oznaka da je na izričitu napomenu član zatražio da ga se ne kontaktira, bez klikabilnih `mailto:`/`tel:` linkova, a zabrana mora biti tvrdo osigurana na poslužitelju putem `lib/do-not-contact.ts`.

---

## 6. Sigurnost, baze podataka i performanse
1. **Sigurnost postavki i resursa (`app/api/settings/route.ts`, `app/api/settings/asset/route.ts`):**
   - Zadani `GET /api/settings?scope=lite` NIKADA ne smije slati lozinke ni privatne ključeve (`adminPassword`, `adminBackupPassword`, `smtpPass`, `dropboxAppSecret`, `dropboxRefreshToken`, `googleServiceAccountJson`, `vaultNotes`), već samo boolean zastavice (`hasGoogleServiceAccount`, `hasDropboxConfig`, `hasSmtpPass`).
   - Puni `scope=admin` dostupan je isključivo administratoru (i nikad ne vraća `adminPassword`), dok `POST /api/settings` za sigurnosna/vjerodajnička polja provjerava `actor.role === 'admin'`.
   - Slike postavki (`logoUrl`, `paymentSlipUrl`, `paymentQrUrl`) u API odgovorima zamjenjuju se ETag-keširanim proxy putanjama `/api/settings/asset?type=...&v=...`, a `SettingsService.updateSettings` mora ignorirati te proxy URL-ove pri spremanju kako nikad ne bi pregazio izvorne Base64 slike u bazi.
2. **SQLite baza podataka (`lib/database.ts`, `src/db/client.ts`):**
   - Sve SQLite i `fs` datoteke na poslužitelju moraju imati `import 'server-only'`.
   - Produkcijske baze nalaze se u `/var/data/prv_data/db/` (lokalno `data/`): `app.db`, `mailcrawl.db`, `company_scraper.db`.
   - Konektori koriste dijeljenu singleton referencu na `globalThis` sa standardnim pragmama: `journal_mode = WAL`, `busy_timeout = 5000`, `synchronous = NORMAL`, `temp_store = MEMORY`, `cache_size = -16000`.
   - Startup migracije su zaštićene putem `PRAGMA user_version` (`DB_SCHEMA_VERSION = 24` u `lib/database.ts`, `DRIZZLE_SCHEMA_VERSION = 24` u `src/db/client.ts`) i `ensurePerformanceIndexes`. Kod dodavanja novih kolona/tablica obavezno inkrementirati obje verzije i dodati stupce i u `restoreDatabase`.
3. **Klijentska učinkovitost i stabilnost gradnje:**
   - Globalni konteksti u `app/layout.tsx` ne smiju pokretati fetchove prije prijave korisnika niti slati automatske `setTimeout` pozadinske oluje na svakoj ruti; teže module (`Library`, `Projects`, `Contacts`, `Links`, `Meetings`, `Lectures`, `ActivityLog`) učitavati samo na rutama koje ih koriste ili putem `ensureLoaded()`.
   - Periodički status sustava provjerava se putem laganog `/api/system/status`, sesija putem `/api/auth/me`, ankete se dijele kroz `lib/polls-client.ts` bez blokiranja sučelja u `VotingOverlay`, Gmail sažetak na Nadzornoj ploči učitava se asinkrono s poslužiteljskim kešom, a teški grafički paketi (`recharts`) uvoze se dinamički (`next/dynamic`).
   - U `next.config.mjs` NE mijenjati način pokretanja u `output: 'standalone'` bez eksplicitne izmjene Docker/server skripte pokretanja.

---

## 7. Backup, Testiranje backupa (Dry-Run), Odvojenost baza i Pohrana

1. **Stroga odvojenost baza podataka i jedinstveno mjesto pohrane (`lib/db-path.ts`):**
   - Sve SQLite baze moraju biti fizički odvojene po domeni i smještene isključivo u `getDatabaseDir()` (`/var/data/prv_data/db/` u produkciji, `./data/` lokalno):
     - `app.db` (`getAppDbPath()`): glavna CMS baza (članovi, uplate, sjednice, predavanja, knjižnica, projekti, istraživanja, logovi, postavke, trezor, glasovanja, `trash_items`, `board_announcements`, `archive_member_contacts`, evidencija prijava i mailova — 28 tablica).
     - `mailcrawl.db` (`getMailcrawlDbPath()`, poštuje `MAILCRAWL_DATABASE_PATH`): modul Donacija i kampanja (`leads`, `sent_registry`, `search_query_history`, `settings`).
     - `company_scraper.db` (`getCompanyScraperDbPath()`): Scraper registra tvrtki (`company_scraper_raw`, `company_scraper_enriched`, `company_scraper_checkpoints`).
   - Zabranjeno je spajati tablice iz različitih domena u istu bazu ili stvarati ad-hoc `.db`/`.sqlite` datoteke izvan `getDatabaseDir()`.
   - Svi učitani dokumenti i privitci moraju ići isključivo u `UPLOAD_FOLDER` (lokalno `data/uploads/`) i u bazi se referencirati kao `/api/uploads/<datoteka>`. Privremene ZIP/sandbox datoteke moraju se brisati u `finally` bloku.

2. **Obavezna provjera kod svake nadogradnje (tablica, stupac, nova pohrana ili verzija):**
   1. `lib/database.ts`: inkrementirati `DB_SCHEMA_VERSION`, dodati migraciju i indekse (`ensurePerformanceIndexes`), te obavezno dodati sve nove stupce/tablice u `restoreDatabase()` (`postRestoreCols` i post-restore DDL) da povrat starijeg backupa uvijek radi bez greške.
   2. `src/db/client.ts` (i `src/db/schema/*`): inkrementirati `DRIZZLE_SCHEMA_VERSION` i dodati `ensureColumn` / definiciju tablice.
   3. `lib/backup.ts` -> `createBackupZip()`: provjeriti da sve odvojene baze prolaze `wal_checkpoint(TRUNCATE)`, koriste centralne putanje iz `lib/db-path.ts`, pakiraju se u `database/<ime>.db` s ažurnim `manifest.json` (`appVersion`, `separatedDatabases`) i da se `uploads/` pakira u `uploads/`.
   4. `lib/backup.ts` -> `simulateBackupRestore()` (Dry-Run sandbox): dodati svaku novu tablicu u `expectedTables` / `mcExpectedTables` / `csExpectedTables`, kritične stupce u provjeru sheme (`criticalColumnsCheck`), nove kolone s privitcima u provjeru `/api/uploads/` datoteka te provjeriti `integrity_check` i međusobnu odvojenost SVIH triju baza.
   5. `app/api/admin/backup/route.ts`: dodati svaku novu tablicu/bazu u JSON izvoz i čitati verziju dinamički iz `CHANGELOG_DATA[0].version`.

---

## 8. Obavezno pravilo za nove funkcionalnosti — Prava pristupa po članu

- Svaki novi korisnički modul, kartica ili poseban alat/akcija MORA odmah po uvođenju biti dostupan za pojedinačnu dodjelu po članu (iznimka su isključivo strogo administracijske rute `/settings`, `/trash`, `/admin/donations`).
- Novi modul dodaje se u `APP_MODULE_PERMISSIONS_LIST` (`lib/inquiry-permissions.ts`) i `AccessCategory` (`contexts/members-context.tsx`), a novi alat/akcija (poput `member_action_obavijest_tijelima`) u `MEMBER_ACTION_PERMISSIONS_LIST` i `getMemberActionPermissions` (`lib/inquiry-permissions.ts`).
- Oba ekrana za uređivanje prava (**Postavke -> Prava pristupa** u `components/settings-access-tab.tsx` i **Karton člana -> Pristup aplikaciji** u `app/members/[id]/page.tsx`) moraju koristiti zajedničku kartičnu komponentu `components/access-rights-editor.tsx` i nikada ne smiju imati lokalno duplicirane liste prava.
- Svako pravo mora biti dosljedno provjereno na sva 3 sloja: navigacija (`app-sidebar.tsx`, `desktop-header-nav.tsx`, `global-quick-search.tsx`), UI zaštita (`ProtectedRoute` / vidljivost alata) i poslužiteljski API (`extractActor` + provjera iz baze).

