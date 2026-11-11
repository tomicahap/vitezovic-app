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
  Eye,
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
  HeartHandshake,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Info,
  KeyRound
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface ManualSection {
  id: string
  number: number
  title: string
  subtitle: string
  category: "osnovno" | "clanstvo" | "rad_drustva" | "komunikacija" | "uprava_sustav"
  icon: React.ElementType
  badge?: string
  route?: string
  summary: string
  steps: {
    title: string
    description: string
    tips?: string[]
  }[]
}

const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "dashboard",
    number: 1,
    title: "Nadzorna ploča (Početna stranica)",
    subtitle: "Brzi pregled stanja društva, nadolazećih sjednica, obavijesti i statistike",
    category: "osnovno",
    icon: LayoutDashboard,
    route: "/",
    badge: "Svi korisnici",
    summary:
      "Nadzorna ploča je središnje mjesto koje se otvara odmah nakon prijave u sustav. Prikazuje ključne brojke u stvarnom vremenu, aktivna glasovanja, nadolazeća predavanja i brze prečace.",
    steps: [
      {
        title: "Pregled statističkih kartica na vrhu",
        description:
          "Na vrhu zaslona nalaze se kartice s brojem aktivnih članova, ukupnim brojem sjednica, knjiga u knjižnici, tekućih projekata i arhivskih zapisa. Klikom na pojedinu karticu otvara se taj modul.",
        tips: [
          "Podaci se osvježavaju automatski pri svakom otvaranju stranice.",
          "Ako postoji otvoreno obavezno glasovanje, sustav će vas odmah upozoriti skočnim prozorom."
        ]
      },
      {
        title: "Obavijesti, rođendani i brzi zadaci",
        description:
          "U središnjem dijelu vidite najnovije obavijesti uprave, popis nadolazećih sjednica ili predavanja te kratki pregled vaših osobnih podsjetnika iz modula 'Moj kutak'."
      }
    ]
  },
  {
    id: "personal",
    number: 2,
    title: "Moj kutak (Osobne bilješke i Todo zadaci)",
    subtitle: "Vaš privatni radni prostor za bilješke, ideje i zadatke s prioritetima",
    category: "osnovno",
    icon: StickyNote,
    route: "/personal",
    badge: "Osobni modul",
    summary:
      "Svaki prijavljeni korisnik ima vlastiti privatni prostor 'Moj kutak' u kojem može voditi osobne bilješke i popis zadataka (To-Do listu) vezanih uz rodoslovna istraživanja ili obveze u društvu.",
    steps: [
      {
        title: "Dodavanje i uređivanje osobnih bilješki",
        description:
          "Kliknite na gumb '+ Nova bilješka', upišite naslov i sadržaj (npr. podatke o matičnim knjigama koje istražujete) te odaberite boju kartice radi lakšeg snalaženja.",
        tips: [
          "Vaše osobne bilješke vidljive su isključivo vama.",
          "Možete ih pretraživati po ključnoj riječi u polju na vrhu."
        ]
      },
      {
        title: "Upravljanje zadacima (To-Do lista) i prioritetima",
        description:
          "U kartici 'Zadaci' dodajte novi zadatak, odredite mu prioritet (Nisko, Srednje, Visoko) i rok izvršenja. Kada zadatak obavite, označite kvačicu pored njega kako bi bio prekrižen."
      }
    ]
  },
  {
    id: "members",
    number: 3,
    title: "Članovi i Matična knjiga društva",
    subtitle: "Evidencija članstva, praćenje članarina, funkcija, iskaznica i uplatnica",
    category: "clanstvo",
    icon: Users,
    route: "/members",
    badge: "Matični registar",
    summary:
      "Modul 'Članovi' služi za vođenje službene matične knjige članova Hrvatskog rodoslovnog društva 'Pavao Ritter Vitezović', uključujući statuse članarina, povijest uplata i dužnosti u tijelima društva.",
    steps: [
      {
        title: "Razumijevanje statusa i oznaka u boji",
        description:
          "Svaki član na popisu ima obojenu oznaku statusa: ZELENO (AKTIVAN – članarina uredno podmirena), ŽUTO/NARANČASTO (DUG – članarina nije plaćena za tekuću godinu), PLAVO (POČASNI ČLAN – oslobođen plaćanja članarine) i CRVENO (ISPISAN / PREMINUO).",
        tips: [
          "Pomoću filtara na vrhu možete prikazati samo članove s dugovanjem ili samo aktivne članove.",
          "Pretraživanje radi trenutno po imenu, prezimenu, OIB-u, e-mailu ili gradu."
        ]
      },
      {
        title: "Upis novog člana i uređivanje kartona člana",
        description:
          "Klikom na '+ Dodaj člana' otvara se obrazac za upis osobnih podataka, kontakta, OIB-a, datuma učlanjenja, funkcije u društvu (npr. Predsjednik, Tajnik, Upravni odbor, Nadzorni odbor, Sud časti) i rodoslovnih interesa (prezimena i mjesta koja član istražuje)."
      },
      {
        title: "Evidencija članarina i ispis uplatnica (HUB-3A / barkod)",
        description:
          "Klikom na ime člana otvara se njegov detaljni karton. U kartici 'Članarine' možete evidentirati uplatu za određenu godinu ili generirati uplatnicu s 2D barkodom za plaćanje mobilnim bankarstvom."
      }
    ]
  },
  {
    id: "contacts",
    number: 4,
    title: "Adresar i Vanjski kontakti",
    subtitle: "Baza suradnika, državnih arhiva, župnih ureda, muzeja i gostiju predavača",
    category: "clanstvo",
    icon: Contact,
    route: "/contacts",
    badge: "Imenik suradnika",
    summary:
      "Za razliku od modula Članovi, u Adresaru se vode kontakti osoba i ustanova koje nisu formalni članovi društva, ali s kojima društvo surađuje (arhivisti, povjesničari, mediji, donatori, institucije).",
    steps: [
      {
        title: "Pretraživanje i kategorizacija kontakata",
        description:
          "Kontakte možete filtrirati po vrsti ustanove ili kategoriji (Arhiv, Muzej, Župa, Znanstvenik, Mediji, Ostalo) te jednim klikom kopirati e-mail adresu ili broj telefona."
      },
      {
        title: "Dodavanje novog kontakta",
        description:
          "Kliknite '+ Novi kontakt' i unesite ime i prezime, organizaciju/ustanovu, ulogu, telefon, e-mail te napomenu o dosadašnjoj suradnji."
      }
    ]
  },
  {
    id: "meetings",
    number: 5,
    title: "Sjednice i E-glasovanje",
    subtitle: "Sazivanje Skupštine i Upravnog odbora, kvorum, elektroničko glasovanje i zapisnici",
    category: "rad_drustva",
    icon: Calendar,
    route: "/meetings",
    badge: "Upravljanje i odluke",
    summary:
      "Omogućuje organizaciju sjednica Skupštine, Upravnog odbora i Nadzornog odbora, objavu dnevnog reda, provođenje službenog elektroničkog glasovanja (ZA / PROTIV / SUZDRŽAN) i pohranu zapisnika.",
    steps: [
      {
        title: "Kako glasovati kada je otvoreno E-glasovanje",
        description:
          "Ako je administrator otvorio glasovanje (anketu/odluku), možete glasovati izravno u modulu Sjednice ili putem prozora 'Obavezno glasovanje' pri prijavi. Odaberite željenu opciju i kliknite 'Glasuj'.",
        tips: [
          "Sustav automatski bilježi tko je glasovao, sprječava višestruko glasovanje iste osobe i izračunava postotak te kvorum.",
          "Svi glasovi ulaze u službeni izvještaj i zapisnik sjednice."
        ]
      },
      {
        title: "Kreiranje nove sjednice i točaka dnevnog reda (Admin/Moderator)",
        description:
          "Klikom na '+ Nova sjednica' unesite naziv sjednice, datum, vrijeme, lokaciju (uživo ili online) i točke dnevnog reda. Nakon održane sjednice u istu karticu upišite zaključke, prisutne članove i priložite cjeloviti zapisnik. Postojeći naslov sjednice možete bilo kada izmijeniti klikom na ikonu olovčice na kartici ili izravno u zaglavlju detalja sjednice."
      }
    ]
  },
  {
    id: "lectures",
    number: 6,
    title: "Predavanja, Radionice i Druženja",
    subtitle: "Raspored javnih tribina, predavača, sažetaka izlaganja i evidencija posjećenosti",
    category: "rad_drustva",
    icon: Mic,
    route: "/lectures",
    badge: "Javna djelatnost",
    summary:
      "Evidencija svih javnih predavanja, predstavljanja knjiga, stručnih ekskurzija i članskih druženja u organizaciji društva.",
    steps: [
      {
        title: "Unos i pregled predavanja",
        description:
          "Za svako predavanje bilježi se naslov teme, ime i biografija predavača, datum i mjesto održavanja, sažetak predavanja, broj prisutnih posjetitelja te poveznica na video snimku ili prezentaciju. Postojeći naslov predavanja ili druženja možete bilo kada promijeniti klikom na ikonu olovčice na kartici ili u samom zaglavlju detalja."
      },
      {
        title: "Povezanost s periodičkim izvješćima",
        description:
          "Sva evidentirana predavanja automatski ulaze u Generator izvješća za odabrano vremensko razdoblje (npr. za godišnju skupštinu ili izvješće Gradu/Ministarstvu)."
      }
    ]
  },
  {
    id: "library",
    number: 7,
    title: "Knjižnica društva i Vanjski katalozi (Linkovi)",
    subtitle: "Katalog knjiga, časopisa 'Rodoslovlje', zbornika i korisnih rodoslovnih portala",
    category: "rad_drustva",
    icon: Library,
    route: "/library",
    badge: "Fond i literatura",
    summary:
      "Katalog svih tiskanih i digitalnih publikacija u vlasništvu društva, uz evidenciju posudbi i brze poveznice na domaće i svjetske rodoslovne izvore (modul Linkovi).",
    steps: [
      {
        title: "Pretraživanje kataloga i posudba knjiga",
        description:
          "Knjige možete pretraživati po naslovu, autoru, godini izdanja ili signaturi. Svaka knjiga ima oznaku dostupnosti ('Dostupno' ili 'Posuđeno – ime člana') te oznaku je li dostupna u digitalnom (PDF) obliku."
      },
      {
        title: "Korisni linkovi i vanjske baze (/links)",
        description:
          "U modulu 'Linkovi' nalaze se provjerene poveznice na FamilySearch, Acta Croatica, ARHiNET, Državni arhiv u Zagrebu, Matične knjige i druge portale. Klikom na karticu stranica se otvara u novoj kartici preglednika."
      }
    ]
  },
  {
    id: "projects",
    number: 8,
    title: "Projekti društva",
    subtitle: "Praćenje istraživačkih, izdavačkih i digitalizacijskih projekata po fazama",
    category: "rad_drustva",
    icon: FolderKanban,
    route: "/projects",
    badge: "Projektni menadžment",
    summary:
      "Sustavno praćenje svih projekata društva – od prijave na natječaje i istraživanja do tiska zbornika ili digitalizacije gradiva.",
    steps: [
      {
        title: "Statusi i napredak projekta",
        description:
          "Svaki projekt ima voditelja, članove projektnog tima, rokove, proračun, postotak dovršenosti (0–100%) te status (U pripremi, Aktivno, Na čekanju, Završeno)."
      }
    ]
  },
  {
    id: "archive",
    number: 9,
    title: "Arhiv društva i Google Drive integracija",
    subtitle: "Trajna pohrana dokumenata, statuta, ugovora, fotografija i rodoslovne građe",
    category: "rad_drustva",
    icon: Archive,
    route: "/archive",
    badge: "Dokumentacija",
    summary:
      "Službeni registrator arhivske građe društva povezan s oblakom (Google Drive) za pregled skeniranih dokumenata, fotografija i odluka.",
    steps: [
      {
        title: "Korištenje internog Arhiva (/archive)",
        description:
          "Pretražujte arhivske jedinice po klasifikacijskoj oznaci, godini, vrsti dokumenta (Statut, Zapisnik, Rješenje, Fotografija, Rodoslovno stablo) ili opisu."
      },
      {
        title: "Korištenje modula Google Drive (/drive)",
        description:
          "U modulu 'Google Drive' možete izravno pregledavati mape i datoteke pohranjene na službenom Google disku društva bez potrebe za dodatnom prijavom."
      }
    ]
  },
  {
    id: "gmail",
    number: 10,
    title: "INBOX (Gmail korespondencija i evidencija čitanja/odgovora)",
    subtitle: "Čitanje i slanje službene e-pošte uz pametne oznake tko je poslao ili pročitao mail",
    category: "komunikacija",
    icon: Mail,
    route: "/gmail",
    badge: "Bez lokalnog zauzeća diska",
    summary:
      "Službeni e-mail klijent društva izravno povezan s Gmail API-jem. Sadržaj poruka i privitci povlače se u stvarnom vremenu s Google poslužitelja (ne zauzimaju prostor na disku servera), dok se u našoj bazi čuvaju samo lagane oznake evidencije rada uprave.",
    steps: [
      {
        title: "Oznake u boji: Tko je poslao ili odgovorio na mail",
        description:
          "Kada član uprave ili administrator pošalje novi mail ili odgovori iz aplikacije, sustav uz taj mail trajno veže obojenu oznaku s imenom i prezimenom pošiljatelja (npr. 'Odgovorio/la: Ime Prezime'). Svaki korisnik ima svoju prepoznatljivu boju.",
        tips: [
          "Administrator može upisati svoje puno ime i prezime u Postavkama sustava kako bi na oznakama pisalo njegovo stvarno ime umjesto općenitog naziva 'Administrator'."
        ]
      },
      {
        title: "Evidencija pročitanih mailova bez odgovora ('Pročitao/la: Ime (bez odgovora)')",
        description:
          "Ako netko otvori i pročita primljeni mail, a na njega još nitko nije odgovorio niti ga proslijedio, sustav automatski bilježi tko ga je pročitao i kada. Na popisu poruka i u zaglavlju poruke prikazuje se narančasta oznaka: 'Pročitao/la: [Ime i prezime] (bez odgovora)'.",
        tips: [
          "Čim bilo tko odgovori na taj mail ili ga proslijedi, oznaka 'bez odgovora' automatski se zamjenjuje zelenom oznakom 'Odgovorio/la: [Ime]'."
        ]
      },
      {
        title: "Korištenje predložaka (šablona) za brze odgovore",
        description:
          "Prilikom pisanja novog maila ili odgovora možete jednim klikom umetnuti gotov predložak (npr. odgovor na rodoslovni upit, potvrda o članarini, poziv na predavanje)."
      }
    ]
  },
  {
    id: "donations",
    number: 11,
    title: "Donacije, Kampanje i Tražilica tvrtki (Registri + Google Fallback)",
    subtitle: "Pronalazak potencijalnih donatora, ručni upis donacija, povijest pretraga i AI pisma",
    category: "komunikacija",
    icon: Sparkles,
    route: "/admin/donations",
    badge: "Samo Administrator",
    summary:
      "Cjeloviti sustav za prikupljanje donacija i sponzorstava: od pretrage hrvatskih tvrtki i zaklada do automatskog sastavljanja personaliziranih zamolbi, slanja kampanja i evidencije svih uplaćenih donacija.",
    steps: [
      {
        title: "1. Ručni upis donatora / donacije (izvan e-mail kampanje)",
        description:
          "Ako je donator uplatio donaciju izravno na žiro-račun, u gotovini ili temeljem ugovora (a nije proizašao iz mail kampanje), kliknite na zeleni gumb '+ Upiši donatora / donaciju' u gornjem desnom kutu. Unesite naziv tvrtke ili ime fizičke osobe, OIB, iznos u EUR, datum uplate i napomenu.",
        tips: [
          "Ručno upisana donacija odmah se pribraja u karticu 'Donirano', pojavljuje se u popisu donatora te automatski ulazi u Generator periodičkih izvješća (/reports)."
        ]
      },
      {
        title: "2. Pametna pretraga registara + Automatski Google/Web Fallback (Top 20 tvrtki)",
        description:
          "U kartici 'Tražilica & Baza' upišite pojam (npr. djelatnost ili grad). Sustav najprije pretražuje službene registre (Sudski registar, Registar udruga, Registar zaklada). Ako u registrima nema rezultata (0 pronađenih), sustav AUTOMATSKI pokreće Google/Web pretragu za taj pojam u Hrvatskoj, uzima prvih 20 web stranica tvrtki, posjećuje njihove kontakt stranice, izvlači službene e-mail adrese i sprema tvrtke u vašu bazu potencijalnih donatora."
      },
      {
        title: "3. Pamćenje već pretraživanih pojmova (Zaštita od duplog traženja)",
        description:
          "Sustav u bazi pamti svaki pojam koji ste već pretraživali, zajedno s datumom i brojem pronađenih tvrtki. Ispod tražilice vidite značke 'Već pretraživani pojmovi'. Ako ponovno upišete isti pojam, sustav će vas upozoriti da ste ga već tražili kako ne biste gubili vrijeme na dvostruku pretragu (uz gumb 'Pretraži ponovno svejedno' ako želite osvježiti podatke)."
      },
      {
        title: "4. Slanje zamolbi i praćenje statusa donacije",
        description:
          "Za svaku pronađenu tvrtku sustav može pripremiti personaliziranu zamolbu za donaciju. Nakon slanja maila možete pratiti tko je otvorio poruku, tko je odgovorio i jednim klikom evidentirati uplaćeni iznos donacije."
      }
    ]
  },
  {
    id: "reports",
    number: 12,
    title: "Generator periodičkih izvješća (Tekstualni zapisnik, PDF i CSV)",
    subtitle: "Sveobuhvatno izvješće o radu društva za bilo koje odabrano razdoblje (Od – Do)",
    category: "uprava_sustav",
    icon: FileBarChart,
    route: "/reports",
    badge: "Izvješćivanje uprave",
    summary:
      "Omogućuje generiranje kompletnog izvješća o radu društva za proizvoljni raspon datuma (npr. polugodišnje, godišnje ili mandatno izvješće). Naglasak je na potpunom tekstualnom popisu svih stavki radi izravnog uvrštavanja u zapisnike Skupštine.",
    steps: [
      {
        title: "Odabir razdoblja i predložaka datuma",
        description:
          "Odaberite početni i završni datum ili kliknite jedan od brzih gumba ('Zadnjih 30 dana', 'Tekuća godina', 'Prošla godina', 'Sve od početka')."
      },
      {
        title: "Potpuni tekstualni popis svih aktivnosti i broj poslanih/primljenih mailova",
        description:
          "Izvješće taksativno, stavku po stavku, tekstualno popisuje: sve novoupisane članove, održane sjednice i rezultate svih glasovanja, održana predavanja, nove knjige, projekte, arhivske zapise, kampanje i donacije, sigurnosne kopije te točan broj POSLANIH i PRIMLJENIH e-mailova (s popisom tko ih je iz uprave poslao)."
      },
      {
        title: "Kopiranje čistog teksta, PDF ispis s memorandumom i CSV izvoz",
        description:
          "Na dnu izvješća nalazi se okvir 'Cjeloviti tekstualni izvještaj za kopiranje' – klikom na 'Kopiraj cijeli tekst' dobivate formatirani tekst spreman za Word ili e-mail. Također možete preuzeti službeni PDF s grbom društva ili CSV tablicu."
      }
    ]
  },
  {
    id: "chronicle",
    number: 13,
    title: "Ljetopis društva",
    subtitle: "Kronološki pregled najvažnijih povijesnih događaja i obljetnica društva",
    category: "uprava_sustav",
    icon: BookOpen,
    route: "/chronicle",
    badge: "Povijest društva",
    summary:
      "Digitalna spomenica (vremenska crta) u koju se bilježe ključni događaji iz povijesti Hrvatskog rodoslovnog društva 'Pavao Ritter Vitezović'.",
    steps: [
      {
        title: "Pregled i unos zapisa u Ljetopis",
        description:
          "Zapisi su poredani kronološki po godinama. Administratori i moderatori mogu dodavati nove prekretnice, fotografije s događanja i opise važnih obljetnica."
      }
    ]
  },
  {
    id: "logs",
    number: 14,
    title: "Dnevnik aktivnosti (Revizijski logovi)",
    subtitle: "Sigurnosna evidencija svih prijava, izmjena podataka i administrativnih radnji",
    category: "uprava_sustav",
    icon: Activity,
    route: "/logs",
    badge: "Nadzor i sigurnost",
    summary:
      "Svaka važna radnja u sustavu (prijava korisnika, dodavanje člana, glasovanje, slanje maila, izrada backupa) automatski se bilježi s točnim vremenom, imenom korisnika i IP adresom.",
    steps: [
      {
        title: "Filtriranje i provjera aktivnosti",
        description:
          "U modulu 'Logovi' možete pretraživati zapise po korisniku, vrsti radnje ili datumu kako biste u svakom trenutku znali tko je i kada napravio određenu izmjenu."
      }
    ]
  },
  {
    id: "backup",
    number: 15,
    title: "Centralna baza (/var/data/prv_data/db/), Backup i Dry-Run provjera",
    subtitle: "Sigurnosne kopije svih baza na disk i Dropbox uz simulaciju oporavka bez rizika",
    category: "uprava_sustav",
    icon: Database,
    route: "/settings",
    badge: "Zaštita podataka",
    summary:
      "Sve baze podataka sustava za sve module centralizirane su na lokaciji `/var/data/prv_data/db/` (`app.db`, `mailcrawl.db`, `company_scraper.db`). Sustav izrađuje kriptirane sigurnosne kopije svih triju baza i svih postavki.",
    steps: [
      {
        title: "Centralna lokacija baza podataka (/var/data/prv_data/db/)",
        description:
          "Glavna baza društva (`app.db`), baza donacija i kampanja (`mailcrawl.db`) te baza registra i web scrapera tvrtki (`company_scraper.db`) trajno se spremaju u direktorij `/var/data/prv_data/db/`."
      },
      {
        title: "Ručni i automatski Backup (Lokalno + Dropbox)",
        description:
          "U 'Postavke -> Sigurnosne kopije' klikom na 'Izradi sigurnosnu kopiju sada' stvara se cjeloviti `.json.gz` paket koji obuhvaća sve 3 baze, sve tablice (uključujući ime Administratora, oznake mailova `mail_senders`, pročitane mailove `mail_reads`, povijest pretraga `search_query_history` i ručne donacije). Paket se sprema lokalno i automatski šalje na povezani Dropbox račun."
      },
      {
        title: "Dry-Run (Simulacija povrata na prazno bez diranja živih podataka)",
        description:
          "Klikom na gumb 'Simuliraj povrat (Dry-Run)' pored bilo koje sigurnosne kopije, sustav u izoliranoj memoriji raspakirava arhivu, provjerava integritet svih 3 baza (`app.db`, `mailcrawl.db`, `company_scraper.db`), broji sve zapise po tablicama i potvrđuje da je kopija 100% ispravna za oporavak – bez ikakvog mijenjanja trenutnih podataka u aplikaciji."
      }
    ]
  },
  {
    id: "settings",
    number: 16,
    title: "Postavke sustava, Ime Administratora, Prava pristupa i Trezor lozinki",
    subtitle: "Konfiguracija identiteta društva, potpisa Administratora, korisničkih uloga i lozinki",
    category: "uprava_sustav",
    icon: Settings,
    route: "/settings",
    badge: "Samo Administrator",
    summary:
      "U Postavkama administrator upravlja svim ključnim parametrima aplikacije, korisničkim računima, dozvolama po modulima i sigurnosnim trezorom.",
    steps: [
      {
        title: "Upis Imena i Prezimena Administratora (za statuse i oznake mailova)",
        description:
          "U kartici 'Općenito' nalazi se polje 'Ime i prezime Administratora'. Kada ondje upišete svoje ime i prezime (npr. 'Ivan Horvat') i kliknete 'Spremi sve postavke', vaše će se puno ime automatski prikazivati u oznakama poslanih, odgovorenih i pročitanih mailova u INBOX-u, u zapisnicima aktivnosti te u izvješćima. Ovo je polje automatski uključeno i u svaki Backup."
      },
      {
        title: "Korisnici i detaljna Prava pristupa po modulima",
        description:
          "Za svakog člana ili moderatora možete pojedinačno uključiti ili isključiti pravo pregleda (`Pregled`) i pravo uređivanja (`Uređivanje`) za svaki pojedini modul aplikacije."
      },
      {
        title: "Trezor lozinki i platformi (Password Vault)",
        description:
          "Sigurno i strogo povjerljivo mjesto unutar Postavki (samo za Administratora) za pohranu pristupnih podataka po platformama (npr. Gmail, PuTTY / SSH poslužitelj, CPanel, hosting, Google Cloud, Dropbox, Carnet domena, WiFi router i sl.). Omogućuje unos korisničkog imena i lozinke s maskiranjem, brzo kopiranje jednim klikom, generator jakih lozinki, pretraživanje, brze predloške te funkciju ispisa/izvoza za potrebe primopredaje dužnosti budućem administratoru, uz zadržavanje slobodnih tekstualnih administratorskih bilješki."
      }
    ]
  },
  {
    id: "accessibility",
    number: 17,
    title: "Pristupačnost (Povećani prikaz za slabovidne) i Verzije sustava",
    subtitle: "Prilagodba veličine slova jednim klikom i praćenje povijesti izmjena (Changelog)",
    category: "osnovno",
    icon: ZoomIn,
    route: "/changelog",
    badge: "Prilagođeno svima",
    summary:
      "Sustav je prilagođen svim generacijama članova, uključujući starije i slabovidne osobe, te omogućuje potpunu transparentnost svih nadogradnji.",
    steps: [
      {
        title: "Gumb 'POVEĆAJ PRIKAZ' (A+ / A−)",
        description:
          "Na dnu lijevog izbornika (te u gornjem desnom kutu na mobitelima) nalazi se istaknuti plavi gumb 'POVEĆAJ PRIKAZ'. Klikom na njega sva slova, gumbi i tablice u aplikaciji povećavaju se za 25% uz pojačani kontrast. Sustav pamti vaš odabir i pri sljedećem otvaranju."
      },
      {
        title: "Oznaka verzije u formatu datuma i Popis promjena (Changelog)",
        description:
          "U podnožju lijevog izbornika nalazi se istaknuta oznaka verzije u formatu datuma zadnje nadogradnje (npr. `v08.11.2026`) te brzi informativni linkovi na Korisnički priručnik i Popis promjena. Klikom na verziju otvara se stranica `/changelog` s detaljnim kronološkim popisom svih poboljšanja u aplikaciji."
      }
    ]
  }
]

