"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import {
  Book,
  Users,
  Contact,
  Calendar,
  Mic,
  Library,
  FolderKanban,
  Archive,
  Mail,
  Link as LinkIcon,
  Cloud,
  ShieldCheck,
  HelpCircle,
  Search,
  LayoutDashboard,
  Check,
  StickyNote,
  Sparkles,
  FileBarChart,
  BookOpen,
  Activity,
  Settings,
  Database,
  ZoomIn,
  History,
  CheckCircle2,
  AlertTriangle,
  Info,
  KeyRound,
  LogIn,
  Printer,
  ChevronDown,
  ChevronUp,
  Cake,
  Medal,
  Wrench,
  Compass,
  UserCheck,
  FileText
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface ManualStep {
  title: string
  description: string
  bullets?: string[]
  tips?: string[]
  warning?: string
}

interface ManualSection {
  id: string
  number: number
  title: string
  subtitle: string
  category: "pocetak" | "osnovno" | "clanstvo" | "rad_drustva" | "komunikacija" | "uprava_sustav"
  icon: React.ElementType
  badge?: string
  audience: "Svi članovi" | "Moderator i Admin" | "Samo Administrator"
  route?: string
  summary: string
  steps: ManualStep[]
}

const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "getting-started",
    number: 1,
    title: "Prvi koraci: Prijava u sustav, lozinka i snalaženje u sučelju",
    subtitle: "Sve što trebate znati pri prvom susretu sa sustavom „Rodoslovac”",
    category: "pocetak",
    icon: LogIn,
    route: "/",
    badge: "Obavezno za nove korisnike",
    audience: "Svi članovi",
    summary:
      "Sustav „Rodoslovac” je središnja web-aplikacija Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”. Pristup sustavu zaštićen je korisničkim imenom (vaša e-mail adresa) i lozinkom, a izgled izbornika automatski se prilagođava vašoj ulozi u društvu.",
    steps: [
      {
        title: "Kako dobiti pristup i kako se prvi put prijaviti",
        description:
          "Pristup sustavu otvara Administrator društva iz matične knjige članova slanjem službene e-mail pozivnice. U pozivnici ćete dobiti poveznicu (link) na aplikaciju, vaše korisničko ime (vaša e-mail adresa) i privremenu lozinku.",
        bullets: [
          "Otvorite poveznicu iz e-maila u internetskom pregledniku (Chrome, Edge, Firefox ili Safari na računalu ili mobitelu).",
          "U polje „Korisničko ime / E-mail” upišite svoju e-mail adresu točno onako kako je navedena u pozivnici.",
          "U polje „Lozinka” upišite privremenu lozinku iz e-maila (pazite na velika i mala slova te razmake na kraju).",
          "Prilikom prve prijave s privremenom lozinkom sustav će od vas zatražiti da odmah postavite svoju novu, trajnu osobnu lozinku (najmanje 6 znakova) koju znate samo vi."
        ],
        tips: [
          "Ako ste zaboravili lozinku, javite se Administratoru ili Tajniku društva koji vam jednim klikom u kartonu člana može poslati novu pozivnicu s novom privremenom lozinkom."
        ]
      },
      {
        title: "Skočni prozori pri prijavi: „Što je novo u društvu?” i „Obavezno glasovanje”",
        description:
          "Odmah nakon uspješne prijave sustav provjerava što se u društvu dogodilo od vašeg posljednjeg posjeta te prikazuje informativni pregled kako ništa važno ne biste propustili.",
        bullets: [
          "Prozor „Što je novo u društvu?”: prikazuje sažetak novosti od vaše zadnje potvrde — nadolazeće rođendane članova u idućih 15 dana (s točnim datumom i oznakom „Danas!”, „Sutra” ili „za X dana”), novoupisane članove, nove sjednice, predavanja, projekte, rodoslovne upite i nove knjige u knjižnici.",
          "Slanje rođendanske čestitke iz prozora novosti: Administratori i moderatori pored svakog slavljenika u popisu nadolazećih rođendana vide gumb „Pošalji čestitku” kojim odmah otvaraju predložak rođendanskog e-maila.",
          "Gumb „Potvrdi i zatvori”: kada pregledate novosti, kliknite „Potvrdi i zatvori” — sustav bilježi vrijeme vaše potvrde te vam pri idućoj prijavi prikazuje samo promjene nastale nakon tog trenutka.",
          "Prozor „Obavezno glasovanje”: ako je uprava otvorila elektroničko glasovanje u kojem imate pravo glasa, a još niste glasovali, prikazat će se prozor za glasovanje."
        ]
      },
      {
        title: "Raspored ekrana: Lijevi izbornik, Gornja traka, Široki radni prostor i Podnožje",
        description:
          "Sučelje aplikacije podijeljeno je na četiri pregledne cjeline koje vam omogućuju brz prelazak iz jednog modula u drugi u bilo kojem trenutku:",
        bullets: [
          "Lijevi bočni izbornik (stalno prisutan na računalu): sadrži grb društva, oznaku sustava RODOSLOVAC, popis svih modula kojima imate pristup, gumb „POVEĆAJ PRIKAZ” (za slabovidne), podatke o vašem profilu i gumb za odjavu. Lijevi izbornik nikada ne nestaje, čak ni kada otvorite detalje pojedinog člana, sjednice, kontakta ili predavanja.",
          "Gornja navigacijska traka (na računalima): nalazi se na vrhu radnog prostora i nudi brze prečace na najčešće korištene module te trenutačni gumb za odjavu.",
          "Glavna radna površina (od izbornika do desnog ruba ekrana): središnji prostor u kojem se prikazuju tablice, kartice i obrasci. Kada otvorite detalje člana, sjednice, kontakta u adresaru ili predavanja, prikaz se širi preko cijele radne površine od lijevog izbornika do desnog ruba ekrana radi maksimalne preglednosti.",
          "Podnožje (Footer): na dnu ekrana stalno su dostupni brzi linkovi na ovaj Korisnički priručnik, Popis promjena (Changelog) i oznaku trenutne verzije sustava (npr. v20.11.2026).",
          "Na pametnim telefonima (mobitelima): umjesto lijevog stupca, na dnu ekrana nalazi se traka s 4 glavna prečaca (Početna, Članovi, Sjednice, Moj kutak) i gumbom „Više” koji otvara sve ostale module."
        ]
      },
      {
        title: "Tri razine korisničkih uloga i ovlasti (Član, Moderator, Administrator)",
        description:
          "U sustavu postoje tri osnovne razine pristupa, uz mogućnost dodatnog finog podešavanja prava za svakog pojedinog člana:",
        bullets: [
          "Član: vidi Nadzornu ploču, svoj osobni prostor „Moj kutak”, Sjednice i e-glasovanja u kojima sudjeluje, te sve dodatne module (npr. Knjižnicu, Arhiv, Upite i istraživanja ili Funkcije u društvu) za koje mu je Administrator uključio pravo pregleda ili uređivanja.",
          "Moderator (članovi Upravnog odbora, Tajnik, Blagajnik): uz članske module ima pristup upravljanju članovima, sjednicama, predavanjima, knjižnici, projektima, izvješćima i ljetopisu, sukladno dodijeljenim ovlastima.",
          "Administrator: ima potpuni pristup svim modulima, financijskim i administrativnim alatima, kampanjama donacija, dnevniku aktivnosti, sigurnosnim kopijama (Backup), postavkama sustava i Trezoru lozinki."
        ]
      },
      {
        title: "Pravilo formata datuma u cijeloj aplikaciji (DD/MM/YYYY)",
        description:
          "U svim tablicama, kartonima članova, izvješćima i izvozima koristi se jedinstveni hrvatski format datuma DD/MM/YYYY (dan/mjesec/godina, npr. 15/11/2026), odnosno DD/MM/YYYY HH:mm kada se uz datum prikazuje i točno vrijeme (npr. kod evidencije poslanih e-mailova)."
      }
    ]
  },
  {
    id: "dashboard",
    number: 2,
    title: "Nadzorna ploča (Početna stranica)",
    subtitle: "Središnji pregled stanja društva, oglasne ploče, statistike i nadolazećih aktivnosti",
    category: "osnovno",
    icon: LayoutDashboard,
    route: "/",
    badge: "Početni zaslon",
    audience: "Svi članovi",
    summary:
      "Nadzorna ploča otvara se odmah nakon prijave i pruža brz uvid u brojno stanje članstva, oglasnu ploču uprave, nadolazeće sjednice i predavanja, otvorena glasovanja te pregled napretka donacijskih ciljeva.",
    steps: [
      {
        title: "Statističke kartice i brzi prečaci na vrhu",
        description:
          "Na vrhu stranice prikazane su pregledne kartice s ključnim pokazateljima u stvarnom vremenu: ukupan broj aktivnih članova, broj zakazanih/održanih sjednica, veličina knjižničnog fonda, aktivni projekti i dokumenti u arhivu. Klikom na pojedinu karticu izravno ulazite u taj modul.",
        tips: [
          "Brojke se računaju automatski iz baze podataka pri svakom otvaranju stranice."
        ]
      },
      {
        title: "Oglasna ploča odbora (Važne obavijesti uprave)",
        description:
          "U istaknutom okviru Oglasne ploče prikazuje se trenutna službena obavijest za sve članove (npr. obavijest o radnom vremenu društva, pripremi Skupštine ili novom izdanju časopisa), zajedno s imenom autora i datumom objave.",
        bullets: [
          "Kako urediti oglasnu ploču (Admin / Moderator): kliknite na gumb „Uredi obavijest” u kutu oglasne ploče, upišite novi tekst poruke i kliknite „Spremi”. Promjena je odmah vidljiva svim članovima pri prijavi.",
          "Slanje obavijesti e-mailom članovima tijela društva („Obavijest tijelima” / „Pošalji mail tijelima”): s Nadzorne ploče, iz kartice „Trenutna postava odbora” u Članovima ili iz modula Sjednice članovi s odobrenom ovlasti „Obavijest članovima tijela” (te Administrator) mogu napisati i poslati važnu informaciju isključivo članovima trenutnog aktivnog sastava tijela društva. Poruka koristi unificirano HRD zaglavlje i službeni potpis, prikazuje pošiljatelja i vrijeme slanja, a prije slanja svima omogućuje pregled izgleda i slanje testnog e-maila. Svaka poslana obavijest trajno se pohranjuje u Povijest slanja (kome je poslano, što je poslano, tko je poslao i status dostave)."
        ]
      },
      {
        title: "Nadolazeće sjednice, predavanja i aktivna e-glasovanja",
        description:
          "U središnjem dijelu Nadzorne ploče izlistane su prve sljedeće sjednice i javna predavanja s datumom, vremenom i lokacijom održavanja. Ako je u tijeku elektroničko glasovanje, ovdje možete odmah pristupiti glasačkom listiću."
      }
    ]
  },
  {
    id: "personal",
    number: 3,
    title: "Moj kutak (Osobne bilješke, To-Do zadaci i promjena lozinke)",
    subtitle: "Vaš privatni radni prostor za bilješke, zadatke s prioritetima i sigurnost računa",
    category: "osnovno",
    icon: StickyNote,
    route: "/personal",
    badge: "Osobni prostor",
    audience: "Svi članovi",
    summary:
      "Modul „Moj kutak” namijenjen je svakom prijavljenom korisniku kao osobna bilježnica i organizator zadataka. Sve što upišete u ovaj modul sprema se uz vaš korisnički profil u bazi podataka i vidljivo je isključivo vama.",
    steps: [
      {
        title: "Vođenje osobnih bilješki (Rodoslovni zapisi i podsjetnici)",
        description:
          "U polju za osobne bilješke možete slobodno zapisivati podatke o matičnim knjigama, arhivskim signaturama, prezimenima koja istražujete ili pripremu za sastanke društva.",
        bullets: [
          "Upišite ili izmijenite tekst u prostoru za bilješke.",
          "Kliknite gumb za spremanje kako bi bilješka ostala trajno pohranjena i dostupna s bilo kojeg računala ili mobitela na koji se prijavite."
        ]
      },
      {
        title: "Upravljanje osobnim zadacima (To-Do lista) i oznaka prioriteta",
        description:
          "Popis zadataka pomaže vam pratiti obveze u društvu ili korake u vlastitom istraživanju:",
        bullets: [
          "Dodavanje zadatka: upišite naziv zadatka u polje za unos i kliknite „Dodaj” (ili pritisnite Enter).",
          "Označavanje prioriteta (Hitno / Važno): kliknite na ikonu zvjezdice/prioriteta uz zadatak kako biste ga istaknuli na vrhu popisa.",
          "Završavanje zadatka: kliknite na kvadratić (checkbox) lijevo od teksta zadatka — zadatak će biti označen kao riješen (prekrižen).",
          "Brisanje zadatka: klikom na ikonu koša za smeće uklanjate zadatak s popisa."
        ]
      },
      {
        title: "Promjena vlastite lozinke u bilo kojem trenutku",
        description:
          "U svom osobnom prostoru (ili u Postavkama) u svakom trenutku možete promijeniti lozinku za pristup sustavu upisom trenutne lozinke i dvostrukim upisom nove lozinke."
      }
    ]
  },
  {
    id: "members",
    number: 4,
    title: "Članovi, Matična knjiga, Članarine i Ustroj društva",
    subtitle: "Potpuni vodič kroz evidenciju članova, statuse, uloge, e-mail obavijesti i uplatnice",
    category: "clanstvo",
    icon: Users,
    route: "/members",
    badge: "Ključni modul",
    audience: "Moderator i Admin",
    summary:
      "Modul „Članovi” je središnji registar (matična knjiga) Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”. Sastoji se od dvije glavne kartice na vrhu: 1) Popis članova (registar, članarine, pozivnice, čestitke) i 2) Ustroj i funkcije u društvu (pregled tijela društva i aktivnih mandata).",
    steps: [
      {
        title: "1. Kako čitati tablicu članova: Status članstva, Financijski status i Uloge",
        description:
          "Svaki redak u tablici članova (i svaka kartica na mobilnom prikazu) prikazuje ključne podatke o članu uz jasne vizualne oznake:",
        bullets: [
          "Status članstva (stupac Status): AKTIVAN (zelena oznaka — član ima uredan status), NEAKTIVAN (crvena oznaka — prošao je prag neaktivnosti od zadnje uplate ili član nema niti jednu uplatu ako je to pravilo uključeno), PREMINUO/LA (siva oznaka), ISKLJUČEN/A.",
          "Vizualni prikaz preminulih članova: cijeli redak u tablici (odnosno kartica na mobitelu) prekriven je blagim sivim transparentnim slojem (overlayem), a u stupcu Uloga stoji crni križ (✝) kako bi se na prvi pogled razlikovali od aktivnih članova.",
          "Vizualni prikaz počasnih članova: u stupcu „Uloga” prikazuje se ikona zlatne medalje (🏅) bez suvišnog teksta „Počasni član”, čime tablica ostaje čista i pregledna.",
          "Prikaz uloga u stupcu „Uloga”: ispisuju se isključivo TRENUTNO AKTIVNE funkcije člana (one kojima mandat još traje), uz ikonu medalje (ako je počasni) i/ili crnog križa ✝ (ako je preminuo). Ako član nema posebnu funkciju, piše „Član”.",
          "Financijski status (stupac Financije): PODMIRENO (zeleno — članarina plaćena u roku ili je član počasni / oslobođen plaćanja), DUG (žuto/narančasto — prošlo je više od zadanog broja dana od zadnje uplate, npr. 365 dana), NA ČEKANJU (sivo)."
        ],
        tips: [
          "Automatski izračun statusa: sustav samostalno računa status svakog člana na temelju datuma njegove zadnje uplate i pravila postavljenih u „Postavke -> Pragovi članstva”."
        ]
      },
      {
        title: "2. Pretraživanje, filtriranje, sortiranje te Uvoz i Izvoz (Excel / CSV)",
        description:
          "Na vrhu popisa članova nalaze se alati za brzo pronalaženje i obradu podataka:",
        bullets: [
          "Tražilica: upišite dio imena, prezimena, e-mail adrese, broja članske iskaznice, broja matice ili područja istraživanja.",
          "Filtri: jednim klikom filtrirajte prikaz po statusu članstva (Svi, Aktivni, Neaktivni, Počasni, Preminuli), financijskom statusu (Podmireno, Dug, Oslobođeni) ili funkciji u društvu.",
          "Sortiranje stupaca: kliknite na naziv bilo kojeg stupca u zaglavlju tablice (npr. Član, Broj iskaznice, Broj matice, Datum upisa, Zadnja uplata) za uzlazno ili silazno sortiranje.",
          "Dodaj člana (+): otvara obrazac za upis novog člana u društvo.",
          "Uvoz (Import) i Izvoz (Export): omogućuju masovni uvoz članova iz tablice ili preuzimanje cijelog registra članova u CSV/Excel formatu za potrebe arhive ili tiska."
        ]
      },
      {
        title: "3. Detaljni karton člana (/members/[id]) — Široki prikaz i uređivanje svih podataka",
        description:
          "Klikom na ime člana ili na ikonu olovčice u desnom stupcu tablice otvara se cjeloviti karton člana koji zauzima punu širinu radnog prostora (od lijevog izbornika do desnog ruba ekrana):",
        bullets: [
          "Osobni i članski podaci: kliknite „Uredi podatke” za izmjenu imena, prezimena, e-maila, telefona, adrese, datuma rođenja, datuma učlanjenja, broja iskaznice i broja u matičnoj knjizi.",
          "Fleksibilan unos datuma (DateOrYearInput): kod datuma rođenja i datuma upisa možete upisati puni datum (DD/MM/YYYY) ili samo četveroznamenkastu godinu (npr. 2007) ako točan dan i mjesec nisu poznati.",
          "Posebne oznake statusa: u kartonu možete označiti kvačicu za „Počasni član”, „Oslobođen plaćanja članarine”, „Isključen iz društva” (uz datum i razlog), „Preminuo/la” (uz datum smrti) ili „Ne kontaktirati (na izričitu napomenu člana)” (uz datum i napomenu zahtjeva — trajno onemogućuje sve e-mailove, podsjetnike za uplatu i kontaktiranje kroz aplikaciju te se jasno označava crvenom oznakom u Članovima, Arhivu i PDF kartonu).",
          "Funkcije i mandati u društvu: dodajte članu jednu ili više funkcija (npr. Predsjednik, Tajnik, Član Upravnog odbora) s datumom početka („Od”) i završetka mandata („Do”). Dok je polje „Do” prazno ili u budućnosti, funkcija se smatra aktivnom.",
          "Pojedinačna prava pristupa po modulima i alatima (kartični prikaz): u kartonu člana ili u Postavkama sustava možete svakom članu pojedinačno putem preglednih kartica odobriti ili zabraniti „Pogled” i „Uređivanje” za svaki od 20 modula aplikacije (uključujući Izvješća, Logove i Ljetopis) te posebne alate i akcije (uključujući „Obavijest članovima tijela”).",
          "Financije i povijest uplata: u odjeljku Financije upišite novu uplatu (datum uplate, iznos u EUR i bilješku, npr. „Članarina za 2026.”). Sustav odmah ažurira zadnju uplatu i status člana u AKTIVAN / PODMIRENO."
        ]
      },
      {
        title: "4. Slanje e-mailova članu (Pozivnica, Opomena za članarinu, Rođendanska čestitka)",
        description:
          "Sva komunikacija prema članovima slijedi isto zlatno pravilo sigurnosti i kontrole: klikom na gumb za slanje NAJPRIJE se otvara prozor s predloškom i prikazom izgleda poruke, gdje tekst možete pregledati i po želji izmijeniti, a tek klikom na „Odobri i pošalji” e-mail se stvarno šalje i trajno bilježi u evidenciji člana!",
        bullets: [
          "A) Pozivnica za pristup sustavu (ikona omotnice ✉️ u tablici ili gumb u kartonu člana): prikazuje e-mail s korisničkim imenom i automatski generiranom privremenom lozinkom. Nakon slanja u kartonu člana i u tablici trajno ostaje zapisano: „Pozivnica poslana: DD/MM/YYYY HH:mm”.",
          "B) Obavijest / podsjetnik za plaćanje članarine (gumb „Pošalji obavijest o plaćanju” u kartonu člana ili skupno za dužnike): prikazuje tekst opomene te automatski prilaže i ugrađuje sliku HUB-3 uplatnice i 2D barkod za brzo plaćanje mobilnim bankarstvom. Nakon slanja u kartonu člana i u tablici bilježi se: „Podsjetnik: DD/MM/YYYY HH:mm”.",
          "C) Rođendanska čestitka (ikona torte 🎂 u tablici kod slavljenika, gumb „Pošalji čestitku” u prozoru „Što je novo” ili gumb „Pošalji rođendansku čestitku” u kartonu člana): otvara svečani predložak čestitke koji možete prilagoditi prije odobrenja i slanja. Nakon slanja u kartonu člana (pod „Zadnja rođendanska čestitka (evidencija)”) i u tablici („Čestitka: DD/MM/YYYY HH:mm”) trajno ostaje zabilježeno kada je čestitka poslana.",
          "D) Zamolba za dopunu podataka člana (jednokratna poveznica — 1 pristup): svaki poslani podsjetnik generira novu personaliziranu poveznicu ograničenu isključivo na jedan (1) pristup (uz obaveznu napomenu u e-mailu). Nakon predaje podataka poveznica se trajno poništava i daljnje spajanje na bazu putem tog linka više nije dopušteno, dok evidencija predaje ostaje sačuvana u kartonu člana."
        ]
      },
      {
        title: "5. Kartica „Ustroj i funkcije u društvu” (Organizacijska struktura)",
        description:
          "Na vrhu modula Članovi kliknite na karticu „Ustroj i funkcije u društvu” za pregled svih tijela društva (Predsjednik, Dopredsjednik, Tajnik, Blagajnik, Upravni odbor, Nadzorni odbor, Sud časti, Likvidator) s popisom članova koji trenutno obnašaju pojedinu dužnost i trajanjem njihovih mandata."
      },
      {
        title: "6. Administratorski alat: „Uređenje datuma i uplata” (Čišćenje baze)",
        description:
          "Administratorima je na vrhu popisa članova dostupan poseban gumb „Uređenje datuma i uplata” namijenjen brzom sređivanju matične knjige:",
        bullets: [
          "Automatska detekcija neispravnih datuma: u tablici članova i unutar ovog alata crvenom i narančastom oznakom automatski se označavaju svi članovi koji imaju krivi format datuma upisa, datuma rođenja ili datuma uplate.",
          "Pojedinačno uređivanje u tablici: u jednom prozoru možete brzo ispraviti datume svih članova, filtrirati samo članove s greškom ili bez datuma upisa te kliknuti „Spremi izmjene”.",
          "Brzi upis 01/01/2007: jednim klikom na gumb „01/01/2007” pored člana (ili masovnim gumbom za sve članove bez datuma upisa / s greškom u datumu) članu se upisuje datum pristupanja društvu 01/01/2007.",
          "Masovno brisanje pogrešnih uplata ili datuma upisa: uz dvostruku sigurnosnu potvrdu (upis riječi OBRIŠI) moguće je obrisati sve uplate ili datume upisa za odabrane ili sve članove.",
          "Gumb „Provjeri uplate i datume te ispravi statuse svih članova”: prolazi kroz cijelu bazu članova, provjerava sve uplate, datume upisa, počasne statuse i oslobođenja te prema važećim Pragovima članstva automatski ispravlja status svakog člana (Aktivan, Dug, Neaktivan)."
        ]
      }
    ]
  },
  {
    id: "contacts",
    number: 5,
    title: "Adresar i Vanjski kontakti",
    subtitle: "Evidencija suradnika, državnih arhiva, župnih ureda, muzeja, znanstvenika i institucija",
    category: "clanstvo",
    icon: Contact,
    route: "/contacts",
    badge: "Imenik suradnika",
    audience: "Moderator i Admin",
    summary:
      "U modulu „Adresar” vode se podaci o osobama, ustanovama i partnerima koji nisu članovi društva, ali su važni za rad društva (državni arhivi, župni uredi, muzeji, knjižnice, gostujući predavači, mediji, donatori i dobavljači).",
    steps: [
      {
        title: "Pretraživanje i filtriranje imenika",
        description:
          "Kontakte možete pretraživati po imenu, prezimenu, nazivu ustanove, e-mail adresi ili gradu te ih filtrirati po kategorijama radi brzog pronalaska odgovorne osobe u pojedinom arhivu ili ustanovi."
      },
      {
        title: "Široki prikaz detalja kontakta i uređivanje",
        description:
          "Klikom na bilo koji kontakt na popisu otvara se pregledni prikaz detalja koji zauzima cijelu radnu površinu od lijevog izbornika do desnog ruba ekrana (uz gumb „Natrag na adresar”). U detaljima možete jednim klikom kopirati e-mail ili telefon, pročitati bilješke o dosadašnjoj suradnji te urediti ili obrisati kontakt."
      },
      {
        title: "Dodavanje novog kontakta (+)",
        description:
          "Klikom na gumb za dodavanje kontakta unesite ime i prezime ili naziv ustanove, funkciju/odjel, kategoriju, broj telefona, e-mail adresu, poštansku adresu i napomenu."
      }
    ]
  },
  {
    id: "meetings",
    number: 6,
    title: "Sjednice, Zapisnici i Elektroničko glasovanje (E-glasovanje)",
    subtitle: "Sazivanje Skupštine i odbora, dnevni red, e-mail pozivi, provođenje glasovanja i PDF zapisnici",
    category: "rad_drustva",
    icon: Calendar,
    route: "/meetings",
    badge: "Upravljanje i odluke",
    audience: "Svi članovi",
    summary:
      "Modul „Sjednice i glasovanje” omogućuje kompletnu pripremu i vođenje sjednica Skupštine, Upravnog odbora, Nadzornog odbora i Suda časti — od slanja poziva s dnevnim redom i elektroničkog glasovanja do izrade i pohrane službenog zapisnika.",
    steps: [
      {
        title: "1. Sazivanje nove sjednice i uređivanje detalja (Admin / Moderator)",
        description:
          "Klikom na gumb „+ Nova sjednica” otvara se obrazac za unos osnovnih podataka o sjednici:",
        bullets: [
          "Unesite naslov sjednice (npr. „14. sjednica Upravnog odbora” ili „Redovna godišnja skupština”), vrstu sjednice, datum održavanja (DD/MM/YYYY), vrijeme i lokaciju (uživo ili online).",
          "Upišite ime predsjedavajuće osobe i zapisničara te točke dnevnog reda.",
          "Široki prikaz detalja sjednice: klikom na sjednicu otvara se puni prikaz od lijevog izbornika do desnog ruba ekrana. Naslov sjednice možete bilo kada brzo izmijeniti klikom na ikonu olovčice na kartici ili u zaglavlju detalja."
        ]
      },
      {
        title: "2. Slanje e-mail obavijesti o sazivanju sjednice i sažetka nakon sjednice",
        description:
          "Unutar detalja sjednice možete jednim klikom poslati službenu e-mail obavijest odabranim članovima:",
        bullets: [
          "Poziv na sjednicu: sustav automatski popunjava predložak s naslovom, datumom, vremenom, lokacijom i dnevnim redom sjednice. Prije slanja birate primatelje i pregledavate tekst.",
          "Sažetak / zapisnik nakon sjednice: po završetku sjednice možete poslati e-mail sa zaključcima i zapisnikom te u detaljima sjednice uvijek vidjeti točan datum i vrijeme zadnjeg slanja obavijesti."
        ]
      },
      {
        title: "3. Elektroničko glasovanje (Ankete i odluke na daljinu)",
        description:
          "Uz svaku sjednicu (ili samostalno) možete otvoriti elektroničko glasovanje za donošenje odluka:",
        bullets: [
          "Kreiranje glasovanja (Admin / Moderator): zadajte pitanje/odluku, opis, ponuđene odgovore (npr. ZA, PROTIV, SUZDRŽAN) i odaberite tko ima pravo glasa (svi aktivni članovi ili samo članovi određenog odbora). Možete poslati i e-mail obavijest članovima da je glasovanje otvoreno.",
          "Kako član glasuje: član u modulu Sjednice (ili u skočnom prozoru pri prijavi) odabire svoju opciju i potvrđuje glas. Sustav bilježi glas s vremenskom oznakom i onemogućuje višestruko glasovanje iste osobe.",
          "Rezultati i kvorum: sustav u stvarnom vremenu prikazuje broj i postotak glasova po opcijama te poimenični popis tko je kako glasovao za potrebe službenog zapisnika."
        ]
      },
      {
        title: "4. Evidencija prisutnih, prilozi i ispis PDF zapisnika",
        description:
          "U detaljima sjednice označite prisutne članove, upišite tekst zapisnika i zaključke po točkama dnevnog reda, priložite popratne dokumente (PDF, Word, slike) te jednim klikom generirajte službeni PDF zapisnik spreman za ispis i potpis."
      }
    ]
  },
  {
    id: "lectures",
    number: 7,
    title: "Predavanja, Radionice i Druženja",
    subtitle: "Organizacija javnih tribina, evidencija predavača, e-mail najave i posjećenost",
    category: "rad_drustva",
    icon: Mic,
    route: "/lectures",
    badge: "Javna djelatnost",
    audience: "Moderator i Admin",
    summary:
      "Modul „Predavanja / Druženja” služi za planiranje i dokumentiranje svih javnih događanja u organizaciji društva: stručnih predavanja, predstavljanja knjiga, radionica, posjeta arhivima i članskih druženja.",
    steps: [
      {
        title: "Unos novog predavanja ili druženja i široki prikaz detalja",
        description:
          "Klikom na „+ Novo predavanje” unesite naslov teme, ime i prezime predavača, datum i vrijeme održavanja, lokaciju, kratki sažetak izlaganja i bilješke. Klikom na postojuću stavku otvara se široki prikaz detalja preko cijele radne površine (od lijevog izbornika do desnog ruba ekrana)."
      },
      {
        title: "Slanje e-mail najave članovima i sažetka nakon održanog predavanja",
        description:
          "Kao i kod sjednica, iz detalja predavanja možete poslati e-mail pozivnicu članovima prije događaja te naknadni sažetak s materijalima ili poveznicom na snimku nakon što je predavanje održano."
      },
      {
        title: "Prilozi, evidencija prisutnih i PDF ispis",
        description:
          "Uz svako predavanje možete priložiti prezentaciju, plakat ili fotografije, evidentirati prisutne te ispisati PDF izvještaj o održanom događanju. Sva predavanja automatski ulaze u Generator periodičkih izvješća."
      }
    ]
  },
  {
    id: "library",
    number: 8,
    title: "Knjižnica društva i Korisni linkovi",
    subtitle: "Katalog knjiga, časopisa „Rodoslovlje”, vanjskih kataloga i rodoslovnih web-izvora",
    category: "rad_drustva",
    icon: Library,
    route: "/library",
    badge: "Fond i izvori",
    audience: "Svi članovi",
    summary:
      "Knjižnica društva omogućuje pregled cjelokupnog knjižničnog fonda HRD „Pavao Ritter Vitezović” (knjiga, zbornika i časopisa), praćenje skeniranih i digitaliziranih izdanja te pristup bazi provjerenih rodoslovnih poveznica.",
    steps: [
      {
        title: "1. Katalog knjiga, Časopisi i Vanjske knjižnice (/library)",
        description:
          "Modul Knjižnica podijeljen je u pregledne kartice:",
        bullets: [
          "Knjige: popis svih monografija, rodoslovlja i priručnika s autorom, godinom izdanja, izdavačem, signaturom/lokacijom, brojem primjeraka i dostupnošću.",
          "Časopisi i periodika: evidencija izdanja glasila „Rodoslovlje” i drugih stručnih časopisa.",
          "Oznake „Skenirano” i „Digitalizirano”: svaka publikacija može imati oznaku je li skenirana i/ili digitalizirana (OCR), uz mogućnost prilaganja digitalnih datoteka (PDF).",
          "Vanjske knjižnice: popis povezanih kataloga drugih ustanova."
        ]
      },
      {
        title: "2. Korisni linkovi i rodoslovne baze (/links)",
        description:
          "U posebnom modulu „Linkovi” u lijevom izborniku nalazi se zbirka najvažnijih domaćih i međunarodnih portala za rodoslovna istraživanja (FamilySearch, Matične knjige, ARHiNET, Acta Croatica, katastri, vojni arhivi). Svaki link sadrži naziv, kategoriju i kratki opis onoga što se na toj stranici može pronaći."
      }
    ]
  },
  {
    id: "projects",
    number: 9,
    title: "Projekti (/projects) i Istraživanja (/research)",
    subtitle: "Dva odvojena modula: upravljanje projektima društva te evidencija i obrada rodoslovnih upita građana",
    category: "rad_drustva",
    icon: FolderKanban,
    route: "/projects",
    badge: "Projekti i istraživanja",
    audience: "Svi članovi",
    summary:
      "Projekti (/projects) i Istraživanja (/research) djeluju kao dva zasebna modula u glavnoj navigaciji s neovisnim pravima pristupa: 1) Projekti društva i 2) Istraživanja (upiti građana i kronološko praćenje obrade).",
    steps: [
      {
        title: "1. Projekti društva (Izbornik „PROJEKTI” / /projects)",
        description:
          "Služi za praćenje istraživačkih, izdavačkih i digitalizacijskih projekata društva:",
        bullets: [
          "Za svaki projekt vodi se naziv, opis, voditelj projekta, članovi tima, status (U pripremi, Aktivno, Na čekanju, Završeno) i postotak dovršenosti (0–100%).",
          "Suradnički obrasci i bilješke: mogućnost vođenja strukturiranih zapisa suradnika na projektu prema predlošcima definiranim u Postavkama."
        ]
      },
      {
        title: "2. Istraživanja i upiti (Izbornik „ISTRAŽIVANJA” / /research)",
        description:
          "Samostalni modul za središnju evidenciju svih rodoslovnih upita koje građani, iseljenici ili istraživači šalju društvu (o podrijetlu prezimena, precima ili matičnim knjigama):",
        bullets: [
          "Unos i pregled upita: svaki upit sadrži ime i kontakt podnositelja, e-mail adresu, predmet/prezime i mjesto istraživanja, tekst upita i datum zaprimanja.",
          "Statusi obrade: upit prolazi kroz statuse (Zaprimljeno, U radu, Završeno) uz kronološko praćenje dodjela, poslanih e-mailova i odgovora osoba.",
          "Odgovaranje i bilješke istraživača: ovlašteni članovi mogu upisati rezultate svog istraživanja uz upit i poslati odgovor podnositelju."
        ],
        tips: [
          "Pristup modulima dodjeljuje se neovisno: član može imati pristup samo modulu „PROJEKTI” (/projects), samo modulu „ISTRAŽIVANJA” (/research) na jednoj ili više razina (Zaprimljeno / U radu / Završeno), ili objema stavkama odvojeno."
        ]
      }
    ]
  },
  {
    id: "archive",
    number: 10,
    title: "Arhiv — Evidencija kontaktiranja članova i Google Drive",
    subtitle: "Inline popis svih članova (uklj. preminule) s kontakt podacima za prikupljanje građe i Google Drive oblak",
    category: "rad_drustva",
    icon: Archive,
    route: "/archive",
    badge: "Arhivska građa",
    audience: "Svi članovi",
    summary:
      "Modul Arhiv (/archive) aktiviran je kao brza inline evidencija kontaktiranja svih članova društva (uključujući i preminule radi kontakta s obitelji i nasljednicima) za prikupljanje arhivske građe, uz odvojenu integraciju s Google Drive diskom društva (/drive).",
    steps: [
      {
        title: "1. Evidencija kontaktiranja članova i građe (/archive)",
        description:
          "Tablica se automatski povezuje na postojeće članove i prikazuje isključivo ime, prezime (uz oznaku † za preminule) i osnovne kontakt podatke (e-mail, mobitel, fiksni telefon i adresu), bez otvaranja cjelovitog kartona na klik imena. Inline možete označiti: Kontaktiran (Da/Ne), Kada je kontaktiran (DD/MM/YYYY), Rezultat kontakta (Građa dogovorena, Građa preuzeta, Dogovor u tijeku, Kontaktirana obitelj, itd.) te slobodnu Napomenu tko i kada treba preuzeti građu. Članovi s oznakom „Ne kontaktirati” jasno su istaknuti crvenim upozorenjem bez klikabilnih kontakt linkova i bez mogućnosti označavanja kontakta. Klikom na gumb „DOPUNI PODATKE” otvara se prozor za dopunu osobnih podataka i rođenja te kontakta i prebivališta (spremanje gumbom „SPREMI I ZATVORI”). Podržan je i izvoz u CSV."
      },
      {
        title: "2. Google Drive integracija (/drive)",
        description:
          "Omogućuje izravan pregled mapa i datoteka koje se nalaze u službenoj Google Drive mapi društva, bez potrebe da korisnici imaju vlastiti Google račun ili posebnu prijavu.",
        bullets: [
          "U Postavkama sustava Administrator može uključiti opciju „Samo preuzimanje” (Read-Only način) kako članovi ne bi mogli slučajno obrisati datoteke na Google Driveu."
        ]
      }
    ]
  },
  {
    id: "gmail",
    number: 11,
    title: "INBOX — Službena Gmail korespondencija društva",
    subtitle: "Čitanje i slanje službene e-pošte uz automatsku evidenciju tko je pročitao i tko odgovorio",
    category: "komunikacija",
    icon: Mail,
    route: "/gmail",
    badge: "Gmail integracija",
    audience: "Moderator i Admin",
    summary:
      "Modul „INBOX” je službeni e-mail klijent društva izravno povezan s Gmail računom društva. Sve poruke povlače se u stvarnom vremenu s Google poslužitelja (ne zauzimaju prostor na disku aplikacije), dok sustav automatski vodi evidenciju tko je iz uprave pročitao pojedini e-mail i tko je na njega odgovorio.",
    steps: [
      {
        title: "1. Pregled mapa: Primljeno, Poslano, Nacrti i Pretraživanje",
        description:
          "U lijevom dijelu INBOX-a birate mapu (Primljena pošta, Poslano, Važno itd.), a putem tražilice na vrhu možete pretraživati sve e-mailove po pošiljatelju, predmetu ili ključnoj riječi."
      },
      {
        title: "2. Pametne oznake u boji: „Pročitao/la (bez odgovora)” i „Odgovorio/la”",
        description:
          "Kako bi više članova uprave moglo usklađeno raditi na istoj službenoj e-mail adresi bez dupliranja posla ili zaboravljenih poruka, sustav koristi pametne oznake:",
        bullets: [
          "Narančasta oznaka „Pročitao/la: Ime Prezime (bez odgovora)”: čim netko iz uprave otvori primljeni e-mail na koji još nije odgovoreno, sustav bilježi tko ga je otvorio i kada. Tako ostali članovi uprave vide da je poruka pogledana, ali da još čeka odgovor.",
          "Obojena oznaka „Poslao/la” ili „Odgovorio/la: Ime Prezime”: čim netko odgovori na e-mail ili pošalje novu poruku iz aplikacije, oznaka „bez odgovora” nestaje i trajno se prikazuje ime osobe koja je odgovorila u njezinoj prepoznatljivoj boji."
        ],
        tips: [
          "Administrator u „Postavke -> Općenito” upisuje svoje puno ime i prezime u polje „Ime i prezime Administratora” kako bi na e-mailovima pisalo njegovo stvarno ime."
        ]
      },
      {
        title: "3. Pisanje novog e-maila, odgovaranje i privitci",
        description:
          "Klikom na „Nova poruka” ili „Odgovori” otvara se uređivač u kojem možete upisati tekst, dodati privitke s računala i poslati službeni e-mail u ime društva."
      }
    ]
  },
  {
    id: "donations",
    number: 12,
    title: "Donacije, Kampanje i Pametna tražilica tvrtki",
    subtitle: "Pronalazak potencijalnih donatora, AI generiranje zamolbi, HUB-3 uplatnice i evidencija uplata",
    category: "komunikacija",
    icon: Sparkles,
    route: "/admin/donations",
    badge: "Samo Administrator",
    audience: "Samo Administrator",
    summary:
      "Modul „Donacije & Kampanje” je specijalizirani sustav za prikupljanje donacija i sponzorstava za projekte društva (npr. nabavu knjižnog skenera, digitalizaciju ili tisak knjiga). Objedinjuje tražilicu hrvatskih tvrtki/udruga/zaklada, izradu personaliziranih zamolbi s HUB-3 uplatnicom i 2D barkodom te praćenje uplaćenih donacija.",
    steps: [
      {
        title: "1. Ručni upis donatora / uplaćene donacije (+ Upiši donatora / donaciju)",
        description:
          "Ako je fizička ili pravna osoba uplatila donaciju izravno na žiro-račun društva (neovisno o e-mail kampanji), kliknite na zeleni gumb „+ Upiši donatora / donaciju” u gornjem desnom kutu. Upišite naziv donatora, kontakt, iznos u EUR, datum uplate i napomenu. Iznos se odmah pribraja u ukupnu statistiku donacija i ulazi u periodička izvješća."
      },
      {
        title: "2. Tražilica registara + Automatski Google/Web Fallback",
        description:
          "U kartici „Tražilica & Baza” upišite ključnu riječ (npr. djelatnost ili grad) za pronalazak potencijalnih donatora:",
        bullets: [
          "Sustav najprije pretražuje službene hrvatske registre (Sudski registar tvrtki, Registar udruga, Registar zaklada).",
          "Ako u registrima nema rezultata, automatski se pokreće web-pretraga koja pronalazi web-stranice tvrtki, izdvaja njihove službene kontakt e-mail adrese i sprema ih u tablicu potencijalnih donatora.",
          "Zaštita od duplog pretraživanja: ispod tražilice prikazuju se svi već pretraživani pojmovi s datumom i brojem rezultata kako ne biste dvaput pretraživali isti pojam."
        ]
      },
      {
        title: "3. Generiranje zamolbe, pregled predloška (s uplatnicom i barkodom) i slanje",
        description:
          "Za svakog potencijalnog donatora u bazi možete pripremiti personalizirano pismo zamolbe (ručno ili pomoću Gemini AI asistenta):",
        bullets: [
          "Pravilo pregleda prije slanja: klikom na pregled e-maila vidite točan izgled zamolbe s ugrađenom HUB-3 uplatnicom i 2D barkodom za plaćanje.",
          "Tek kada ste zadovoljni tekstom, kliknite „Odobri i pošalji” — e-mail se šalje i trajno bilježi u Registru poslanih zamolbi s mogućnošću naknadnog označavanja uplaćene donacije."
        ]
      }
    ]
  },
  {
    id: "reports",
    number: 13,
    title: "Generator periodičkih izvješća (Tekst za zapisnik, PDF i CSV)",
    subtitle: "Izrada cjelovitog izvješća o radu društva za Skupštinu ili nadležna tijela",
    category: "uprava_sustav",
    icon: FileBarChart,
    route: "/reports",
    badge: "Izvješćivanje",
    audience: "Moderator i Admin",
    summary:
      "Modul „Izvješća” omogućuje da u nekoliko sekundi generirate potpuno izvješće o svim aktivnostima društva za bilo koje odabrano vremensko razdoblje (npr. zadnjih 30 dana, tekuća godina, prošla godina ili proizvoljni raspon datuma Od – Do).",
    steps: [
      {
        title: "Što sve ulazi u periodičko izvješće",
        description:
          "Za odabrani raspon datuma sustav automatski prikuplja i taksativno navodi:",
        bullets: [
          "Sve novoupisane članove i statistiku članstva.",
          "Sve održane sjednice, zaključke i rezultate provedenih elektroničkih glasovanja.",
          "Sva održana javna predavanja, radionice i druženja.",
          "Sve novounesene knjige i časopise u knjižnici te nove dokumente u arhivu.",
          "Sve aktivne i završene projekte te obrađene rodoslovne upite.",
          "Statistiku e-mail korespondencije (broj poslanih i primljenih poruka te tko ih je iz uprave poslao) i pregled prikupljenih donacija."
        ]
      },
      {
        title: "Tri načina preuzimanja: Čisti tekst za Word, službeni PDF i CSV",
        description:
          "Generirano izvješće možete jednim klikom kopirati kao čisti strukturirani tekst (za izravno lijepljenje u zapisnik Skupštine ili Word dokument), ispisati kao službeni PDF dokument s zaglavljem društva ili izvesti u CSV tablicu."
      }
    ]
  },
  {
    id: "chronicle-logs",
    number: 14,
    title: "Ljetopis društva i Dnevnik aktivnosti (Logovi)",
    subtitle: "Kronološka spomenica društva i sigurnosna revizijska evidencija svih radnji u sustavu",
    category: "uprava_sustav",
    icon: BookOpen,
    route: "/chronicle",
    badge: "Povijest i nadzor",
    audience: "Moderator i Admin",
    summary:
      "Ova dva modula osiguravaju trajno čuvanje povijesti društva (Ljetopis) te potpunu transparentnost i sigurnost svakodnevnog rada u aplikaciji (Logovi).",
    steps: [
      {
        title: "1. Ljetopis društva (/chronicle)",
        description:
          "Digitalna spomenica u kojoj se kronološki, po godinama i datumima, bilježe najvažniji događaji, osnivanje, obljetnice, nagrade i prekretnice u radu HRD „Pavao Ritter Vitezović”."
      },
      {
        title: "2. Dnevnik aktivnosti — Revizijski logovi (/logs)",
        description:
          "Automatski sigurnosni zapisnik koji bilježi tko se i kada prijavio u sustav, tko je pregledao ili izmijenio podatke člana, poslao e-mail (pozivnicu, opomenu, rođendansku čestitku), glasovao ili izradio sigurnosnu kopiju. Zapise je moguće pretraživati po korisniku, vrsti radnje i datumu."
      }
    ]
  },
  {
    id: "settings",
    number: 15,
    title: "Postavke sustava, Pragovi članstva, E-mail predlošci i Trezor lozinki",
    subtitle: "Detaljan vodič kroz sve administrativne postavke aplikacije",
    category: "uprava_sustav",
    icon: Settings,
    route: "/settings",
    badge: "Samo Administrator",
    audience: "Samo Administrator",
    summary:
      "U modulu „Postavke” Administrator upravlja pravilima izračuna statusa članstva, izgledom i potpisom društva, SMTP poslužiteljem, predlošcima svih e-mail obavijesti, integracijama s Googleom i Dropboxom te sigurnosnim Trezorom lozinki.",
    steps: [
      {
        title: "1. Pragovi članstva i pravilo za članove bez uplate",
        description:
          "U kartici „Općenito” pod odjeljkom „Pragovi članstva” određujete kako sustav automatski računa statuse članova:",
        bullets: [
          "Prag za status DUG (u danima, npr. 365 dana): nakon koliko dana od zadnje evidentirane uplate član prelazi iz statusa Podmireno u status DUG.",
          "Prag za status NEAKTIVAN (u danima, npr. 730 dana): nakon koliko dana od zadnje uplate član prelazi iz aktivnog članstva u status NEAKTIVAN.",
          "Opcija (checkbox) „Član bez ijedne upisane uplate ne može biti aktivan član”: kada je ova kvačica uključena i spremljena, svaki član koji u evidenciji nema upisanu niti jednu uplatu članarine automatski dobiva status NEAKTIVAN, neovisno o tome kada je upisan u društvo. Od ovog pravila automatski su izuzeti isključivo počasni članovi i članovi kojima je označeno da su oslobođeni plaćanja članarine."
        ],
        tips: [
          "Svaka promjena pragova članstva nakon klika na „Spremi pragove” automatski preračunava i usklađuje statuse svih članova u bazi."
        ]
      },
      {
        title: "2. Identitet društva, Ime Administratora, Funkcije i Lokacije sjednica",
        description:
          "U istoj kartici možete učitati službeni logotip društva, upisati puno „Ime i prezime Administratora” (koje se koristi u potpisima i oznakama e-mailova u INBOX-u), definirati popis dostupnih funkcija u društvu te vrste i lokacije sjednica."
      },
      {
        title: "3. SMTP poslužitelj i E-mail predlošci (Članarine, Pozivnice, Sjednice, Predavanja, Rođendani)",
        description:
          "U kartici e-mail postavki konfigurira se odlazni SMTP poslužitelj te zadani tekstovi svih e-mail predložaka:",
        bullets: [
          "Predložak obavijesti o članarini + učitavanje slike HUB-3 uplatnice i 2D barkoda.",
          "Predložak pozivnice za pristup sustavu (varijable {email}, {tempPassword}, {link}).",
          "Predlošci za obavezno glasovanje, sazivanje i sažetak sjednice te najavu i sažetak predavanja.",
          "Predložak za rođendansku čestitku (naslov i tekst čestitke s varijablom {{name}} za ime slavljenika)."
        ]
      },
      {
        title: "4. Trezor lozinki i platformi (Password Vault)",
        description:
          "Posebno zaštićen dio Postavki (dostupan isključivo Administratoru) u kojem se čuvaju pristupni podaci svih vanjskih servisa društva (domena, hosting, SSH/PuTTY, Google račun, Dropbox, e-mail računi, društvene mreže). Podržava maskiranje lozinki, kopiranje jednim klikom, generator jakih lozinki i ispis za potrebe primopredaje dužnosti."
      }
    ]
  },
  {
    id: "backup",
    number: 16,
    title: "Sigurnosne kopije (Backup), Dropbox sinkronizacija i Dry-Run provjera",
    subtitle: "Zaštita svih baza podataka (/var/data/prv_data/db/) i siguran oporavak sustava",
    category: "uprava_sustav",
    icon: Database,
    route: "/settings",
    badge: "Zaštita podataka",
    audience: "Samo Administrator",
    summary:
      "Sve tri SQLite baze podataka sustava (`app.db`, `mailcrawl.db`, `company_scraper.db`) pohranjene su na centraliziranoj lokaciji `/var/data/prv_data/db/`. Sustav omogućuje automatsku i ručnu izradu komprimiranih sigurnosnih kopija lokalno i u oblaku (Dropbox).",
    steps: [
      {
        title: "1. Izrada cjelovite sigurnosne kopije (ZIP + Dropbox sinkronizacija)",
        description:
          "U „Postavke -> Sigurnosne kopije” možete izraditi cjelovitu .zip sigurnosnu kopiju svih odvojenih SQLite baza (app.db, mailcrawl.db, company_scraper.db) i mape uploads/ uz manifest.json, automatski je poslati na Dropbox ili preuzeti JSON snimku cijelog sustava."
      },
      {
        title: "2. Dry-Run simulacija povrata (Provjera integriteta i odvojenosti baza bez rizika)",
        description:
          "Pored svake sigurnosne kopije nalazi se gumb za simulaciju povrata (Dry-Run). On u izoliranom sandboxu provjerava SQLite integritet sve tri odvojene baze, potvrđuje da tablice nisu pomiješane, provjerava strane ključeve, kritične stupce sheme, sve privitke u uploads/ i ispisuje usporedbu broja zapisa naspram živog sustava."
      },
      {
        title: "3. Oporavak sustava (Restore) iz sigurnosne kopije",
        description:
          "U slučaju potrebe za vraćanjem podataka na raniju točku, odaberite željenu .zip ili .db sigurnosnu kopiju; sustav prije povrata izrađuje automatsku pre-restore kopiju na Dropboxu i automatski sinkronizira eventualne novije stupce baze."
      },
      {
        title: "4. Smeće i povrat obrisanih stavki (/trash — samo za Administratora)",
        description:
          "Svaka stavka koju bilo koji korisnik obriše u sustavu (članovi, predavanja, sjednice, projekti, upiti, knjige, kontakti, linkovi, glasovanja, uplate, prilozi, Drive datoteke ili Gmail poruke) automatski se premješta u Smeće uz točnu evidenciju tko ju je i kada obrisao. Jedino Administrator vidi modul Smeće i može u bilo kojem trenutku pregledati obrisane podatke te izvršiti povrat (Undelete)."
      }
    ]
  },
  {
    id: "accessibility",
    number: 17,
    title: "Pristupačnost za slabovidne (Povećani prikaz) i Popis promjena",
    subtitle: "Prilagodba veličine slova jednim klikom i praćenje nadogradnji sustava",
    category: "pocetak",
    icon: ZoomIn,
    route: "/changelog",
    badge: "Prilagođeno svima",
    audience: "Svi članovi",
    summary:
      "Aplikacija je dizajnirana tako da bude ugodna i čitljiva svim generacijama članova, uz trenutnu mogućnost povećanja prikaza i potpuni uvid u povijest razvoja sustava.",
    steps: [
      {
        title: "Gumb „POVEĆAJ PRIKAZ” / „SMANJI PRIKAZ”",
        description:
          "U donjem dijelu lijevog bočnog izbornika nalazi se istaknuti plavi gumb „POVEĆAJ PRIKAZ”. Klikom na njega sva slova, gumbi, obrasci i tablice u cijeloj aplikaciji trenutačno se povećavaju za 25% uz pojačanu čitljivost. Sustav pamti vaš odabir i prilikom sljedeće prijave."
      },
      {
        title: "Praćenje verzije i Popis promjena (/changelog)",
        description:
          "Svaka nadogradnja sustava označena je verzijom u formatu datuma (npr. v20.11.2026) u podnožju ekrana. Klikom na oznaku verzije ili na „Popis promjena (Changelog)” otvara se kronološki pregled svih novih funkcionalnosti, poboljšanja i ispravaka."
      }
    ]
  }
]

