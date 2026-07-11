"use client"

import React from "react"
import { 
  Book, 
  Users, 
  Calendar, 
  Mic, 
  Library, 
  FolderKanban, 
  Archive, 
  Mail, 
  Link as LinkIcon, 
  Cloud, 
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  MousePointer2,
  Lock,
  Search,
  LayoutDashboard,
  Eye,
  Check,
  Plus
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function ManualContent() {
  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <div className="mb-12 text-center">
        <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-200">
           <Book className="h-10 w-10 text-blue-600" />
        </div>
        <h1 className="font-serif text-5xl font-bold mb-4">Korisnički priručnik</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Dobrodošli! Ovaj priručnik napisan je kako bi vam pomogao da se s lakoćom služite 
          sustavom vašeg društva. Bez brige – sve je dizajnirano da bude jednostavno i sigurno.
        </p>
      </div>

      <Tabs defaultValue="basics" className="space-y-10">
        <TabsList className="flex flex-wrap bg-muted p-1 rounded-xl w-full h-auto items-center justify-start gap-1">
          <TabsTrigger value="basics" className="py-3">1. PRVI KORACI</TabsTrigger>
          <TabsTrigger value="members" className="py-3">2. ČLANOVI I KONTAKTI</TabsTrigger>
          <TabsTrigger value="meetings" className="py-3">3. SJEDNICE I GLASOVANJE</TabsTrigger>
          <TabsTrigger value="modules" className="py-3">4. OSTALI MODULI</TabsTrigger>
        </TabsList>

        <TabsContent value="basics" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Card className="border-blue-100 shadow-sm overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-100 p-4 flex items-center gap-3 text-blue-700 font-bold">
              <MousePointer2 className="h-5 w-5" /> OSNOVE KORIŠTENJA
            </div>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-4">
                <h3 className="text-2xl font-serif font-bold flex items-center gap-2">
                  <LayoutDashboard className="text-primary h-6 w-6" /> Navigacija (Izbornik)
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  S lijeve strane vašeg zaslona nalazi se tamni stupac s nazivima svih dijelova aplikacije.
                </p>
                <ul className="space-y-4 ml-2">
                  <li className="flex gap-4">
                    <div className="bg-slate-100 h-8 w-8 rounded-full flex items-center justify-center shrink-0 font-bold">1</div>
                    <p>Za prebacivanje između dijelova aplikacije (npr. s "Članova" na "Knjižnicu"), jednostavno kliknite lijevom tipkom miša na naziv dijela u tom izborniku.</p>
                  </li>
                  <li className="flex gap-4">
                    <div className="bg-slate-100 h-8 w-8 rounded-full flex items-center justify-center shrink-0 font-bold">2</div>
                    <p>Uvijek se možete vratiti na početak klikom na prvu stavku – <strong>NADZORNA PLOČA</strong>.</p>
                  </li>
                </ul>
              </div>

              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-2xl font-serif font-bold flex items-center gap-2">
                  <Search className="text-primary h-6 w-6" /> Kako pronaći ono što tražim?
                </h3>
                <p className="text-slate-600">Gotovo svaka stranica na samom vrhu ima polje za pretragu:</p>
                <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 flex items-center gap-4 italic text-slate-500">
                  <Search className="h-4 w-4" /> "Pretraži po imenu, naslovu..."
                </div>
                <p className="text-sm text-slate-500">
                  <strong>Savjet:</strong> Ne morate pisati cijelo ime, dovoljno je upisati prva 3 ili 4 slova i sustav će vam automatski pokazati rezultate.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-100">
            <CardContent className="p-6 flex gap-4 items-start">
              <div className="p-3 bg-amber-100 rounded-full text-amber-700 font-bold shrink-0">
                <Lock className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-lg">Što ako nešto slučajno kliknem?</h4>
                <p className="text-sm text-slate-600 leading-relaxed italic">
                  Bez brige! Aplikacija je zaključana tako da "obični" korisnici ne mogu trajno obrisati bitne podatke. 
                  Samo Administratori imaju ključ za važne promjene. Slobodno istražujte!
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 font-serif text-3xl">
                <Users className="h-8 w-8 text-primary" /> Rad sa Članovima
              </CardTitle>
              <CardDescription className="text-lg">Kako pratiti tko je tko u društvu i jesu li članarine plaćene.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-10">
              <section className="space-y-4">
                <h4 className="font-bold text-xl flex items-center gap-2 text-slate-800">
                  <span className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center text-sm">1</span>
                  Boje i statusi (Važno!)
                </h4>
                <p className="text-slate-600">U popisu članova vidjet ćete male oznake u bojama:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <div>
                      <span className="font-bold text-green-800">AKTIVAN:</span> 
                      <span className="ml-2 text-sm text-green-700">Sve je u redu, članarina je plaćena.</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <div>
                      <span className="font-bold text-amber-800">DUG:</span> 
                      <span className="ml-2 text-sm text-amber-700">Članarina nije plaćena dulje od godinu dana.</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div>
                      <span className="font-bold text-red-800">ISPISAN:</span> 
                      <span className="ml-2 text-sm text-red-700">Osoba više nije član društva.</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <div>
                      <span className="font-bold text-blue-800">POČASNI ČLAN:</span> 
                      <span className="ml-2 text-sm text-blue-700">Oslobođen članarine zbog zasluga.</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4 pt-6 border-t">
                <h4 className="font-bold text-xl flex items-center gap-2 text-slate-800">
                  <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-sm">2</span>
                  Pregled detalja
                </h4>
                <p className="text-slate-600">
                  Ako želite vidjeti više podataka o nekome (broj telefona, datum od kada je član, adresu), kliknite na <strong>IME I PREZIME</strong> tog člana na popisu. Otvorit će se prozor sa svim detaljima.
                </p>
              </section>

              <section className="space-y-4 pt-6 border-t">
                <h4 className="font-bold text-xl flex items-center gap-2 text-slate-800">
                   <ArrowRight className="h-6 w-6 text-primary" /> Adresar
                </h4>
                <p className="text-slate-600">
                  U Adresaru se nalaze ljudi koji <strong>nisu</strong> članovi društva (npr. knjižničari iz arhiva, gosti predavači), ali njihovi kontakti su nam važni za rad.
                </p>
              </section>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 font-serif text-3xl">
                <Calendar className="h-8 w-8 text-primary" /> Sjednice i Glasovanje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <h4 className="font-bold text-xl text-slate-800">Što ako se pojavi prozor za glasanje?</h4>
                <div className="p-6 bg-blue-50/50 rounded-2xl border-2 border-primary/20 space-y-4">
                  <p className="text-slate-700">
                    Ponekad će vas po prijavi dočekati prozor <strong>"Obavezno Glasovanje"</strong>. To znači da društvo donosi važnu odluku.
                  </p>
                  <ol className="space-y-3">
                    <li className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs">1</div>
                      <p><strong>Pročitajte</strong> o čemu se radi (naslov i opis).</p>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs">2</div>
                      <p><strong>Odaberite</strong> jednu od ponuđenih opcija (kliknite na krug pored odgovora).</p>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs">3</div>
                      <p>Kliknite na plavi gumb <strong>GLASUJ I NASTAVI</strong> na dnu.</p>
                    </li>
                  </ol>
                  <div className="p-4 bg-white rounded-xl border border-blue-200 flex gap-3 text-sm italic text-blue-800">
                    <Eye className="h-5 w-5 shrink-0" />
                    <span>Vaši rezultati bit će odmah zbrojeni i vidljivi svim članovima s pravom pristupa.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t">
                <h4 className="font-bold text-xl text-slate-800">Zapisnici</h4>
                <p className="text-slate-600 leading-relaxed">
                  U svakoj sjednici na popisu možete pronaći bilješke (zapisnik). Samo kliknite na karticu sjednice i vidjet ćete tko je bio prisutan i o čemu se raspravljalo.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                 <div className="p-3 bg-indigo-100 rounded-xl text-indigo-700"><Library className="h-6 w-6" /></div>
                 <div>
                   <CardTitle>Knjižnica</CardTitle>
                   <CardDescription>Popis publikacija</CardDescription>
                 </div>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <p>Ovdje možete vidjeti sve knjige koje društvo posjeduje. Ako je knjiga "Digitalizirana", to znači da je dostupna za čitanje na računalu.</p>
                <div className="flex items-center gap-2 font-medium text-indigo-700">
                   <Plus className="h-4 w-4" /> Kako posuditi? Kontaktirajte tajnika.
                </div>
              </CardContent>
            </Card>

            <Card>
               <CardHeader className="flex flex-row items-center gap-4">
                 <div className="p-3 bg-sky-100 rounded-xl text-sky-700"><Cloud className="h-6 w-6" /></div>
                 <div>
                   <CardTitle>Google Drive</CardTitle>
                   <CardDescription>Sve datoteke</CardDescription>
                 </div>
              </CardHeader>
              <CardContent className="text-sm">
                <p>Klikom na ovaj modul možete vidjeti sve skenirane dokumente, fotografije i ostale datoteke spremljene na internetu. Nema potrebe za posebnim lozinkama!</p>
              </CardContent>
            </Card>

            <Card>
               <CardHeader className="flex flex-row items-center gap-4">
                 <div className="p-3 bg-red-100 rounded-xl text-red-700"><Mail className="h-6 w-6" /></div>
                 <div>
                   <CardTitle>INBOX</CardTitle>
                   <CardDescription>Službeni mailovi</CardDescription>
                 </div>
              </CardHeader>
              <CardContent className="text-sm">
                <p>Ovdje uprava čita poruke pristigle na službenu adresu društva. To je "digitalni poštanski sandučić".</p>
              </CardContent>
            </Card>

            <Card>
               <CardHeader className="flex flex-row items-center gap-4">
                 <div className="p-3 bg-orange-100 rounded-xl text-orange-700"><LinkIcon className="h-6 w-6" /></div>
                 <div>
                   <CardTitle>Linkovi</CardTitle>
                   <CardDescription>Korisne adrese</CardDescription>
                 </div>
              </CardHeader>
              <CardContent className="text-sm">
                <p>Klikom na bilo koju poveznicu (npr. "FamilySearch" ili "Državni arhiv"), sustav će vas automatski odvesti na tu web stranicu u novom prozoru.</p>
              </CardContent>
            </Card>
          </div>

          <div className="p-8 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-200 mt-8">
             <div className="flex items-start gap-6">
                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                   <HelpCircle className="h-10 w-10" />
                </div>
                <div className="space-y-3">
                   <h3 className="text-3xl font-serif font-bold italic">Trebate dodatnu pomoć?</h3>
                   <p className="opacity-90 leading-relaxed max-w-2xl">
                     Ako se izgubite u nekom dijelu sustava ili vam nešto ne radi kako ste očekivali, 
                     uvijek možete nazvati tajnika ili poslati poruku administratoru. 
                     <strong>Sustav čuva vaše podatke i ništa se ne može nepovratno pokvariti.</strong>
                   </p>
                </div>
             </div>
          </div>
        </TabsContent>
      </Tabs>

      <footer className="mt-24 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
        <p>&copy; 2026 Rodoslovno društvo Pavao Ritter Vitezović.</p>
        <div className="flex gap-6 italic text-blue-600 font-medium">
          <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Digitalizirano i sigurno</span>
          <span>Podrška: admin@hrd-vitezovic.hr</span>
        </div>
      </footer>
    </div>
  )
}
