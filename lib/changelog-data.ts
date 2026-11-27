export interface ChangelogEntry {
  version: string
  dateLabel: string
  title: string
  badge: string
  isLatest?: boolean
  changes: {
    type: "novo" | "poboljsanje" | "ispravak"
    text: string
  }[]
}

export const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    version: "v27.11.2026",
    dateLabel: "27/11/2026",
    title: "Personalizirana e-mail zahvala za donaciju tvrtkama i fizičkim osobama",
    badge: "Najnovije izdanje",
    isLatest: true,
    changes: [
      {
        type: "novo",
        text: "Personalizirana zahvala donatorima u modulu Donacije & Kampanje (lib/mailcrawl/thank-you.ts, app/api/admin/mailcrawl/thank-you/route.ts, components/donation-thank-you-dialog.tsx, components/donations-content.tsx): za svaku tvrtku, obrt, udrugu ili fizičku osobu s evidentiranom donacijom omogućen je gumb „Pošalji zahvalu” (i iz tablice Baza subjekata i iz Poslanih mailova & Evidencije donacija). Sustav automatski personalizira oslovljavanje i tekst prema vrsti donatora, kontakt osobi, iznosu uplate, datumu (DD/MM/YYYY) i svrsi uplate, nudi opcionalnu AI doradu (Gemini), pregled uživo u službenom HRD predlošku bez nove uplatnice, sigurno [TEST] slanje te trajnu evidenciju u mailcrawl.db (leads i sent_registry), povijesti slanja i dnevniku aktivnosti."
      },
      {
        type: "poboljsanje",
        text: "Dodatna opcija izravnog otvaranja pripreme zahvale odmah nakon ručnog upisa donacije ili evidentiranja uplate donatora, uključujući mogućnost upisa e-mail adrese za ručno unesene donatore koji prethodno nisu imali e-mail."
      }
    ]
  },
  {
    version: "v26.11.2026",
    dateLabel: "26/11/2026",
    title: "Interaktivna analitika Društva na Nadzornoj ploči i automatska aktivacija pozivnice",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "novo",
        text: "Prikaz 2D HUB-3A barkoda i SEPA QR koda za donaciju te slanje uputa na e-mail iz ankete zadovoljstva (lib/inquiry-donation-email.ts, app/api/public/inquiry-feedback/[token]/route.ts, app/ocjena-istrazivanja/[token]/page.tsx): kada naručitelj na anketi zadovoljstva odabere mogućnost financijske podrške radu Društva, odmah mu se prikazuju potpuni podaci za uplatu, 2D HUB-3A barkod i SEPA QR kod te gumb „Pošalji upute i QR kod na moj e-mail”. Klikom korisnik prima kompletan službeni e-mail sa svim uputama i ugrađenim slikama kodova, a Administrator prima kratku obavijest da se to dogodilo (uz evidenciju u arhivi predmeta i statistici zadovoljstva, DB_SCHEMA_VERSION = 30, DRIZZLE_SCHEMA_VERSION = 30)."
      },
      {
        type: "novo",
        text: "Vanjski suradnici (osobe koje nisu članovi Društva) s pristupom isključivo modulu Istraživanja (lib/database.ts -> ExternalUsersDB, app/api/admin/external-users/route.ts, app/api/admin/external-users/invite/route.ts, components/external-users-manager.tsx): Administrator u Postavke -> Prava pristupa -> Vanjski suradnici (nisu članovi) može dodati vanjskog istraživača bez upisa u Registar članova, poslati mu aktivacijsku pozivnicu s postavljanjem lozinke i dodijeliti mu pristup samo dodijeljenim predmetima ili odabranim fazama (Zaprimljeno / U radu / Završeno). Vanjski suradnici se mogu birati u Istraživanjima (označeni značkom „Nije član”), primaju automatske obavijesti i imaju strogo zaključan pristup svim ostalim modulima sustava i popisu članova."
      },
      {
        type: "poboljsanje",
        text: "Nadograđena shema baze podataka (DB_SCHEMA_VERSION = 29, DRIZZLE_SCHEMA_VERSION = 29) tablicom external_users, podrškom za Smeće i povrat (TrashService.trashExternalUser), JSON izvozom backupa i Dry-Run provjerom u lib/backup.ts."
      },
      {
        type: "novo",
        text: "Automatski potpis pošiljatelja s imenom, prezimenom i funkcijom u Društvu te trenutačni fokus na početak tijela poruke (lib/utils.ts -> resolveSenderSignoff, lib/hrd-email-system.ts, components/gmail-content.tsx, components/hrd-official-email-composer-dialog.tsx, components/research-inquiries-tab.tsx): prilikom pisanja novog e-maila ili odgovora na postojeći, sustav automatski dodaje ime, prezime i aktivnu funkciju korisnika u Društvu (odnosno ulogu) iznad službenog potpisa te odmah fokusira i pozicionira kursor na početak polja za pisanje poruke."
      },
      {
        type: "novo",
        text: "Automatski arhivski e-mail na rodoslovlje@rodoslovlje.hr pri zatvaranju istraživačkog predmeta (lib/inquiry-close-email.ts, app/api/projects/inquiries/route.ts, components/inquiry-close-case-modal.tsx): pri trajnom zatvaranju predmeta u modulu Istraživanja sustav uz naručitelja i dodijeljenog istraživača automatski šalje potpuni arhivski sažetak (uključujući poduzete radnje, dokumente i rezultate) na adresu rodoslovlje@rodoslovlje.hr, uz podršku u pregledu i [TEST] simulaciji."
      },
      {
        type: "novo",
        text: "Provjera zadovoljstva korisnika za zatvorena istraživanja sa zvjezdicama 1–5, arhivom i statistikom (lib/inquiry-feedback.ts, app/api/projects/inquiries/feedback/route.ts, app/api/public/inquiry-feedback/[token]/route.ts, app/ocjena-istrazivanja/[token]/page.tsx, components/inquiry-feedback-email-modal.tsx, components/inquiry-feedback-stats.tsx): Administrator na svakom zatvorenom predmetu može naručitelju poslati zahvalni e-mail s jednokratnom poveznicom za ocjenjivanje (5 pitanja ocjenom 1–5 zvjezdica, neobavezno pitanje o mogućnosti financijske podrške radu Društva i dodatni komentar). Rezultati se trajno arhiviraju na samom predmetu te agregiraju u kartici „Zadovoljstvo korisnika” u modulu /research i u sažetku na Nadzornoj ploči."
      },
      {
        type: "poboljsanje",
        text: "Nadograđena shema baze podataka (DB_SCHEMA_VERSION = 28, DRIZZLE_SCHEMA_VERSION = 28) novom tablicom inquiry_feedback (uz pokrivenost u JSON izvozu i Dry-Run provjeri sigurnosnih kopija u lib/backup.ts) te proširena lista javnih ruta u AuthGate za /ocjena-istrazivanja/[token]."
      },
      {
        type: "novo",
        text: "Sigurnosna nadogradnja autentifikacije i sesija (lib/password-hash.ts, lib/session-auth.ts): sve lozinke se kriptiraju pomoću Node crypto.scrypt algoritma s nasumičnom soli (uz tihu nadogradnju postojećih zapisa pri prijavi), kolačić sesije (hrd_session) zaštićen je HMAC-SHA256 potpisom u HttpOnly načinu, MemberService.parseMember() više ne vraća polje lozinke prema klijentu (izlaže samo hasPassword i lastLoginAt), a administrativne rute (/api/admin/backup, /api/admin/restore) strogo provjeravaju ulogu na poslužitelju."
      },
      {
        type: "novo",
        text: "Samoposlužni oporavak zaboravljene lozinke („Zaboravili ste lozinku?” na ekranu prijave, app/api/auth/forgot-password/route.ts): član upisuje svoju e-mail adresu, dobiva vremenski ograničenu aktivacijsku poveznicu (/pozivnica/[token], vrijedi 60 minuta) bez otkrivanja postojanja računa u odgovoru i uz ograničenje broja zahtjeva."
      },
      {
        type: "novo",
        text: "Skupno slanje pozivnica i filter statusa pristupa (/members, app/api/admin/notifications/bulk-invitations/route.ts, components/bulk-invitation-dialog.tsx): u izborniku „E-mail i dopune” dodana je akcija „Skupno slanje pozivnica” (vezana na pravo member_action_posalji_pozivnicu) s brzim odabirom nepozvanih aktivnih članova, pregledom uživo i testnim slanjem, te filter „PRISTUP / POZIVNICA” (Nepozvani / Pozvani bez prijave / Aktiviran pristup)."
      },
      {
        type: "poboljsanje",
        text: "Modernizacija svih potvrda i obavijesti u aplikaciji: ugrađen globalni dijalog potvrde (<GlobalConfirmDialog /> putem confirmAction iz components/ui/confirm-dialog.tsx) i sonner toast poruke umjesto sistemskih pregledničkih alert()/confirm() prozora u svim modulima, uz ujednačavanje formata datuma putem formatDateDMY i uklanjanje neaktivnih testnih podataka iz auth-contexta."
      },
      {
        type: "poboljsanje",
        text: "Automatsko zatvaranje modalnih prozora nakon uspješnog izvršenja i odobrenja akcije uz globalni toast prikaz (app/layout.tsx -> Toaster iz sonner): slanje pozivnice, rođendanske čestitke, obavijesti o sjednici/predavanju/glasovanju, obavijesti članovima tijela, podsjetnika za članarinu, zahtjeva za dopunu podataka, službenog e-maila, Gmail odgovora i uvoza članova automatski zatvara prozor odmah po uspješnom završetku (dok testna slanja ostaju otvorena radi provjere)."
      },
      {
        type: "ispravak",
        text: "Ispravljen problem treperenja zaslona nakon postavljanja nove lozinke putem aktivacijske poveznice pozivnice: uklonjeno globalno prebacivanje isLoading stanja u AuthContextu tijekom aktivacije i postavljanja lozinke te osigurano trenutačno preusmjeravanje s /pozivnica/[token] na /."
      },
      {
        type: "novo",
        text: "Automatska prijava putem aktivacijske poveznice pozivnice i postavljanje nove lozinke bez unosa stare lozinke: klikom na poveznicu iz e-mail pozivnice (/pozivnica/[token]) član se automatski prijavljuje u Rodoslovac (app/api/auth/invite-login/route.ts), odmah dobiva ekran za postavljanje nove osobne lozinke bez upisivanja stare ili privremene lozinke (components/password-change-overlay.tsx) uz jasno i nedvosmisleno istaknuto korisničko ime (username / e-poštu) s gumbom za kopiranje, a nakon spremanja lozinke token pozivnice se trajno poništava te se član ubuduće prijavljuje svojim korisničkim imenom i novom lozinkom."
      },
      {
        type: "poboljsanje",
        text: "Nadograđena shema baze podataka (DB_SCHEMA_VERSION = 27, DRIZZLE_SCHEMA_VERSION = 27) stupcima invitation_token i invitation_token_expires_at na tablici members (uključujući skrivanje tokena u MemberService.parseMember(), povrat starijeg backupa i Dry-Run provjeru u lib/backup.ts)."
      },
      {
        type: "novo",
        text: "Potpuno nadograđena kartica grafa na Nadzornoj ploči (components/dashboard-members-chart.tsx) u cjelovitu „Analitiku Društva” s 5 interaktivnih tabova (Novi članovi, Struktura, Članarine €, Dobna struktura, Gradovi i područja istraživanja) putem SectionTabsBar i dinamičnom trakom od 4 sažetne statistike."
      },
      {
        type: "novo",
        text: "Graf prijava novih članova dobio je prekidač razdoblja (6 mj. / 12 mj. / Po godinama), izbor prikaza (Stupci / Krivulja / Kumulativno s ukupnim rastom baze), usporedbu s prošlom godinom, zlatnu liniju prosjeka, spotlight hover efekt, tamnoplavi HRD tooltip te klik na stupac za prikaz popisa točno tih upisanih članova s izravnim linkom na njihov karton."
      },
      {
        type: "novo",
        text: "Dodani pregledi Strukture članstva (prstenasti Donut graf s klikabilnom legendom), mjesečne dinamike Članarina (€ i broj uplata uz usporedbu s prethodnom godinom), Dobne strukture s prosjekom/medijanom dobi i klikom na dobnu skupinu te Top gradova (Zagreb / ostatak RH / inozemstvo) i područja rodoslovnog istraživanja."
      },
      {
        type: "novo",
        text: "Ugrađen brzi izvoz aktivnog grafa u Excel-kompatibilni CSV (UTF-8 BOM sa ;) i visoko-razlučivu PNG sliku s zaglavljem Društva i datumom."
      },
      {
        type: "ispravak",
        text: "Ispravljeno parsiranje datuma upisa (joinDate), rođenja i uplata korištenjem inspectMemberDate kako bi se ispravno uračunali i datumi u formatu DD/MM/YYYY i DD.MM.YYYY."
      }
    ]
  },
  {
    version: "v25.11.2026",
    dateLabel: "25/11/2026",
    title: "Evidencija vanjskih osoba (nisu članovi) u prisutnosti na predavanjima, druženjima i sjednicama",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "poboljsanje",
        text: "Nadzorna ploča i Registar članova (/members): aktivni članovi sada su istaknuti u zasebnoj ravnopravnoj kartici uz ukupni broj članova i broj novih u tekućem mjesecu; klik na aktivne članove vodi na /members?status=active, na tabu Članovi zadano se prikazuju aktivni članovi s brzim prekidačem „Aktivni članovi / Svi članovi”, a gumb „Očisti filtere” jasno je uokviren u nenametljivoj sivo-škriljastoj nijansi."
      },
      {
        type: "novo",
        text: "Istraživanja (/research) — dvostruka potvrda zatvaranja predmeta, trajno zaključavanje, automatske e-mail obavijesti i alat za testiranje: klikom na „Zatvori predmet” otvara se poseban dijalog (components/inquiry-close-case-modal.tsx) s obaveznom drugom potvrdom da nastavak rada više nije moguć. Po zatvaranju predmet se trajno zaključava (samo za uvid), a sustav automatski šalje službeni HRD e-mail dodijeljenom istraživaču i osobi na koju se istraživanje odnosilo s napomenom da u slučaju potrebe za izmjenom ili doradom pošalje novi upit (lib/inquiry-close-email.ts). Ugrađen je i gumb „Testiraj zatvaranje” za pregled izgleda obje poruke te sigurno slanje [TEST] e-mailova sa simulacijom bez zatvaranja predmeta."
      },
      {
        type: "poboljsanje",
        text: "Prerada e-mail obavijesti o događajima (sjednice, predavanja, rodoslovna druženja, gostovanja, radionice, izleti i glasovanja): uklonjeno dvostruko prikazivanje naziva, datuma, lokacije, predavača i potpisa u tijelu poruke; tekst je sada kratak i informativan, osnovni podaci prikazuju se jednom u sažetku, a svi detalji, prilozi i zapisnici jasno se otvaraju nakon prijave u sustav „Rodoslovac” (lib/event-email-templates.ts)."
      },
      {
        type: "poboljsanje",
        text: "Kompletan redizajn i standardizacija izbornika sekcija i kartica (Detalji, Prisutnost, Prilozi, Obavijesti, Glasanja, Obrada) kroz cijelu aplikaciju (components/ui/section-tabs.tsx i components/ui/tabs.tsx): visok kontrast u ugodnoj službenoj HRD plavoj paleti (#264E82 → #1E3A5F sa zlatno-oker #CEA369 obrubom za aktivnu karticu i bijele kartice s plavim tekstom #1E3A5F i #EFF5FB hoverom za neaktivne), ikone, jasni brojači i statusne točkice."
      },
      {
        type: "novo",
        text: "Strukturirane kartice u detaljima predmeta istraživanja (Detalji i upit, Obrada i nalazi, Prilozi, Obavijesti i e-pošta) te potpuna prilagodba svih detaljnih prikaza i modula za mobitel, tablet i laptop (mrežni prikaz 2×2 ili klizna traka sa strelicama za 6+ kartica, minimalna dodirna površina ≥ 44 px, navigacija tipkovnicom) uz novo pravilo u dokumentaciji projekta (Sekcija 10 u AGENTS.md)."
      },
      {
        type: "poboljsanje",
        text: "Crveni brojač nepročitanih e-mailova na ikoni INBOX u izborniku (bočna traka u proširenom i skupljenom prikazu, mobilna navigacija te padajući izbornik „Svi moduli”): prikazuje broj nepročitanih poruka čim ih ima (> 0), uz lagano keširanje i trenutnu sinkronizaciju pri čitanju poruka u modulu /gmail."
      },
      {
        type: "novo",
        text: "Administratorski brojač veličine baza, slika i zauzeća prostora po modulima (/settings i /api/admin/storage-stats): prikazuje stvarnu veličinu na disku za sve tri odvojene SQLite baze (app.db, mailcrawl.db, company_scraper.db uključujući WAL), veličinu slika u uploads/ i ugrađenih Base64 slika u bazi, veličinu dokumenata i privitaka te pregled zauzeća po svakom pojedinom modulu Rodoslovca s pojedinačnim tablicama i popisom najvećih datoteka."
      },
      {
        type: "novo",
        text: "Dodavanje osoba koje nisu članovi društva i nisu u bazi u evidenciju prisutnosti na predavanjima, rodoslovnim druženjima i sjednicama: u tabu Prisutnost omogućen je unos vanjskih sudionika (ime i prezime uz opcionalnu napomenu/ustanovu), kao i brzo dodavanje izravno iz trake za pretraživanje članova."
      },
      {
        type: "poboljsanje",
        text: "Jasno vizualno razlikovanje u sučelju, na karticama, u A4 PDF izvještajima i u Ljetopisu: sve vanjske osobe označene su ljubičastom bojom i oznakom „Nije član” (nasuprot zlatno-oker oznakama članova), ubrajaju se u ukupan broj prisutnih i prikazuju u vlastitim ljubičastim redovima službenih PDF izvještaja (lib/event-pdf.ts)."
      },
      {
        type: "poboljsanje",
        text: "Nadograđena shema baze podataka (DB_SCHEMA_VERSION = 26, DRIZZLE_SCHEMA_VERSION = 26) novim stupcima external_attendees na tablicama lectures i meetings, uključujući automatski povrat starijih backupa i Dry-Run provjeru."
      }
    ]
  },
  {
    version: "v24.11.2026",
    dateLabel: "24/11/2026",
    title: "Ovlasti dodijeljenog istraživača, izravni prijelaz iz Gmaila u Istraživanja i standardizacija akcijskih gumba",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "poboljsanje",
        text: "Izravno preusmjeravanje iz Gmaila u otvoreni predmet u Istraživanjima: klikom na gumb „U istraživanje” (ili „U istraživanju (#id)” te na značku predmeta u popisu e-pošte) poruka se po pravilima prebacuje u Istraživanja i korisnika odmah preusmjerava na /research s automatski otvorenim detaljima tog predmeta za dodjelu, privitke, zabilješke i slanje e-pošte."
      },
      {
        type: "novo",
        text: "Ovlasti dodijeljenog istraživača u modulu Istraživanja (/research) i u Gmailu: član kojem je predmet dodijeljen automatski dobiva pravo pregleda svojih dodijeljenih predmeta (označeni značkom „Moj predmet” i filtrom „Moji predmeti”, uz brojač na Nadzornoj ploči), može učitati privitke više formata (PDF, Word, Excel, PowerPoint, ODT, TXT, CSV, GEDCOM, slike, ZIP) povlačenjem ili odabirom s trenutnim spremanjem u bazu, uređivati sve zabilješke, poduzete radnje, rezultate i odgovore u kronologiji te samostalno zatvoriti i ponovno otvoriti predmet."
      },
      {
        type: "poboljsanje",
        text: "Poslužiteljska zaštita i evidencija za Istraživanja (/api/projects/inquiries i /api/meetings/upload): provjera stvarnih ovlasti putem baze podataka, zaštita od neovlaštenog preuzimanja ili brisanja tuđih predmeta te automatsko bilježenje učitanih privitaka, zatvaranja i ponovnog otvaranja predmeta u dnevnik rada (activity_logs)."
      },
      {
        type: "poboljsanje",
        text: "Uočljiviji gumb „Zatvori predmet” i jasno razlikovanje radnji: zaključivanje predmeta istaknuto je smaragdno zelenom bojom u objedinjenoj gornjoj traci predmeta i u fiksiranom podnožju dijaloga, dok gumb za zatvaranje samog dijaloga nosi nedvosmislen naziv „Zatvori prozor”."
      },
      {
        type: "poboljsanje",
        text: "Standardizacija položaja, redoslijeda i visokog kontrasta akcijskih gumba kroz cijelu aplikaciju (Spremi/Snimi, Zatvori predmet/Završi, Zatvori prozor/Odustani, Obriši): uveden zajednički sustav (components/ui/action-bar.tsx) s fiksnim podnožjem u svim modalima i na ekranu kartona člana (/members/[id]) te dodana Sekcija 9 u pravila projekta (AGENTS.md)."
      }
    ]
  },
  {
    version: "v23.11.2026",
    dateLabel: "23/11/2026",
    title: "Privitci datoteka u e-mail obavijestima članovima tijela Društva",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "novo",
        text: "Dodana mogućnost prilaganja datoteka (attachmenta) kod slanja e-mail obavijesti svim članovima tijela Društva (Izvršni odbor, Nadzorni odbor, Sud časti): u dijalogu obavijesti podržan je odabir više datoteka klikom ili povlačenjem (drag-and-drop) za PDF, Word, Excel, PowerPoint, ODT, TXT, CSV, slike i ZIP arhive (do 10 datoteka, maks. 15 MB po datoteci i 20 MB ukupno)."
      },
      {
        type: "novo",
        text: "Priložene datoteke šalju se uz testni e-mail i uz stvarno skupno slanje (uz očuvanje ugrađenog HRD logotipa u potpisu), prikazuju se u živom HTML pregledu e-maila i u bloku „Podaci o obavijesti”, a trajno se pohranjuju u UPLOAD_FOLDER te u novi stupac board_announcements.attachments (uz podršku u Povijesti slanja za pregled, preuzimanje pod izvornim imenom i ponovno korištenje putem gumba „Kopiraj u novu”)."
      },
      {
        type: "poboljsanje",
        text: "Nadograđena shema baze podataka (DB_SCHEMA_VERSION = 25, DRIZZLE_SCHEMA_VERSION = 25), automatski povrat starijih backupa (restoreDatabase), Dry-Run provjera sigurnosne kopije (provjera stupca board_announcements.attachments i referentnih datoteka u uploads/) te pojačano posluživanje privitaka u /api/uploads/[filename] uz Content-Disposition preuzimanje."
      }
    ]
  },
  {
    version: "v21.11.2026",
    dateLabel: "21/11/2026",
    title: "Ubrzani modul Donacije i kampanje (Serper.dev, Tavily, Firecrawl, skupno slanje), brojač poslanih mailova uživo i Ljetopis društva",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "novo",
        text: "Podrška za Tavily Search (1.000 besplatnih kredita mjesečno) i Firecrawl (1.000 besplatnih kredita mjesečno) kao pametna kaskada u modulu Donacije i kampanje: pretraga koristi Serper.dev → Tavily Search → besplatni paralelni web, dok Firecrawl automatski čita samo JS/Wix/anti-bot blokirane stranice (maks. 2 paralelna zahtjeva, maks. 1 kredit po stranici) uz gumbe za testiranje u Postavkama kampanje."
      },
      {
        type: "novo",
        text: "Podrška za Serper.dev Google Search & Places API u modulu Donacije i kampanje (/admin/donations): brzo pronalaženje službenih web-stranica tvrtki i obrta, paralelni crawler (do 6 stranica istovremeno, jednokratno parsiranje HTML-a, brza provjera podstranica) te DNS/MX provjera domene prikupljenih e-mail adresa."
      },
      {
        type: "poboljsanje",
        text: "Ubrzano generiranje pojmova i pretraga kontakata: novi trenutni način „Brzi katalog (0 s)” uz 120+ pojmova u 10 niša i 60 hrvatskih gradova, odabir pripreme teksta u serijskoj pretrazi (Samo adrese, Brzi predložak ili Gemini AI paralelno), gumb „Zaustavi pretragu” uz prikaz napretka, višelinijski unos do 50 URL-ova odjednom te premještanje sporijeg Croatia.biz kataloga u opcijski izvor."
      },
      {
        type: "novo",
        text: "Skupno slanje donacijskih zamolbi i podsjetnika s anti-spam zaštitom: višestruki odabir i brzi odabir (Prvih 10 / 25 / 50 / Spremni nacrti), pregled prije slanja (Preflight) s obveznim testnim uzorkom, zadani sigurni razmak od 3,5 s (+ jitter), dnevni limit (150/dan), pooled SMTP konekcija, automatsko zaustavljanje nakon 3 uzastopne greške, Excel/CSV uvoz (Uvoz Excel/CSV), .xlsx izvoz i trajna lista odjava (Ne kontaktirati)."
      },
      {
        type: "novo",
        text: "Brojač poslanih mailova uživo (Poslano: X / Y) na svim mjestima u aplikaciji gdje se šalje više e-mailova odjednom: skupno slanje i podsjetnici u Donacijama, priprema nacrta, skupni podsjetnici za članarinu, zahtjevi za dopunu podataka, obavijesti tijelima društva, pozivi na sjednice i predavanja te pozivi za e-glasovanje — uz traku napretka, postotak, trenutnog primatelja, procijenjeno preostalo vrijeme i gumb za zaustavljanje."
      },
      {
        type: "ispravak",
        text: "Ispravljeno ponovno slanje iz registra poslanih mailova (/sent-registry/[id]/resend), renderiranje objekata u povijesti slanja, dodana administratorska zaštita na sve /api/admin/mailcrawl/* rute, uklonjen globalni TLS override i objedinjene postavke donacija između kartice Postavke i modula Donacije."
      },
      {
        type: "poboljsanje",
        text: "Redizajniran modul Ljetopis društva (/chronicle) kao poslužiteljski generator provjerenih podataka u pripovjednom (kroničarskom) stilu za bilo koje odabrano razdoblje (tekuća godina, prethodna godina, zadnjih 12 mjeseci, pojedinačna godina, prilagođeni raspon datuma ili cjelokupna povijest)."
      },
      {
        type: "novo",
        text: "Sjedinjeni provjereni izvori iz baze app.db uz zaštitu privatnosti: sjednice i skupštine, predavanja i gradovi gostovanja, projekti, godišnji sažeci upisa novih članova, mandati tijela Društva, In memoriam, rodoslovni upiti, prirast knjižnice po datumu unosa (created_at), prikupljanje građe u Arhivu, e-glasovanja i obavijesti tijelima — bez uplatnica, OIB-a i privatnih kontakata, uz navođenje izvora (sourceRef) uz svaki zapis."
      },
      {
        type: "novo",
        text: "Dodani namjenski prilozi i izvozi za buduću spomenicu i monografiju: Uvodni pripovjedni sažetak razdoblja, pregled po godinama i tematskim cjelinama, tablice Tijela i mandata, Popis predavanja, Novoupisani i Počasni članovi, In memoriam, Kazalo spomenutih osoba, izvoz knjižnog PDF-a s ugrađenim hrvatskim TrueType fontovima (/api/chronicle/pdf), Word (.doc) rukopis za lektora te čisti tekst (.txt)."
      }
    ]
  },
  {
    version: "v20.11.2026",
    dateLabel: "20/11/2026",
    title: "Zabrana kontakta (Ne kontaktirati), Arhiv, obavijesti tijelima i testiranje backupa",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "poboljsanje",
        text: "Jednokratne poveznice za dopunu podataka člana (strogi 1 pristup) i automatsko čišćenje iskorištenih tokena: svaki novo poslani e-mail za dopunu podataka generira novu poveznicu ograničenu isključivo na jedan (1) pristup (uz obaveznu istaknutu napomenu u e-mailu i na obrascu), blokira svaki ponovljeni pristup ili izmjenu nakon upotrebe/predaje (HTTP 410 + zapis u Dnevnik rada), automatski briše data_form_token svih članova koji su već predali podatke (uz očuvanje datuma predaje u evidenciji), dok neiskorištene poveznice članova koji još nisu predali podatke ostaju važeće sve do predaje."
      },
      {
        type: "poboljsanje",
        text: "Postavljen službeni HRD favicon i ikone aplikacije s grbom društva (višerezolucijski favicon.ico, PNG 16×16 / 32×32 / 192×192 / 512×512, SVG, Apple Touch Icon i PWA manifest) usklađene s paletom sustava (#FBF9F6 / #CEA369 / #1B2B36)."
      },
      {
        type: "novo",
        text: "Dodana opcija „Ne kontaktirati” na izričit zahtjev člana (stupci do_not_contact, do_not_contact_date i do_not_contact_note u app.db): kada je označena u kartonu člana (/members/[id] ili u skočnom prikazu), sustav u potpunosti blokira slanje svih e-mailova (pozivnica, podsjetnika za plaćanje, zamolbi za dopunu podataka, rođendanskih čestitki, obavijesti tijelima društva, sjednica/predavanja, glasovanja, ručnih poruka, Gmaila, istraživanja i kampanja donacija) na klijentskoj i poslužiteljskoj razini (lib/do-not-contact.ts). U tablici članova, kartonu, modulu Arhiv (/archive), Nadzornoj ploči i PDF ispisu jasno je istaknuta crvena napomena da je član na izričitu napomenu zatražio da ga se ne kontaktira te su uklonjeni klikabilni mailto/tel linkovi i akcijski gumbi."
      },
      {
        type: "poboljsanje",
        text: "Puna dvosmjerna povezanost između modula Arhiv (/archive) i kartona detalja člana (/members/[id]): podaci dopunjeni putem gumba „DOPUNI PODATKE” u Arhivu trenutno osvježavaju i memoriju popisa članova (bez predmemorije na /api/members), a u kartonu detalja člana sada se izravno prikazuje i povezani status iz Arhiva (Kontaktiran Da/Ne, Kada je kontaktiran, Rezultat kontakta i Napomena za preuzimanje građe)."
      },
      {
        type: "novo",
        text: "Aktiviran modul Arhiv (/archive) i nova tablica archive_member_contacts u bazi app.db: donosi inline popis svih članova društva (uključujući i preminule radi kontakta s obitelji/nasljednicima) s ograničenim prikazom podataka (samo ime, prezime i kontakt podaci, bez poveznice na karton s imena člana), uz inline uređivanje polja Kontaktiran (Da/Ne), Kada je kontaktiran (DD/MM/YYYY), Rezultat kontakta (Građa dogovorena, Građa preuzeta, itd.) i slobodnu Napomenu tko i kada preuzima građu, brze KPI filtre, CSV izvoz, gumb „DOPUNI PODATKE” za skočni unos isključivo sekcija Osobni podaci i rođenje te Kontakt i prebivalište (SPREMI I ZATVORI), provjeru prava pristupa na klijentu i API-ju te potpunu pokrivenost u backupu i Dry-Run simulaciji."
      },
      {
        type: "novo",
        text: "Slanje unificiranih e-mail obavijesti isključivo trenutnom sastavu tijela društva (/api/board/announcement): s Nadzorne ploče (Oglasna ploča odbora i brzi prečaci), kartice „Odbor i Povijest funkcija” u Članovima te iz modula Sjednice omogućeno je pisanje i slanje važnih informacija svim aktivnim nositeljima funkcija u društvu uz unificirano HRD zaglavlje (#1E3A5F / #D97706), službeni potpis, jasno istaknuto tko je i s kojom dužnosti podijelio obavijest, pregled HTML izgleda uživo, opciju slanja testnog e-maila te automatsku evidenciju u Dnevnik rada."
      },
      {
        type: "novo",
        text: "Trajna arhiva i povijest poslanih obavijesti članovima tijela Društva (nova tablica board_announcements u app.db): svaka poslana obavijest trajno sprema tko ju je poslao, datum i vrijeme slanja (DD/MM/YYYY HH:mm), predmet, puni tekst poruke, HTML pregled te poimenični popis primatelja s e-mail adresom, funkcijom i statusom dostave. Povijest je vidljiva u novoj kartici „Povijest slanja” unutar dijaloga obavijesti, na Nadzornoj ploči, u Sjednicama te izravno na kartici „Ustroj i funkcije u društvu” (uklj. prikaz ranijih slanja iz activity_logs i pokrivenost u backupu/Dry-Runu)."
      },
      {
        type: "novo",
        text: "Redizajnirani kartični sustav „Pristup aplikaciji” i ovlast za „Obavijest članovima tijela”: u kartonu člana (/members/[id]) i u Postavkama sustava (/settings) uvedeno je jedinstveno kartično sučelje s opisima svih 20 modula u 4 logičke cjeline, brzim gumbima („Samo pregled”, „Odobri sve”, „Zabrani sve”) te 10 pojedinačnih alata/akcija uključujući novu ovlast „Obavijest članovima tijela” (provjeravanu na klijentu i API-ju). Ujedno je omogućeno pojedinačno dodjeljivanje Izvješća, Logova i Ljetopisa bilo kojem članu kroz bočni izbornik, gornju traku i Ctrl+K pretragu."
      },
      {
        type: "poboljsanje",
        text: "Nadograđen sustav sigurnosnih kopija, povrata (Restore) i Dry-Run simulacije (/api/settings/backup/simulate, /api/admin/backup): paketiranje koristi centralne putanje odvojenih baza (app.db, mailcrawl.db, company_scraper.db) iz lib/db-path.ts, Dry-Run provjerava odvojenost baza, integritet sve 3 baze, kritične stupce sheme, tablicu company_scraper_checkpoints i privitke autorskih prava knjižnice, JSON izvoz sada uključuje i trash_items te company_scraper_checkpoints, a restoreDatabase automatski nadopunjuje sve novije stupce i tablice."
      },
      {
        type: "poboljsanje",
        text: "Trajno dokumentirana pravila rada, paleta boja (UI, e-mail i PDF), poslovna pravila te obvezne provjere backupa, odvojenosti baza i prava pristupa za svaku buduću funkcionalnost u datoteci AGENTS.md."
      },
      {
        type: "poboljsanje",
        text: "Ažuriran službeni predložak e-mail obavijesti članovima tijela Društva (Izvršnog odbora, Nadzornog odbora i Suda časti) s naslovom „Obavijest o poruci poslanoj putem sustava Rodoslovac”, istaknutim umetnutim tekstom poruke, blokom „Podaci o obavijesti:” (Pošiljatelj, Datum i vrijeme slanja) te standardiziranim zaglavljem i potpisom."
      },
      {
        type: "ispravak",
        text: "Ispravljena greška pri otvaranju detaljnog kartona člana (/members/[id]): React.useMemo za prava pristupa premješten je prije ranog uvjetnog povratka komponente čime je uklonjeno rušenje prikaza člana (React Rules of Hooks)."
      }
    ]
  },
  {
    version: "v19.11.2026",
    dateLabel: "19/11/2026",
    title: "Kronološko praćenje odgovora u istraživanjima, brzi podsjetnik za članarinu i ugrađeni TrueType fontovi u PDF-u",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "novo",
        text: "Kronološki tijek i evidencija odgovora na provjeru statusa u modulu Upiti i istraživanja: kod poslanih e-mailova za provjeru statusa predmeta (i putem gumba „Evidentiraj odgovor osobe”) sada je moguće unijeti datum odgovora osobe i detaljno opravdanje zašto je predmet još otvoren, uz cjeloviti kronološki prikaz od zaprimanja upita, dodjele istraživaču i svih poslanih mailova do zaprimljenih odgovora te pregledne oznake na karticama upita."
      },
      {
        type: "novo",
        text: "Brza ikona za slanje podsjetnika za plaćanje u Registru članova: u tabličnom i mobilnom prikazu popisa članova dodana je ikona (€) za otvaranje pojedinačnog dijaloga podsjetnika za plaćanje, koja se prikazuje isključivo članovima s upisanom e-mail adresom koji imaju evidentiran dug ili su ispisani (osim preminulih), uz ispravan prikaz statusa i datuma zadnje uplate."
      },
      {
        type: "poboljsanje",
        text: "Automatsko sakrivanje oznake i ikone podsjetnika nakon evidentirane uplate u Registru članova: kada je nakon slanja podsjetnika evidentirana nova uplata ili je podmirena članarina za tekuće/posljednje razdoblje, u pregledu svih članova više se ne prikazuju oznaka poslanog podsjetnika ni ikona (€) za slanje podsjetnika (ikona ostaje vidljiva samo kod članova u statusu DUG ili ISPISAN), dok u detaljima pojedinog člana ostaje trajna evidencija kada je podsjetnik poslan."
      },
      {
        type: "poboljsanje",
        text: "Pojedinačna oznaka za dopunu podataka u Registru članova: umjesto ikone za pozivnicu u retku člana (i na mobilnim karticama) sada se svim članovima s upisanom e-mail adresom koji imaju nepotpun profil (uključujući ispisane i neaktivne, isključujući samo umrle) prikazuje oznaka s brojem polja koja nedostaju (FileText + broj), klikom na koju se otvara dijalog za pojedinačno slanje linka i PDF kartona za dopunu podataka, dok je skupna opcija slanja u izborniku „E-mail i dopune” zadržana nepromijenjena i također uključuje sve osim umrlih."
      },
      {
        type: "poboljsanje",
        text: "Razdvojeni moduli „Projekti” (/projects) i „Istraživanja” (/research): Projekti i Upiti/istraživanja sada su odvojeni u dvije samostalne stavke u bočnom izborniku, vršnoj navigaciji, brzom pretraživanju (Ctrl+K), brzim prečacima Nadzorne ploče i zaštiti ruta (ProtectedRoute) s neovisnim pravima pristupa, dok stare poveznice (/projects?tab=inquiries) automatski preusmjeravaju na /research."
      },
      {
        type: "poboljsanje",
        text: "Sveobuhvatno ubrzanje pokretanja i rada aplikacije uz povećanu sigurnost: slike postavki (logo, uplatnica, QR barkod) sada se poslužuju putem ETag-keširanog resursa /api/settings/asset umjesto u 777 KB JSON-u na svakom osvježavanju; javne postavke (/api/settings?scope=lite) više ne izlažu lozinke ni pristupne ključeve pregledniku; uveden je mikro-endpoint /api/system/status (~150 B) i /api/auth/me; globalni konteksti (Knjižnica, Projekti, Adresar, Linkovi, Sjednice, Predavanja, Dnevnik aktivnosti, Članovi) učitavaju se tek nakon prijave i po potrebi na ruti ili otvaranju Ctrl+K pretrage; uklonjen je blokirajući ekran pri provjeri anketa uz deduplikaciju poziva /api/polls; sažetak Nadzorne ploče učitava lokalnu bazu odmah a Gmail asinkrono s 2-minutnim kešom; uvedeni su SQLite WAL/busy_timeout/NORMAL/cache pragme, 13 novih indeksa baze, jednokratne migracije (PRAGMA user_version) i dinamičko učitavanje grafikona."
      },
      {
        type: "ispravak",
        text: "Ispravljen prikaz hrvatskih znakova (č, ć, ž, š, đ, Č, Ć, Ž, Š, Đ) i prijelom riječi u svim PDF dokumentima (izvješća, sjednice/predavanja i evidencijski list člana): umjesto neugrađenog standardnog Helvetica fonta koji je u pojedinim preglednicima lomio i krivo širio hrvatske znakove, u sve generirane PDF-ove sada se ugrađuju TrueType fontovi s točnim tablicama širina glifova, /ToUnicode CMap tablicom, NFC normalizacijom i ispravnim čišćenjem slova đ/Đ u nazivima PDF datoteka."
      }
    ]
  },
  {
    version: "v18.11.2026",
    dateLabel: "18/11/2026",
    title: "Sustav zaštite podataka „Smeće” (Trash), potpuna evidencija brisanja i Undelete povrat",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "novo",
        text: "Globalno „Smeće” (Trash / Recycle Bin) na ruti /trash dostupno isključivo Administratoru: svaka stavka koju bilo koji korisnik (administrator, moderator ili član) obriše u sustavu više se ne briše nepovratno, nego se premješta u tablicu trash_items s potpunom snimkom zapisa, povezanih tablica (prisutnost, glasovi, uplate, kontakti knjižnica) te podatkom tko je i kada izvršio brisanje."
      },
      {
        type: "novo",
        text: "Potpuna pokrivenost svih modula i podstavki: članovi (i skupno čišćenje uplata), predavanja/događaji, sjednice (i točke dnevnog reda), projekti (zapisi i doprinositelji), upiti i istraživanja, knjige i časopisi knjižnice, vanjske knjižnice i dnevnici kontakata, adresar, korisni linkovi, glasovanja/ankete, prilozi i dokumenti, trezor lozinki, Mailcrawl donacijski kontakti, osobni zadaci (To-Do), Google Drive datoteke/mape te Inbox e-mail poruke i Gmail predlošci."
      },
      {
        type: "novo",
        text: "Mogućnost povratka (Undelete) jednim klikom za Administratora: u modulu Smeće administrator može filtrirati obrisane stavke po vrsti, korisniku ili pretrazi, pregledati cjelovite pohranjene podatke (Detalji) te jednim klikom vratiti bilo koju obrisanu stavku natrag u aktivnu bazu (uključujući i Google Drive / Gmail povrat)."
      },
      {
        type: "poboljsanje",
        text: "Sigurnosno ograničenje prikaza smeća u INBOX-u (Gmail) i automatska sinkronizacija identiteta korisnika: mapa „Smeće” u Gmail sučelju i pripadajući API zahtjevi ograničeni su isključivo na administratora, a podaci o aktivnom korisniku automatski se prenose u svakom API zahtjevu radi pouzdane revizijske evidencije."
      },
      {
        type: "ispravak",
        text: "Ispravljeno sortiranje, pretraga i prikaz statusa članova nakon uređivanja podataka (npr. Paula br. 010): članovi bez evidentiranih uplata više ne prelaze automatski u status 'Ispisan/a' samo zbog upisanog povijesnog datuma učlanjenja te ostaju poredani po svom broju matice/prijavnice na pripadajućim stranicama (kao i u Excel izvozu). Proširena je pretraga po broju matice/prijavnice i ispravljeno parsiranje uvezenih datuma uplata (npr. '12. 06. 2025.: 10€') te prikaz datuma rođenja i upisa u kartonu člana."
      },
      {
        type: "novo",
        text: "Zaštita od dvostrukog unosa članova i brzi pregled postojećih duplikata: prilikom dodavanja ili izmjene člana sustav automatski provjerava podudaranja po imenu i prezimenu (uključujući zamijenjeni redoslijed riječi), e-mailu, OIB-u te broju matice/prijavnice i prikazuje upozorenje uz popis pronađenih zapisa te traži izričitu potvrdu da nije riječ o duplikatu. U Registar članova dodan je i brzi filter gumb 'DUPLIKATI' za trenutni pronalazak i rješavanje postojećih duplih zapisa."
      },
      {
        type: "novo",
        text: "Način održavanja / Ažuriranje sustava (Samo za administratora): u Postavkama (kartica Opće) dodana je administratorska opcija zaključavanja cijele aplikacije za sve korisnike osim administratora. Kada je opcija uključena, svim ostalim prijavljenim ili neprijavljenim korisnicima (uključujući ekran prijave i online formu za dopunu podataka) aplikacija je blokirana uz jasnu obavijest „Sustav se trenutno ažurira i nije mu moguće pristupiti. Kontaktirajte administratora.”, dok administrator normalno koristi sustav uz stalnu gornju traku s brzim gumbom za isključivanje."
      },
      {
        type: "ispravak",
        text: "Otklonjen pozadinski refresh i gubitak upisanih podataka prilikom uređivanja člana: periodička sinkronizacija postavki više ne stvara nepotrebne nove reference kada se podaci nisu promijenili, izračun članova ovisi isključivo o pragovima članarine, a karton člana (/members/[id] i modalni prozor) više nikada ne poništava aktivno uređivanje ni unesena polja."
      },
      {
        type: "novo",
        text: "Kontrola nespremljenih promjena pri prelasku na drugi modul: ako je uređivanje kartona člana (ili unos uplate/funkcije) u tijeku, sustav presreće odlazak na drugi modul u izborniku, klik na gumb Natrag i zatvaranje kartice te prikazuje upozorenje s mogućnošću direktnog spremanja, nastavka uređivanja ili odbacivanja izmjena."
      },
      {
        type: "novo",
        text: "Pojedinačne ovlasti nad alatima u modulu Članovi: dodana je zasebna cjelina s 9 pojedinačno odobrivih funkcija (Zatraži dopunu, Pošalji pozivnicu, Pošalji rođendanske čestitke, Duplikati, Krivi datumi, Čišćenje datuma i uplata, Dopuna podataka, Uvezi članove, Obavijesti za plaćanje) u kartonu člana i u Postavkama → Prava pristupa i Ovlasti, dok Administrator uvijek ima potpuna prava na sve."
      },
      {
        type: "novo",
        text: "Sigurnosna kontrola neaktivnosti Administratora: u Postavkama → Sigurnost i Kontinuitet dodana je opcija definiranja praga u danima; ako se Administrator ne prijavi u sustav zadani broj dana, sustav automatski šalje e-mail s administratorskim pristupnim podacima (korisničko ime i lozinka) svim aktivnim članovima tijela društva."
      },
      {
        type: "poboljsanje",
        text: "Potpuno restrukturiranje modula Postavke (/settings): sve administrativne opcije sada su pregledno objedinjene na jednom mjestu u 9 logičkih cjelina (Sustav i Upravljanje s Oglasnom pločom i brzim alatima baze, Članstvo/Sjednice/Projekti, Prava pristupa i Ovlasti s izravnim uređivanjem, E-mail i Predlošci bez dupliranja, Donacije/HUB-3A/AI, Google Workspace, Sigurnosna kopija i Povrat, Sigurnost i Kontinuitet te Trezor lozinki)."
      },
      {
        type: "novo",
        text: "Globalna brza tražilica (Ctrl+K / povećalo) i čisto zaglavlje bez dupliciranja: umjesto ponavljanja svih 18 poveznica u gornjoj traci na računalu, zaglavlje sada prikazuje trenutno aktivni modul, brzu pretragu kroz sve članove, sjednice, predavanja, knjižnicu, projekte i module, najčešće prečace i padajući izbornik „Svi moduli”, dok se lijeva bočna traka na računalu može skupiti jednim klikom za više prostora kod rada s tablicama."
      },
      {
        type: "poboljsanje",
        text: "Optimizacija za mobitel i tablet: uklonjeno je fiksno podnožje s mobilnog zaslona (linkovi na Priručnik i Changelog premješteni su u mobilni izbornik „Više”), na kartonu člana dodani su mobilni izbornik „Akcije” (PDF karton, Zatraži dopunu, Pozivnica, Ispiši) i fiksna donja traka „Odustani / Spremi izmjene” tijekom uređivanja, a Knjižnica i Smeće dobili su pregledne mobilne kartice bez potrebe za vodoravnim klizanjem."
      },
      {
        type: "poboljsanje",
        text: "Ubrzanje aplikacije i preglednija alatna traka: odgođeno učitavanje teških modula (Knjižnica, Projekti, Adresar, Linkovi) i lagani početni dohvat dnevnika rada znatno ubrzavaju otvaranje na računalu i mobitelu, pretrage u Registru članova i Knjižnici koriste React useDeferredValue za glatko tipkanje, gumbi u Registru članova grupirani su u padajuće izbornike „E-mail i dopune” i „Alati baze”, a zaštita nespremljenih promjena (UnsavedChangesGuard) proširena je na Sjednice, Projekte i Knjižnicu."
      },
      {
        type: "ispravak",
        text: "Usklađena poslužiteljska (API) provjera pojedinačnih ovlasti u /api/members tako da članovi s odobrenim pravom za „Krivi datumi” ili „Čišćenje datuma i uplata” mogu i spremiti skupne izmjene bez ograničenja isključivo na administratorsku ulogu."
      },
      {
        type: "ispravak",
        text: "Ispravljen unos polja „Datum upisa u društvo” (te datuma rođenja, smrti i ispisa) u pravi datumski unos formata DD/MM/YYYY: u dijalogu novog člana, kartonu člana i online formi za dopunu podataka polje više nije običan slobodni tekst nego automatski formatirani datumski unos (znamenke + kalendar s odabirom) uz provjeru valjanosti kalendarskog datuma i normalizaciju pri spremanju u bazu."
      }
    ]
  },
  {
    version: "v16.11.2026",
    dateLabel: "16/11/2026",
    title: "Prošireni i logički presloženi podaci člana uz punu širinu prikaza",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "novo",
        text: "Dodana opcija slanja e-maila za provjeru statusa u Upitima i istraživanjima: za predmete koji su dodijeljeni istraživaču, a još nisu završeni, omogućen je novi predložak s toplim tekstom upita podnositelju (podsjetnik da su kontaktirani od strane predloženog istraživača, upit o tijeku komunikacije i molba za javljanje ako su odustali radi urednog zatvaranja predmeta), uz zadržavanje standardiziranog HRD izgleda, donacijskog bloka, potpisa, testnog slanja i evidencije u INBOX-u."
      },
      {
        type: "novo",
        text: "Određivanje godine članarine kod uplata članova (unaprijed/unatrag): u kartonu člana dodana je opcija 'Za godinu (članarina)' prilikom unosa ili uređivanja uplate, kao i prikaz u tablici 'Povijest uplata' i Excel izvozu. Ako je godina određena (npr. uplata u 2024. za 2025. godinu), status članstva računa se prema odabranoj godini pokrića, dok sve postojeće ranije evidentirane uplate ostaju nepromijenjene."
      },
      {
        type: "ispravak",
        text: "Ispravak greške u Izvješćima (/reports): izdvojeni su podaci o promjenama (CHANGELOG_DATA) iz klijentske komponente u zajednički modul lib/changelog-data.ts, čime je otklonjena greška 'CHANGELOG_DATA.filter is not a function' prilikom generiranja periodičkog izvješća na poslužitelju."
      },
      {
        type: "novo",
        text: "HRD standardizirani vizualni identitet i jedinstveni HTML sustav za e-mail komunikaciju: implementirana je službena HRD paleta boja (#1E3A5F Institucionalna tamnoplava, #7C2D12 Tamna terakota, #D97706 Zlatno-narančasta, #1F2937 Grafitna, #1F77C5 Plava poveznica, #FFFFFF Bijela, #F8FAFC Svijetlosiva, #FEFCE8 Svijetla krem, #E2E8F0 Svijetlosiva za rubove), zajedničko zaglavlje (#1E3A5F s linijom #D97706 bez logotipa u zaglavlju), automatski službeni potpis u podnožju te pregled predloška prije slanja i slanje testnog e-maila na mail administratora ili drugi mail u svim e-mail modulima."
      },
      {
        type: "poboljsanje",
        text: "Prošireno Izvješće o radu Društva (/reports) i kompletirane post-restore migracije Backupa: u izvješće (ekran, tekst za zapisnik i A4 PDF) dodan je pregled prikupljenih podataka članova putem online forme, statistika popunjenosti matične knjige, pregled projekata, upita, knjižnice i glasovanja te automatski ispis svih promjena napravljenih u aplikaciji (Changelog) u traženom razdoblju."
      },
      {
        type: "novo",
        text: "Personalizirana online forma za samostalnu dopunu podataka člana (/dopuna-podataka/[token]), praćenje statusa i prikaz u 'Što je novo': svakom odabranom članu šalje se jedinstveni link u e-mailu (uz PDF karton). Član bez prijave dopunjuje svoja polja koja nedostaju (Osobni podaci i rođenje, Kontakt i prebivalište, Zanimanje/vještine/rodoslovna istraživanja te Datum upisa u društvo), podaci se automatski upisuju u bazu, a sustav evidentira kada je forma poslana, pogledana i predana te to prikazuje pri prijavi u prozoru 'Što je novo u društvu?'."
      },
      {
        type: "poboljsanje",
        text: "Intuitivnije slanje zamolbe za dopunu podataka: gumb 'Dopuna podataka (Link + PDF)' dodan je izravno u alatnu traku Registra članova (povezan s označenim članovima) i kao gumb 'Zatraži dopunu' u fiksno zaglavlje kartona člana."
      },
      {
        type: "novo",
        text: "PDF evidencijski list člana i slanje personaliziranih e-mailova za dopunu podataka: u zaglavlju kartona člana dodan je gumb 'PDF karton' za preuzimanje evidencijskog lista, a u Postavkama administratora (pod E-mail predlošci) omogućen je odabir članova kojima se šalje personalizirani e-mail s točnim popisom polja koja pojedinom članu nedostaju i njegovim PDF kartonom u privitku."
      },
      {
        type: "poboljsanje",
        text: "Fiksno zaglavlje u kartonu člana i ujednačen format datuma rođenja: naslovni dio kartona člana (ime, status, pozivnica, PDF karton, ispiši i uredi) sada je trajno pričvršćen na vrhu ekrana dok se ostatak kartona skrola, a polje Datum rođenja koristi isti kalendarski unos i format DD/MM/YYYY kao i Datum upisa u društvo."
      },
      {
        type: "ispravak",
        text: "Poboljšan kontrast i čitljivost upisanih podataka u poljima za pregled (Input i Textarea): uklonjeno je posvjetljivanje teksta (opacity-50) u načinu samo za čitanje kako bi svi upisani podaci o članu i u ostalim modulima bili potpuno tamni i jasno vidljivi."
      },
      {
        type: "novo",
        text: "Dodana nova polja u evidenciju člana: Djevojačko prezime, OIB, Mjesto rođenja, Zemlja rođenja, Telefon (fiksni uz postojeći Mobitel), Zvanje i zanimanje, Radno iskustvo, Hobi/vještine i znanja, Strani jezici te vidljivo i uređivo polje Lokacije i prezimena koja istražuje."
      },
      {
        type: "poboljsanje",
        text: "Logički presložen karton člana i obrazac za upis novog člana u 4 jasne cjeline (Osobni podaci i rođenje, Kontakt i prebivalište, Zanimanje/vještine/rodoslovna istraživanja, Matični podaci i posebni statusi) uz iskorištenu punu širinu ekrana."
      },
      {
        type: "poboljsanje",
        text: "Proširena tražilica članova te Excel/CSV izvoz i uvoz kako bi obuhvatili sva nova polja."
      }
    ]
  },
  {
    version: "v15.11.2026",
    dateLabel: "15/11/2026",
    title: "Širi prikaz detalja (Sjednice, Adresar, Predavanja), stalni izbornik i administratorski alat za čišćenje datuma i uplata",
    badge: "Izdanje 15.11.2026",
    changes: [
      {
        type: "poboljsanje",
        text: "Potpuno preuređen i opširno proširen Korisnički priručnik (/manual): izrađen je cjeloviti edukacijski vodič kroz svih 17 poglavlja sustava s brzim uvodom za nove korisnike u 5 pravila, detaljnim koracima i natuknicama za svaki modul (prva prijava, prozor 'Što je novo', matična knjiga članova, značenje statusa/medalja/preminulih, pragovi članstva, pozivnice, opomene i rođendanske čestitke, čišćenje baze i 01/01/2007, sjednice, predavanja, knjižnica, projekti i rodoslovni upiti, arhiv, INBOX, donacije, izvješća, postavke i backup), sekcijom Često postavljanih pitanja (FAQ) te opcijama proširivanja/sažimanja poglavlja i ispisa priručnika."
      },
      {
        type: "novo",
        text: "Rođendanska e-mail čestitka članovima: dodana je opcija slanja prigodne rođendanske čestitke putem e-pošte (iz prozora 'Što je novo', popisa članova i kartona člana), uz obavezni pregled i uređivanje predloška prije odobrenja i slanja te trajno bilježenje datuma i vremena slanja u evidenciji člana i dnevniku aktivnosti."
      },
      {
        type: "poboljsanje",
        text: "Registar članova: uklonjene su donje informativne kartice ('Stopa rasta', 'Godišnja skupština' i 'Hitan zadatak') s dna popisa članova radi preglednijeg prikaza."
      },
      {
        type: "novo",
        text: "Pragovi članstva — novo pravilo za članove bez uplata: u Postavkama pod 'Pragovi članstva' dodana je opcija (checkbox) kojom se određuje da član bez ijedne upisane uplate članarine ne može biti aktivan član, neovisno o datumu upisa u društvo. Od ovog pravila izuzeti su samo počasni članovi i članovi oslobođeni plaćanja članarine."
      },
      {
        type: "novo",
        text: "Nadolazeći rođendani u prozoru 'Što je novo u društvu?': prilikom prijave u sustav sada se automatski prikazuje i popis članova kojima je rođendan u narednih 15 dana (s datumom i brojem preostalih dana)."
      },
      {
        type: "ispravak",
        text: "Prikaz počasnog člana, preminulih članova i aktivnih uloga u Registru članova: u stupcu 'Uloga' (i na mobilnim karticama) prikazuju se samo trenutno aktivne uloge uz kompaktne vizualne oznake — ikonu medalje za počasne članove (bez teksta radi preglednosti) i crni križ (✝) uz sivi transparentni overlay preko cijelog retka/kartice za preminule članove."
      },
      {
        type: "poboljsanje",
        text: "Širi prikaz detalja sjednica, adresara i predavanja: prilikom otvaranja pojedine stavke u modulima Sjednice i glasovanje, Adresar i Predavanja/druženja, detaljni prikaz sada zauzima punu radnu površinu od glavnog bočnog izbornika do desnog ruba ekrana (ispod gornje trake brze navigacije), čime su sadržaj i forme znatno pregledniji."
      },
      {
        type: "ispravak",
        text: "Stalna prisutnost izbornika na svim pregledima: glavni bočni izbornik i gornja brza navigacija sada ostaju stalno vidljivi i dostupni prilikom pregleda detalja sjednica, kontakata i predavanja, kao i na stranici profila pojedinog člana (/members/[id])."
      },
      {
        type: "novo",
        text: "Privremeni administratorski alat za čišćenje baze članova: u Registru članova dodan je alat dostupan isključivo administratoru za brzo masovno brisanje datuma upisa, masovno brisanje svih uplata, automatsku pretvorbu prepoznatljivih datuma u standardni ISO format, masovno popunjavanje nedostajućih datuma učlanjenja na 01/01/2007, brzi gumb za postavljanje 01/01/2007 kod svakog člana s očitanom greškom u datumu upisa, opciju za prolazak kroz sve uplate i datume upisa radi preračunavanja i ispravka statusa članova (Aktivan, Dug, Ispisan) u bazi te izravno (inline) uređivanje u tablici. Sustav automatski detektira i označava datume neispravnog ili nestandardnog formata uz poseban filter 'KRIVI DATUMI' te štiti aktivne članove od automatskog prijelaza u status 'Ispisan/a' dok su im datumi i uplate obrisani."
      }
    ]
  },
  {
    version: "v12.11.2026",
    dateLabel: "12/11/2026",
    title: "Razdvajanje server/client koda za Docker build, generator pojmova bez preklapanja i serijska priprema mailova",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "ispravak",
        text: "Razdvajanje klijentskih i poslužiteljskih modula (Next.js & Docker build): Uklonjena greška 'Can't resolve fs' i uvoz better-sqlite3 u Client Components. Katalog djelatnosti izdvojen je u klijentski siguran modul lib/mailcrawl/constants.ts, a svi moduli koji pristupaju SQLite bazi ili datotečnom sustavu (lib/db-path.ts, lib/mailcrawl/db.ts, lib/database.ts, lib/backup.ts, src/db/client.ts, src/services/scrapers/companyStorage.ts) zaštićeni su s 'server-only'. Dodatno je u next.config.mjs konfiguriran serverExternalPackages za better-sqlite3 i outputFileTracingExcludes čime je otklonjeno NFT upozorenje, a Next.js production build prolazi s 0 grešaka."
      },
      {
        type: "novo",
        text: "Generator pojmova za pretragu bez preklapanja (Donacije i kampanje): Implementiran pametni sustav za generiranje 5, 10 ili 15 novih pojmova i niša za pretragu hrvatskih gospodarskih subjekata i potencijalnih donatora. Sustav kombinira Gemini AI i bogati katalog hrvatskih tradicijskih obrta, baštinskih djelatnosti i gradova, uz trajnu evidenciju svih iskorištenih pojmova u bazi (search_query_history) koja jamči da se isti pojmovi i lokacije nikada ne pretražuju dvaput."
      },
      {
        type: "novo",
        text: "Serijska pretraga i automatska priprema mailova u 2 koraka: Korisnik može pregledati generirane pojmove, prilagoditi ih, ručno dodati ili ukloniti pojedine stavke, a zatim jednim klikom pokrenuti serijsku pretragu. Sustav sekvencijalno pretražuje registre i web, izvlači sve podatke (kontakt osoba, verificirani e-mail, djelatnost, adresa) te odmah izrađuje personalizirani nacrt e-maila sa statusom 'Spremno za slanje' (draft_ready), uključujući HUB-3A uplatnicu i velika početna slova zamjenica iz poštovanja (Vi, Vaš)."
      },
      {
        type: "ispravak",
        text: "Prikaz modula Projekti i istraživanja prema dodijeljenim ovlastima: ispravljen problem gdje se modul nije prikazivao osobama koje imaju dozvolu vidjeti samo pojedine dijelove modula (npr. samo Projekti, ili samo Upiti i istraživanja na jednoj od tri razine: Zaprimljeno, U radu ili Završeno). Uvedena je funkcija getUserAccessRights koja robusno parsira i spaja prava pristupa bez obzira na oblik pohrane (objekt, JSON niz ili fallback kolona), a bočna traka i vršna brza navigacija sada dinamički i točno prikazuju odgovarajući naziv i poveznicu ('PROJEKTI I ISTRAŽIVANJA', 'UPITI I ISTRAŽIVANJA' ili 'PROJEKTI')."
      },
      {
        type: "poboljsanje",
        text: "Stalna dostupnost brze navigacije zaglavlja u modulu Projekti i istraživanja: brza navigacija zaglavlja (DesktopHeaderNav) premještena je na sam vrh stranice iznad kartica, čime je trajno dostupna i vidljiva bez obzira na to nalazi li se korisnik na kartici projekata ili evidenciji upita i istraživanja."
      },
      {
        type: "ispravak",
        text: "Usklađivanje moderatorskih i članskih dozvola za projekte: osigurano da moderatori i članovi s dodijeljenim ovlastima mogu nesmetano pristupiti modulu i raditi u njemu bez lažnih odbijenica pristupa u ProtectedRoute komponenti."
      }
    ]
  },
  {
    version: "v11.11.2026",
    dateLabel: "11/11/2026",
    title: "Što je novo od zadnje prijave, Puna širina nadzorne ploče, Brza navigacija u zaglavlju i 3 razine ovlasti za Upite i istraživanja",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "poboljsanje",
        text: "Fiksni i stalni Header i Footer: vršno zaglavlje i cjelovito podnožje aplikacije sada su trajno fiksirani i stabilni na vrhu i dnu ekrana neovisno o skrolanju radne površine; središnji sadržaj stranice nesmetano se skrola između njih uz prilagođene donje razmake."
      },
      {
        type: "poboljsanje",
        text: "Istaknut naziv RODOSLOVAC iznad logotipa: u bočnoj traci naziv sustava smješten je iznad logotipa društva uz znatno uočljiviju jantarno-zlatnu temu visoke vidljivosti i elegantnu stilizaciju."
      },
      {
        type: "poboljsanje",
        text: "Uklonjen tekst 'HRD Rodoslovac' iz zaglavlja: uklonjen je suvišni tekst i separator iz vršnog zaglavlja Nadzorne ploče, čime je prostor u potpunosti oslobođen za brzu navigaciju, sažetak novosti i funkcije korisnika."
      },
      {
        type: "novo",
        text: "Pravila pristupa za Funkcije u društvu: po zadanom svi prijavljeni članovi mogu pregledavati funkcije i trenutnu postavu odbora, dok je uređivanje i dodjeljivanje funkcija rezervirano isključivo za administratore, moderatore ili članove kojima je eksplicitno uključena ovlast uređivanja funkcija."
      },
      {
        type: "poboljsanje",
        text: "Automatsko otvaranje Nadzorne ploče pri prijavi: korisnik se nakon uspješne prijave u sustav automatski odmah preusmjerava na Nadzornu ploču (/) kao polaznu točku rada."
      },
      {
        type: "poboljsanje",
        text: "Izmještanje odjave i korisničkog profila u zaglavlje aplikacije: u vršnom zaglavlju uklonjeno je suvišno globalno polje za pretraživanje, a na njegovo mjesto postavljen je jasan prikaz prijavljenog korisnika s ulogom i ikonom za brzu odjavu; istovremeno je gumb za odjavu uklonjen iz bočne trake."
      },
      {
        type: "poboljsanje",
        text: "Zajedničko podnožje aplikacije (Footer): korisnički priručnik, popis promjena (Changelog), staza pohrane baze podataka, oznaka verzije i autorska prava premješteni su na dno ekrana u cjeloviti footer čime je bočni izbornik oslobođen i sada prikazuje više izborničkih stavki bez zagušenja."
      },
      {
        type: "ispravak",
        text: "Ispravak filtriranja Upita i istraživanja za pojedinačne razine ovlasti: riješen problem gdje član s odobrenom samo jednom razinom pristupa (npr. samo U radu ili samo Zaprimljeno) nije vidio podatke; ploča se sada dinamički prilagođava odobrenoj razini, podržava sve statusne oznake i omogućuje trenutan pregled odgovarajućih istraživanja."
      },
      {
        type: "ispravak",
        text: "Ispravak redoslijeda direktive 'use client' za Turbopack i Docker build: premještena direktiva 'use client' na apsolutni početak datoteka (contacts-content, lectures-content, library-content, meetings-content, projects-content) prije import naredbi te optimizirano trasiranje datoteka u API ruti istraživanja, čime je uspješno uklonjeno 17 build grešaka i osiguran stabilan Next.js i Docker build."
      },
      {
        type: "ispravak",
        text: "Ispravak i precizno računanje sažetka „Što je novo u Društvu”: uvedena nova tablica praćenja prijava 'user_login_tracking' koja univerzalno i perzistentno bilježi prethodnu prijavu i potvrdu pregleda kako za administratora tako i za redovne članove. Prikazuju se isključivo promjene nastale od zadnje prijave: točan broj i pregled primljenih mailova, broj poslanih mailova, neodgovoreni i neriješeni e-mailovi i upiti koji čekaju obradu, te nove sjednice, predavanja, uplate i zabilješke, uz trenutno resetiranje novih stavki nakon klika na potvrdu."
      },
      {
        type: "poboljsanje",
        text: "Vraćena puna dostupna širina Nadzorne ploče: uklonjeno uže ograničenje širine (max-w-7xl) te je omogućen pregled i raspored elemenata preko cjelokupne raspoložive širine zaslona (w-full) za maksimalnu preglednost na svim monitorima."
      },
      {
        type: "novo",
        text: "Brza navigacija u zaglavlju po cijeloj širini za računala: u vršnom zaglavlju aplikacije (samo za prikaz na stolnim i prijenosnim računalima) dodane su ikone po uzoru na bočni izbornik s brzim prečacima, oznakom aktivnog modula i nazivima na lebdenje mišem, omogućujući trenutan skok između cjelina sustava."
      },
      {
        type: "novo",
        text: "Trostupanjski sustav ovlasti za Upite i istraživanja: uvedene tri neovisne razine pristupa – ZAPRIMLJENO (pogled, uređivanje), U RADU (pogled, uređivanje) i ZAVRŠENO (pogled, uređivanje). Prava se konfiguriraju po članu u Postavkama i detaljima člana, a sučelje automatski filtrira kartice, prilagođava stupce na ploči i zaključava uređivanje za faze u kojima korisnik ima samo pravo pregleda."
      },
      {
        type: "novo",
        text: "Automatski A4 PDF privitak uz e-mail obavijesti: prilikom slanja e-mail obavijesti iz bilo koje sjednice, sastanka ili predavanja, sustav automatski generira službeni A4 PDF dokument (zapisnik sjednice ili izvještaj predavanja sa svim podacima, dnevnim redom, evidencijama i točnim funkcijama članova) te ga prilaže kao privitak (PDF attachment) uz poslanu e-poštu; u dijalogu za slanje dodana je vizualna potvrda priloženog dokumenta i gumb za brzi pregled PDF-a prije samog slanja."
      },
      {
        type: "ispravak",
        text: "Prikaz stvarnih funkcija članova u PDF izvještajima i sučelju na datum događanja: ispravljen problem gdje je u tablicama prisutnih članova na sjednicama i predavanjima svima pisalo općenito „Član” umjesto njihove stvarne funkcije/dužnosti u Društvu (npr. Predsjednik izvršnog odbora, Tajnik, Zamjenik predsjednika Društva, Član Nadzornog odbora i dr.). Sustav sada precizno provjerava mandate članova na točan datum održavanja događanja i u PDF dokumentima (uključujući i evidenciju glasanja na sjednicama) te u sučelju prikazuje točne funkcije koje je član tada obnašao."
      },
      {
        type: "novo",
        text: "Izmjena naslova postojećih sjednica i predavanja: omogućeno brzo i izravno preimenovanje naslova sjednica i predavanja/druženja s popisa kartica (putem ikone olovčice i namjenskog dijaloga) te unutar samog zaglavlja pregleda detalja sjednice i predavanja uz trenutno spremanje u bazu podataka."
      },
      {
        type: "poboljsanje",
        text: "Verifikacija i obogaćenje cjelovitog sustava sigurnosnih kopija (Backup): potvrđeno da su sve novo dodane opcije (strukturirani Trezor računa 'vault', tekstualne bilješke 'vaultNotes', sve postavke 'settings', sjednice i predavanja s dnevnim redom i prisutnošću, ankete i Dnevnik aktivnosti) 100% uključeni u automatski i ručni Dropbox ZIP backup te u Dry-Run simulaciju povrata; JSON izvoz baze dodatno proširen evidencijama pošiljatelja (mail_senders), pročitanih mailova (mail_reads) te bazama donacija i scrapera."
      },
      {
        type: "novo",
        text: "Strukturirani Trezor vjerodajnica po platformama: uz slobodni tekstualni unos, dodan je cjeloviti sustav za unos i upravljanje korisničkim imenima i lozinkama po pojedinačnim servisima i platformama (npr. Gmail, PuTTY / SSH, CPanel, Hosting, Google Cloud, Dropbox, Carnet) s brzim predlošcima, generatorom jakih lozinki i kopiranjem jednim klikom."
      },
      {
        type: "novo",
        text: "Sigurnost i primopredaja dužnosti Trezora: ugrađen je gumb za trenutni ispis i izvoz cjelovitog Trezora za potrebe primopredaje ovlasti novom administratoru, maskiranje lozinki sa zvjezdicama i mogućnošću pojedinačnog ili grupnog otkrivanja."
      },
      {
        type: "novo",
        text: "Drag & Drop prijenos datoteka na Google Drive: omogućeno jednostavno povlačenje i ispuštanje datoteka izravno s računala na površinu preglednika ili izravno na određenu mapu (u tablici ili mreži) s animiranim vizualnim overlayem, prikazom ciljne mape i podrškom za prijenos više datoteka odjednom."
      },
      {
        type: "novo",
        text: "Prikaz napretka učitavanja (Upload Progress): dodana plutajuća statusna traka s brojačem i trakom napretka pri prijenosu više datoteka na Google Drive."
      },
      {
        type: "poboljsanje",
        text: "Reorganizacija stavki na Google Drive-u: omogućeno povlačenje postojećih datoteka unutar sučelja u druge mape (Drive item move) uz automatsko bilježenje u Dnevnik aktivnosti."
      },
      {
        type: "novo",
        text: "Službeni identitet aplikacije „Rodoslovac”: naziv sustava istaknut je u bočnoj navigaciji, mobilnom zaglavlju, nadzornoj ploči, uvodnom zaslonu (Boot Splash), prijavi i korisničkom priručniku bez narušavanja postojećeg dizajna i vizualnog identiteta HRD „Pavao Ritter Vitezović”."
      },
      {
        type: "novo",
        text: "A4 PDF gumb u istaknutoj boji na svim sjednicama i predavanjima: na svakoj kartici sjednice i predavanja/druženja te unutar dijaloga detalja dodan je crveni (rose) 'PDF' gumb za trenutno generiranje službenog izvještaja."
      },
      {
        type: "novo",
        text: "Potpuni A4 PDF izvještaj sjednice i predavanja s marginama za pregled i ispis: generira dokument sa svim raspoloživim podacima (osnovni podaci, voditelj/predavači, dnevni red, cjeloviti zapisnik/sažetak, tablica prisutnih članova s funkcijama, rezultati svih provedenih glasanja uz sjednicu, popis priloga, evidencija poslanih obavijesti i potpisni blok) uz ugrađeni preglednik za ispis i preuzimanje."
      }
    ]
  },
  {
    version: "v09.11.2026",
    dateLabel: "09/11/2026",
    title: "A4 Landscape PDF export izvješća s prikvačivanjem sjednici/predavanju, unificirani datumi (DD/MM/YYYY) i sažeti Dnevnik aktivnosti",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "novo",
        text: "Službeni A4 Landscape PDF export izvješća s marginama: generiranje čistog vektorskog PDF dokumenta u vodoravnom A4 formatu (297×210 mm) s definiranima marginama, zaglavljem na svakoj stranici, tablicama koje se ne lome na prijelazu stranica i numeracijom stranica, uz prilagođeni '@page { size: A4 landscape; margin: 12mm 14mm; }' i za izravni ispis iz preglednika."
      },
      {
        type: "novo",
        text: "Prikvačivanje PDF izvješća sjednici ili predavanju: odmah nakon generiranja PDF-a (ili putem gumba 'Prikvači sjednici / predavanju') otvara se dijalog koji omogućuje odabir konkretne sjednice ili predavanja te automatsko pohranjivanje i povezivanje PDF dokumenta u odjeljak 'Prilozi'."
      },
      {
        type: "poboljsanje",
        text: "Unificirani prikaz i unos datuma u formatu DD/MM/YYYY (odnosno DD/MM/YYYY HH:mm za vremenske oznake) kroz sve module aplikacije: Nadzorna ploča, Članstvo i matična knjiga, Upiti i istraživanja, Projekti, Sjednice, Predavanja, E-pošta (Gmail), Donacije, Google Drive, Dnevnik aktivnosti, Izvješća i Excel/CSV izvozi."
      },
      {
        type: "poboljsanje",
        text: "Prilagođena polja za odabir datuma (DateFormattedInput i DateOrYearInput): sva polja za unos datuma vizualno prikazuju i prihvaćaju format DD/MM/YYYY uz ikonu kalendara za odabir datuma neovisno o postavkama jezika preglednika ili operacijskog sustava."
      },
      {
        type: "poboljsanje",
        text: "Generator periodičkih izvješća (/reports): unaprijed definirani raspon datuma (Od datuma – Do datuma) pri otvaranju modula automatski se postavlja na razdoblje od mjesec dana unatrag do dana izrade izvješća."
      },
      {
        type: "ispravak",
        text: "Ispravljena putanja baze u API ruti glasovanja anketa (/api/polls/my-votes) kako bi koristila centraliziranu putanju DatabaseService.getDatabasePath() umjesto lokalne fiksne putanje, čime je postignuta stopostotna dosljednost centralnog spremanja svih baza."
      },
      {
        type: "ispravak",
        text: "Trajno uklanjanje Administratora s popisa članova: sistemski račun Administratora potpuno je odvojen od tablice 'members' (lozinka i osobne bilješke vode se isključivo u sistemskim postavkama), postojeća administrativna stavka automatski se briše pri inicijalizaciji baze, a dodana je višeslojna zaštita u bazi, servisu i sučelju koja trajno sprječava upis ili prikaz Administratora među članovima Društva."
      },
      {
        type: "poboljsanje",
        text: "Redizajnirano poglavlje 'VIII. Dnevnik ključnih operacija i aktivnosti sustava (Sažetak)' u izvješćima: umjesto višestraničnog ispisa pojedinačnih zapisa, aktivnosti se automatski sumiraju kroz kartice po funkcionalnim područjima, tablicu aktivnosti po administratorima/korisnicima s brojem ponavljanja te zbirni pregled po vrstama operacija u sustavu."
      }
    ]
  },
  {
    version: "v08.11.2026",
    dateLabel: "08/11/2026",
    title: "Upravljanje istraživanjima u 3 faze, integracija 'U istraživanje' iz Gmail Inboxa i službeno slanje mailova s HUB-3A uplatnicom",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "novo",
        text: "Gmail integracija 'U istraživanje': jednim klikom izravno iz pristigle poruke u Inboxu sustav automatski klasificira mail kao upit za rodoslovno istraživanje, preuzima ime i prezime, email pošiljatelja, datum zaprimanja, naslov, sadržaj te automatski preuzima i pohranjuje sve privitke iz poruke."
      },
      {
        type: "novo",
        text: "3-fazno upravljanje upitima i istraživanjima: statusi 'Zaprimljeno (Nedodijeljeno)', 'U radu' i 'Završeno' uz novi 3-stupačni vizualni pregled (Ploča po fazama) i mrežni pregled."
      },
      {
        type: "novo",
        text: "Službeno slanje maila istraživaču: slanje sa službene adrese Društva direktno dodijeljenom istraživaču (To) s pošiljateljem upita u CC-u i svim automatski priloženim privicima, uz vidljivi trag u INBOX-u."
      },
      {
        type: "novo",
        text: "Službeno slanje obavijesti tražitelju: slanje zahvale na upitu s obavijesti o trenutačnoj potkapacitiranosti i prosljeđivanju prvom slobodnom istraživaču."
      },
      {
        type: "novo",
        text: "Obavezni blok za podršku i donaciju Društvu s HUB-3A 2D barkodom: svaki mail poslan kroz modul istraživanja automatski sadrži poziv na učlanjenje, tablicu s podacima za uplatu te generirani 2D barkod."
      },
      {
        type: "novo",
        text: "Detaljna interna evidencija poslanih e-mailova (email_logs): unutar svakog istraživanja trajno se bilježi tko je poslao mail, datum i vrijeme, kome (To/CC) i pregled poslane poruke."
      },
      {
        type: "novo",
        text: "Opcija slanja TEST e-maila iz istraživanja: mogućnost probnog slanja maila na adresu administratora ili proizvoljno upisanu e-mail adresu (s oznakom [TEST], bez slanja podnositelju u CC i bez promjene statusa upita)."
      },
      {
        type: "poboljsanje",
        text: "Unificirani donacijski blok, 2D HUB-3A barkod i potpis između modula 'Donacije & kampanje' i 'Upiti i istraživanja': uklonjen OIB iz tablice podataka za uplatu, postavljen iznos '50,00 EUR (ili proizvoljni iznos prema Vašim mogućnostima)' u tekstu i u 2D barkodu (50 €), povećana visina 2D barkoda za 25% radi lakšeg skeniranja te izjednačen službeni potpis s logotipom Društva."
      },
      {
        type: "poboljsanje",
        text: "Povezanost poruka u Gmail Inboxu s istraživanjima: u popisu i detaljima mailova prikazuje se bedž istraživanja s ID-em i dodijeljenim istraživačem te mogućnošću trenutnog otvaranja."
      }
    ]
  },
  {
    version: "v05.11.2026",
    dateLabel: "05/11/2026",
    title: "Centralizacija baza podataka, Ručni upis donatora, Google pretraga tvrtki, Evidencija čitanja mailova i Potpuni priručnik",
    badge: "Prethodno izdanje",
    changes: [
      {
        type: "novo",
        text: "Centralna produkcijska lokacija svih baza podataka (/var/data/prv_data/db/) za sve module (app.db, mailcrawl.db, company_scraper.db) s automatskom migracijom."
      },
      {
        type: "novo",
        text: "Ručni upis donatora i direktnih donacija (izvan e-mail kampanja): evidencija uplata na žiro račun, u gotovini ili putem donacijskog ugovora, uz trenutno uključivanje u statistiku i izvješća."
      },
      {
        type: "novo",
        text: "Google Search Fallback za donacije: ako u poslovnim registrima nema rezultata za traženi pojam, sustav automatski pretražuje prvih 20 hrvatskih tvrtki na Googleu, posjećuje njihove web stranice i izvlači e-mail adrese."
      },
      {
        type: "novo",
        text: "Pamćenje pretraživanih pojmova (search_query_history): sustav pamti svaki pretraženi pojam i grad te upozorava korisnika kako se ne bi pretraživalo duplo."
      },
      {
        type: "novo",
        text: "Evidencija pročitanih mailova bez odgovora (mail_reads): ako je dolazni e-mail pročitan, a na njega nije odgovoreno niti je proslijeđen, sustav bilježi i prikazuje tko je pročitao mail uz napomenu '(bez odgovora)'."
      },
      {
        type: "novo",
        text: "Zasebna stranica Popis promjena (/changelog) i informativni linkovi u podnožju (footeru) navigacije."
      },
      {
        type: "novo",
        text: "Unaprijeđena karta predavanja i gostovanja (/lectures): dodano polje za odabir Grada/Mjesta (preko 150 hrvatskih gradova, općina i mjesta gostovanja), automatsko prepoznavanje padeža i dvorana te grupiranje događanja po gradu s prikazom broja održanih predavanja na markeru."
      },
      {
        type: "poboljsanje",
        text: "Novi format oznake verzije prema datumu zadnje promjene (v05.11.2026) s većim i čitljivijim prikazom koji klikom otvara Changelog."
      },
      {
        type: "poboljsanje",
        text: "Proširenje Backup Dry-run simulacije: automatska provjera svih 3 baza podataka, novih tablica (mail_senders, mail_reads, search_query_history) i integriteta podataka."
      },
      {
        type: "poboljsanje",
        text: "Korisnički priručnik premješten u footer i dorađen do posljednjeg detalja s uputama za apsolutno sve stavke i module aplikacije."
      }
    ]
  },
  {
    version: "v30.10.2026",
    dateLabel: "30/10/2026",
    title: "Generator periodičkih izvješća, Evidencija pošiljatelja e-mailova i Ime Administratora",
    badge: "Velika nadogradnja",
    changes: [
      {
        type: "novo",
        text: "Generator periodičkih izvješća (/reports): odabir datuma od-do, brzi prečaci, detaljan tekstualni zapisnik svih novih članova, uplata članarina, donacija, sjednica, predavanja te broja primljenih i poslanih e-mailova."
      },
      {
        type: "novo",
        text: "Ispis službenog PDF memoranduma s potpisima, izvoz u CSV/Excel te gumb za kopiranje cjelovitog tekstualnog izvješća u međuspremnik."
      },
      {
        type: "novo",
        text: "Interna evidencija pošiljatelja e-mailova (mail_senders): praćenje tko je poslao ili odgovorio na mail s obojenim bedževima prema ulozi, bez spremanja tijela mailova ili privitaka na lokalni disk."
      },
      {
        type: "novo",
        text: "Mogućnost upisa imena i prezimena Administratora u Postavkama (Sigurnost -> Informacije o profilu), obuhvaćeno sigurnosnom kopijom (backupom)."
      },
      {
        type: "poboljsanje",
        text: "Proširen sustav sigurnosnih kopija (Backup) kako bi uz app.db i mailcrawl.db uključivao i company_scraper.db s WAL checkpointom."
      },
      {
        type: "ispravak",
        text: "Riješen problem statičke evaluacije tijekom Docker produkcijskog builda (force-dynamic na API rutama)."
      }
    ]
  },
  {
    version: "v29.10.2026",
    dateLabel: "29/10/2026",
    title: "Unaprjeđenje Gmail modula, Inline uplatnice i Prošireni pregled za dužnike",
    badge: "E-mail & Financije",
    changes: [
      {
        type: "novo",
        text: "Ugradnja (embedding) slika uplatnice i 2D barkoda izravno u tijelo e-maila za dužnike članarine, uz zadržavanje slika i u privitku."
      },
      {
        type: "poboljsanje",
        text: "Dvostruko proširen popup prozor za pregled i slanje obavijesti dužnicima radi preglednijeg čitanja cijelog e-maila."
      },
      {
        type: "poboljsanje",
        text: "Uklonjen dio o prijavi u sustav iz e-mail obavijesti za dužnike članarine."
      },
      {
        type: "ispravak",
        text: "Potpuna RFC rekonstrukcija MIME multipart/related strukture za pravilan prikaz logotipa u potpisu i slika iz Gmail predložaka."
      }
    ]
  },
  {
    version: "v25.10.2026",
    dateLabel: "25/10/2026",
    title: "Katalog hrvatskih tvrtki (Croatia.biz), Kampanje za donacije i HUB-3A barkod",
    badge: "Donacije & AI",
    changes: [
      {
        type: "novo",
        text: "Integracija croatia.biz kataloga (343 hrvatska grada i mjesta) i sustav za automatsko obogaćivanje podataka o tvrtkama."
      },
      {
        type: "novo",
        text: "Google Gemini AI personalizacija donacijskih pisama s automatskim generiranjem službenog HUB-3A PDF417 2D barkoda za uplate."
      },
      {
        type: "novo",
        text: "Oznaka i reaktivacija neispravnih mail adresa u registru poslanih te prikaz statistike donacija na Nadzornoj ploči."
      },
      {
        type: "poboljsanje",
        text: "Zaštita od duplikata (trajni registar poslanih) i evidencija broja slanja po subjektu."
      }
    ]
  },
  {
    version: "v15.10.2026",
    dateLabel: "15/10/2026",
    title: "Temeljni sustav HRD-CMS: Članstvo, Sjednice, Knjižnica, Arhiv, Trezor i Dropbox Backup",
    badge: "Osnovni sustav",
    changes: [
      {
        type: "novo",
        text: "Matična knjiga članova, automatsko praćenje statusa članarina (AKTIVAN / DUG), iskaznice i povijest uplata."
      },
      {
        type: "novo",
        text: "Sjednice i elektroničko glasovanje (ankete, kvorum, dnevni red, zapisnici i PDF dokumentacija)."
      },
      {
        type: "novo",
        text: "Moduli: Knjižnica (knjige, časopisi, vanjske knjižnice), Predavanja i druženja, Projekti društva, Arhiv i rodoslovni upiti, Ljetopis društva."
      },
      {
        type: "novo",
        text: "Sigurnosni Trezor lozinki, automatski i ručni Backup na Dropbox te pristupačni prikaz (Zoom) za slabovidne osobe."
      }
    ]
  }
]