const FAQ_ITEMS = [
  {
    question: "Upisao sam novog člana i stavio mu datum učlanjenja, ali mu je status i dalje „Neaktivan”. Zašto?",
    answer:
      "Provjerite je li u „Postavke -> Općenito -> Pragovi članstva” uključena opcija „Član bez ijedne upisane uplate ne može biti aktivan član”. Kada je to pravilo uključeno, član ne može biti aktivan dok mu u kartonu člana ne upišete barem jednu uplatu članarine (osim ako mu označite da je Počasni član ili Oslobođen plaćanja članarine)."
  },
  {
    question: "Što znači kada je redak člana u tablici sivo zasjenjen i ima crni križ (✝) u stupcu Uloga?",
    answer:
      "To je vizualna oznaka za preminulog člana. Sivi transparentni sloj preko retka i crni križ (✝) u stupcu Uloga omogućuju da u matičnoj knjizi odmah razlikujete preminule članove, dok njihovi povijesni podaci i rodoslovni rad ostaju trajno sačuvani u registru."
  },
  {
    question: "Zašto kod počasnog člana u tablici više ne piše tekst „Počasni član”, nego se vidi samo ikona medalje?",
    answer:
      "Radi veće preglednosti tablice! U stupcu „Uloga” prikazuju se samo trenutno aktivne funkcije u tijelima društva (npr. Tajnik, Upravni odbor), dok se status počasnog člana prikazuje kompaktnom zlatnom medaljom (🏅). Prelaskom miša preko medalje ispisuje se opis „Počasni član”."
  },
  {
    question: "Hoće li se e-mail (pozivnica, opomena ili rođendanska čestitka) poslati odmah čim kliknem na ikonu u tablici?",
    answer:
      "Neće! U cijeloj aplikaciji vrijedi pravilo sigurnosnog pregleda: klikom na gumb za slanje e-maila uvijek se najprije otvara prozor s predloškom i prikazom poruke. Tekst i naslov možete na miru pregledati i urediti, a e-mail se šalje tek kada kliknete na gumb „Odobri i pošalji”."
  },
  {
    question: "Gdje mogu vidjeti je li članu već poslana pozivnica, opomena za članarinu ili rođendanska čestitka?",
    answer:
      "Na dva mjesta: 1) izravno u tablici članova (ispod e-mail adrese za pozivnicu te u stupcu Financije za opomenu i rođendansku čestitku) i 2) unutar detaljnog kartona člana (/members/[id]), gdje je zapisan točan datum i sat slanja u formatu DD/MM/YYYY HH:mm."
  },
  {
    question: "Kako članu dati pristup samo jednom dijelu aplikacije (npr. samo Upitima i istraživanjima ili samo Knjižnici)?",
    answer:
      "Otvorite karton tog člana (/members/[id]), pronađite odjeljak „Prava pristupa po modulima” i uključite kvačicu „Pregled” (i po želji „Uređivanje”) samo za željeni modul, pa spremite promjene. Član će u svom izborniku vidjeti samo module koje ste mu odobrili."
  },
  {
    question: "Imamo puno starih članova bez upisanog datuma učlanjenja ili s pogrešnim datumima uplata. Kako to najbrže urediti?",
    answer:
      "U modulu „Članovi” (kao Administrator) kliknite na gumb „Uređenje datuma i uplata” na vrhu stranice. Ondje možete filtrirati sve članove s greškom u datumu, jednim klikom upisati 01/01/2007 svima kojima nedostaje datum upisa, obrisati pogrešne uplate te kliknuti „Provjeri uplate i datume te ispravi statuse svih članova”."
  }
]

