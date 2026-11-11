"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  History,
  Sparkles,
  CheckCircle2,
  Wrench,
  ShieldCheck,
  Database,
  Mail,
  FileBarChart,
  HeartHandshake,
  BookOpen,
  Calendar,
} from "lucide-react"

interface ChangelogEntry {
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

const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    version: "v11.11.2026",
    dateLabel: "11/11/2026",
    title: "Izmjena naslova sjednica i predavanja, Sigurnosni Trezor računa, naziv „Rodoslovac” i Drive Drag & Drop",
    badge: "Najnovije izdanje",
    isLatest: true,
    changes: [
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

export function ChangelogContent() {
  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Popis promjena i nadogradnji (Changelog)
              </h1>
              <p className="text-sm text-muted-foreground">
                Kronološki pregled svih funkcionalnosti, poboljšanja i ispravaka u sustavu Rodoslovac (HRD-CMS)
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#1B2B36] text-[#CEA369] border border-[#CEA369] text-xs px-3 py-1 font-mono">
            Aktualna verzija: v11.11.2026
          </Badge>
        </div>
      </div>

      {/* Info kartica o lokaciji baza i sustavu */}
      <Card className="border-border bg-slate-50/70 shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-700">
            <Database className="h-4 w-4 text-[#CEA369] shrink-0" />
            <span>
              <strong>Produkcijska pohrana baza podataka:</strong>{" "}
              <code className="px-1.5 py-0.5 rounded bg-white border font-mono text-[11px]">
                /var/data/prv_data/db/
              </code>{" "}
              (app.db, mailcrawl.db, company_scraper.db)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>100% obuhvaćeno automatskim Backupom i Dry-Run provjerom</span>
          </div>
        </CardContent>
      </Card>

      {/* Vremenska crta izdanja */}
      <div className="space-y-6">
        {CHANGELOG_DATA.map((entry) => (
          <Card
            key={entry.version}
            className={`border overflow-hidden transition-shadow ${
              entry.isLatest ? "border-[#CEA369] shadow-md ring-1 ring-[#CEA369]/30" : "border-border shadow-xs"
            }`}
          >
            <CardHeader className={`${entry.isLatest ? "bg-[#1B2B36] text-white" : "bg-muted/40"} pb-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`font-mono text-sm font-bold px-2.5 py-1 rounded-md ${
                      entry.isLatest
                        ? "bg-[#CEA369] text-[#1B2B36]"
                        : "bg-primary/10 text-primary border border-primary/20"
                    }`}
                  >
                    {entry.version}
                  </span>
                  <span className={`text-xs flex items-center gap-1 ${entry.isLatest ? "text-slate-300" : "text-muted-foreground"}`}>
                    <Calendar className="h-3.5 w-3.5" />
                    {entry.dateLabel}
                  </span>
                </div>
                <Badge
                  variant={entry.isLatest ? "default" : "secondary"}
                  className={entry.isLatest ? "bg-emerald-600 text-white border-none text-xs" : "text-xs"}
                >
                  {entry.badge}
                </Badge>
              </div>
              <CardTitle className={`text-base mt-2 ${entry.isLatest ? "text-white" : "text-foreground"}`}>
                {entry.title}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-5">
              <ul className="space-y-3">
                {entry.changes.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm leading-relaxed">
                    {c.type === "novo" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 mt-0.5">
                        <Sparkles className="h-3 w-3" /> Novo
                      </span>
                    )}
                    {c.type === "poboljsanje" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shrink-0 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Poboljšanje
                      </span>
                    )}
                    {c.type === "ispravak" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 shrink-0 mt-0.5">
                        <Wrench className="h-3 w-3" /> Ispravak
                      </span>
                    )}
                    <span className="text-slate-700">{c.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