const CATEGORIES = [
  { id: "sve", label: "Svi moduli (17)" },
  { id: "osnovno", label: "Osnove i pristupačnost" },
  { id: "clanstvo", label: "Članstvo i adresar" },
  { id: "rad_drustva", label: "Sjednice, knjižnica i rad" },
  { id: "komunikacija", label: "Inbox, mailovi i donacije" },
  { id: "uprava_sustav", label: "Izvješća, backup i postavke" }
] as const

export function ManualContent() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("sve")

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
          (s.tips && s.tips.some((t) => t.toLowerCase().includes(q)))
      )
      return inTitle || inSub || inSum || inSteps
    })
  }, [searchQuery, activeCategory])

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
                  Sustav „Rodoslovac” • v11.11.2026
                </Badge>
                <Badge variant="outline" className="border-amber-500/40 text-amber-800 bg-amber-50 text-xs">
                  17 detaljno obrađenih poglavlja
                </Badge>
              </div>
              <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                Korisnički priručnik sustava „Rodoslovac”
              </h1>
              <p className="text-sm md:text-base text-slate-600 mt-1 max-w-3xl">
                Detaljne upute korak-po-korak za sve module, značajke, evidenciju elektroničke pošte, kampanje donacija,
                generator izvješća i sigurnosne kopije sustava HRD „Pavao Ritter Vitezović”.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/changelog">
              <Button variant="outline" size="sm" className="gap-2 border-amber-500/40 text-amber-900 hover:bg-amber-50">
                <History className="h-4 w-4 text-[#b58442]" />
                Popis promjena (Changelog)
              </Button>
            </Link>
          </div>
        </div>

        {/* Tražilica kroz upute i filtri kategorija */}
        <div className="mt-6 pt-6 border-t border-blue-100 space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pretražite priručnik po ključnoj riječi (npr. donacije, članarina, pročitao, backup, administrator, google, izvješće)..."
              className="pl-10 bg-white border-slate-200 h-11 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeCategory === cat.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Brzi kazalo sadržaja */}
      <Card className="border-slate-200/80 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-serif flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600" />
            Brzi skok na poglavlje ({filteredSections.length} od {MANUAL_SECTIONS.length} prikazano)
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
          </div>
        </CardContent>
      </Card>

      {/* Detaljni prikaz svih poglavlja */}
      <div className="space-y-6">
        {filteredSections.map((sec) => {
          const Icon = sec.icon
          return (
            <Card
              key={sec.id}
              id={`manual-${sec.id}`}
              className="border-slate-200/90 shadow-xs scroll-mt-6 overflow-hidden"
            >
              <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-4">
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
                      </div>
                      <CardTitle className="font-serif text-xl md:text-2xl text-slate-900 mt-0.5">
                        {sec.title}
                      </CardTitle>
                      <CardDescription className="text-sm text-slate-600 mt-0.5">
                        {sec.subtitle}
                      </CardDescription>
                    </div>
                  </div>
                  {sec.route && (
                    <Link href={sec.route} className="shrink-0">
                      <Button variant="outline" size="sm" className="text-xs h-8">
                        Otvori modul →
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <p className="text-sm text-slate-700 leading-relaxed bg-blue-50/40 border border-blue-100 rounded-xl p-4">
                  {sec.summary}
                </p>

                <div className="space-y-4">
                  {sec.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-2.5"
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
                      {step.tips && step.tips.length > 0 && (
                        <div className="pl-8 pt-1 space-y-1.5">
                          {step.tips.map((tip, tIdx) => (
                            <div
                              key={tIdx}
                              className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50/80 border border-amber-200/70 rounded-lg px-3 py-2"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                              <span>
                                <strong>Savjet:</strong> {tip}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {filteredSections.length === 0 && (
          <Card className="p-12 text-center border-dashed">
            <HelpCircle className="h-10 w-10 text-slate-400 mx-auto mb-3" />
            <h3 className="font-serif text-lg font-bold text-slate-800">
              Nema pronađenih uputa za pojam „{searchQuery}”
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Pokušajte upisati drugu ključnu riječ ili kliknite na kategoriju „Svi moduli (17)”.
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
          <Link href="/changelog" className="shrink-0">
            <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white">
              Pregledaj Changelog (v11.11.2026)
            </Button>
          </Link>
        </CardContent>
      </Card>

      <footer className="pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Sustav „Rodoslovac” • Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović” • Verzija v11.11.2026</p>
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