const CATEGORIES = [
  { id: "sve", label: "Sva poglavlja (17)" },
  { id: "pocetak", label: "1. Prvi koraci i pristupačnost" },
  { id: "osnovno", label: "2. Početna i Moj kutak" },
  { id: "clanstvo", label: "3. Članovi i Adresar" },
  { id: "rad_drustva", label: "4. Sjednice, Predavanja, Knjižnica, Projekti i Arhiv" },
  { id: "komunikacija", label: "5. Inbox i Donacije" },
  { id: "uprava_sustav", label: "6. Izvješća, Postavke i Backup" }
] as const

export function ManualContent() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("sve")
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({})

  const toggleSection = (id: string) => {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const expandAll = () => setCollapsedIds({})
  const collapseAll = () => {
    const next: Record<string, boolean> = {}
    for (const s of MANUAL_SECTIONS) next[s.id] = true
    setCollapsedIds(next)
  }

  const filteredSections = useMemo(() => {
    return MANUAL_SECTIONS.filter((sec) => {
      const matchesCategory = activeCategory === "sve" || sec.category === activeCategory
      if (!matchesCategory) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const inTitle = sec.title.toLowerCase().includes(q)
      const inSub = sec.subtitle.toLowerCase().includes(q)
      const inSum = sec.summary.toLowerCase().includes(q)
      const inSteps = sec.steps.some(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          (s.bullets && s.bullets.some((b) => b.toLowerCase().includes(q))) ||
          (s.tips && s.tips.some((t) => t.toLowerCase().includes(q)))
      )
      return inTitle || inSub || inSum || inSteps
    })
  }, [searchQuery, activeCategory])

  const filteredFaq = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_ITEMS
    const q = searchQuery.toLowerCase()
    return FAQ_ITEMS.filter(
      (item) => item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q)
    )
  }, [searchQuery])

  return (
    <div className="container mx-auto p-6 md:p-10 max-w-6xl space-y-8">
      {/* Zaglavlje priručnika */}
      <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/90 via-white to-amber-50/40 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
              <Book className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge className="bg-blue-600 text-white hover:bg-blue-700 font-mono text-xs">
                  Sustav „Rodoslovac” • v20.11.2026
                </Badge>
                <Badge variant="outline" className="border-amber-500/40 text-amber-800 bg-amber-50 text-xs">
                  Cjeloviti edukacijski priručnik (17 poglavlja + FAQ)
                </Badge>
              </div>
              <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                Korisnički priručnik i vodič kroz sustav „Rodoslovac”
              </h1>
              <p className="text-sm md:text-base text-slate-600 mt-1.5 max-w-3xl leading-relaxed">
                Potpune i opširne upute za članove, moderatore i administratore Hrvatskog rodoslovnog društva
                „Pavao Ritter Vitezović” — prilagođene osobama koje se prvi put susreću s aplikacijom, kao i
                naprednim korisnicima uprave.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <Printer className="h-4 w-4" />
              Ispiši priručnik
            </Button>
            <Link href="/changelog">
              <Button variant="outline" size="sm" className="gap-2 border-amber-500/40 text-amber-900 hover:bg-amber-50">
                <History className="h-4 w-4 text-[#b58442]" />
                Popis promjena (Changelog)
              </Button>
            </Link>
          </div>
        </div>

        {/* Tražilica kroz upute i filtri kategorija */}
        <div className="mt-6 pt-6 border-t border-blue-100 space-y-4 print:hidden">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pretražite upute po bilo kojem pojmu (npr. prva prijava, lozinka, rođendan, medalja, preminuli, članarina, glasovanje, 2007, backup)..."
              className="pl-10 bg-white border-slate-200 h-11 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeCategory === cat.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 text-xs text-slate-600">
                Proširi sve
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 text-xs text-slate-600">
                Sažmi sve
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Brzi vodič za potpune početnike u 5 koraka */}
      {!searchQuery && activeCategory === "sve" && (
        <Card className="border-amber-200/90 bg-gradient-to-r from-amber-50/60 via-white to-amber-50/30 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
              <Compass className="h-4 w-4 text-amber-600" />
              Prvi put ste u aplikaciji? Krenite odavde
            </div>
            <CardTitle className="font-serif text-xl text-slate-900">
              Brzi vodič za nove korisnike u 5 osnovnih pravila
            </CardTitle>
            <CardDescription className="text-xs md:text-sm text-slate-600">
              Prije čitanja detaljnih poglavlja, upoznajte 5 temeljnih principa na kojima počiva cijeli sustav „Rodoslovac”:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="rounded-xl border border-amber-200/80 bg-white p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white text-[11px]">1</span>
                  Stalni lijevi izbornik
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Lijevi izbornik je uvijek prisutan na ekranu. Bilo gdje da se nalazite (čak i u detaljima člana ili sjednice), jednim klikom prelazite u drugi modul.
                </p>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-white p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white text-[11px]">2</span>
                  Povećanje slova (A+)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ako su vam slova premala, kliknite plavi gumb <strong>„POVEĆAJ PRIKAZ”</strong> na dnu lijevog izbornika i cijela će se aplikacija povećati za 25%.
                </p>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-white p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white text-[11px]">3</span>
                  Sigurno slanje e-maila
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Niti jedan e-mail (pozivnica, opomena, čestitka) ne šalje se slučajno! Prvo se otvara predložak koji možete urediti, a šalje se tek kad kliknete <strong>„Odobri i pošalji”</strong>.
                </p>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-white p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white text-[11px]">4</span>
                  Vizualne oznake
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Počasni članovi imaju ikonu <strong>medalje (🏅)</strong>, preminuli članovi <strong>crni križ (✝)</strong> i sivi sloj preko retka, a aktivni članovi zelenu oznaku.
                </p>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-white p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white text-[11px]">5</span>
                  Format datuma
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Svi datumi u aplikaciji prikazuju se u formatu <strong>DD/MM/YYYY</strong> (npr. 15/11/2026), a kod upisa ili rođenja možete upisati i samo godinu (npr. 2007).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kazalo sadržaja */}
      <Card className="border-slate-200/80 shadow-xs print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-serif flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600" />
            Kazalo poglavlja — kliknite za brzi skok ({filteredSections.length} od {MANUAL_SECTIONS.length} prikazano)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredSections.map((sec) => {
              const Icon = sec.icon
              return (
                <a
                  key={sec.id}
                  href={`#manual-${sec.id}`}
                  onClick={() => setCollapsedIds((prev) => ({ ...prev, [sec.id]: false }))}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-800 transition-colors"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600/10 text-blue-700 font-mono font-bold text-[11px]">
                    {sec.number}.
                  </span>
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">{sec.title}</span>
                </a>
              )
            })}
            <a
              href="#manual-faq"
              className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-600 text-white font-mono font-bold text-[11px]">
                ?
              </span>
              <HelpCircle className="h-3.5 w-3.5 shrink-0 text-amber-700" />
              <span className="truncate">Često postavljana pitanja (FAQ)</span>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Detaljni prikaz svih poglavlja */}
      <div className="space-y-6">
        {filteredSections.map((sec) => {
          const Icon = sec.icon
          const isCollapsed = !!collapsedIds[sec.id]
          return (
            <Card
              key={sec.id}
              id={`manual-${sec.id}`}
              className="border-slate-200/90 shadow-xs scroll-mt-6 overflow-hidden"
            >
              <CardHeader
                className="bg-slate-50/80 border-b border-slate-100 pb-4 cursor-pointer select-none"
                onClick={() => toggleSection(sec.id)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700 border border-blue-200 font-serif font-bold">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600">
                          Poglavlje {sec.number}
                        </span>
                        {sec.badge && (
                          <Badge variant="secondary" className="text-[11px]">
                            {sec.badge}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            sec.audience === "Samo Administrator"
                              ? "border-red-200 bg-red-50 text-red-700 text-[10px]"
                              : sec.audience === "Moderator i Admin"
                              ? "border-amber-200 bg-amber-50 text-amber-800 text-[10px]"
                              : "border-emerald-200 bg-emerald-50 text-emerald-800 text-[10px]"
                          }
                        >
                          {sec.audience}
                        </Badge>
                      </div>
                      <CardTitle className="font-serif text-xl md:text-2xl text-slate-900 mt-0.5">
                        {sec.title}
                      </CardTitle>
                      <CardDescription className="text-sm text-slate-600 mt-0.5">
                        {sec.subtitle}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 print:hidden" onClick={(e) => e.stopPropagation()}>
                    {sec.route && (
                      <Link href={sec.route}>
                        <Button variant="outline" size="sm" className="text-xs h-8">
                          Otvori modul →
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-500"
                      onClick={() => toggleSection(sec.id)}
                      title={isCollapsed ? "Proširi poglavlje" : "Sažmi poglavlje"}
                    >
                      {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {!isCollapsed && (
                <CardContent className="p-6 space-y-5">
                  <p className="text-sm text-slate-700 leading-relaxed bg-blue-50/40 border border-blue-100 rounded-xl p-4">
                    {sec.summary}
                  </p>

                  <div className="space-y-4">
                    {sec.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200/80 bg-white p-4 md:p-5 space-y-3"
                      >
                        <h4 className="font-semibold text-sm md:text-base text-slate-900 flex items-center gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                            {idx + 1}
                          </span>
                          {step.title}
                        </h4>
                        <p className="text-sm text-slate-600 leading-relaxed pl-8">
                          {step.description}
                        </p>

                        {step.bullets && step.bullets.length > 0 && (
                          <ul className="pl-12 pr-2 space-y-2 list-disc text-sm text-slate-700 leading-relaxed">
                            {step.bullets.map((b, bIdx) => (
                              <li key={bIdx}>{b}</li>
                            ))}
                          </ul>
                        )}

                        {step.tips && step.tips.length > 0 && (
                          <div className="pl-8 pt-1 space-y-1.5">
                            {step.tips.map((tip, tIdx) => (
                              <div
                                key={tIdx}
                                className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50/80 border border-amber-200/70 rounded-lg px-3 py-2.5"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                                <span>
                                  <strong>Korisni savjet:</strong> {tip}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {step.warning && (
                          <div className="pl-8 pt-1">
                            <div className="flex items-start gap-2 text-xs text-red-900 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600 mt-0.5" />
                              <span>
                                <strong>Važno:</strong> {step.warning}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}

        {filteredSections.length === 0 && (
          <Card className="p-12 text-center border-dashed">
            <HelpCircle className="h-10 w-10 text-slate-400 mx-auto mb-3" />
            <h3 className="font-serif text-lg font-bold text-slate-800">
              Nema pronađenih poglavlja za pojam „{searchQuery}”
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Pokušajte upisati drugu ključnu riječ ili kliknite na kategoriju „Sva poglavlja (17)”.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearchQuery("")
                setActiveCategory("sve")
              }}
            >
              Prikaži cijeli priručnik
            </Button>
          </Card>
        )}
      </div>

      {/* Često postavljana pitanja (FAQ) */}
      {filteredFaq.length > 0 && (
        <Card id="manual-faq" className="border-amber-200/90 shadow-xs scroll-mt-6">
          <CardHeader className="bg-amber-50/60 border-b border-amber-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
              <HelpCircle className="h-4 w-4 text-amber-600" />
              Pomoć u svakodnevnom radu
            </div>
            <CardTitle className="font-serif text-2xl text-slate-900">
              Često postavljana pitanja i rješavanje nedoumica (FAQ)
            </CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Odgovori na najčešća pitanja članova, tajnika, blagajnika i administratora.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {filteredFaq.map((faq, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                <h4 className="font-semibold text-sm md:text-base text-slate-900 flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white text-xs font-bold mt-0.5">
                    ?
                  </span>
                  <span>{faq.question}</span>
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed pl-8">
                  {faq.answer}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sigurnosna napomena i tehnički sažetak na dnu */}
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-base text-emerald-950">
                Sigurnost podataka i arhitektura pohrane
              </h3>
              <p className="text-xs md:text-sm text-emerald-900/80 leading-relaxed">
                Sve SQLite baze podataka sustava (`app.db`, `mailcrawl.db`, `company_scraper.db`) pohranjuju se na
                centraliziranoj lokaciji <code className="font-mono font-bold">/var/data/prv_data/db/</code> i obuhvaćene
                su automatskim te ručnim sigurnosnim kopijama s ugrađenim Dry-Run mehanizmom provjere.
              </p>
            </div>
          </div>
          <Link href="/changelog" className="shrink-0 print:hidden">
            <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white">
              Pregledaj Changelog (v20.11.2026)
            </Button>
          </Link>
        </CardContent>
      </Card>

      <footer className="pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Sustav „Rodoslovac” • Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović” • Verzija v20.11.2026</p>
        <div className="flex gap-5 font-medium text-blue-600">
          <span className="flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> Centralizirana baza /var/data/prv_data/db/
          </span>
          <Link href="/changelog" className="hover:underline">
            Popis promjena
          </Link>
        </div>
      </footer>
    </div>
  )
}
