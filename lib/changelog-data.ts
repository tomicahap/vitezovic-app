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
    version: "v19.11.2026",
    dateLabel: "19/11/2026",
    title: "Kronološko praćenje odgovora u istraživanjima, brzi podsjetnik za članarinu i ugrađeni TrueType fontovi u PDF-u",
    badge: "Najnovije izdanje",
    isLatest: true,
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
