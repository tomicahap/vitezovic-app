# Korisnički priručnik: Genealogical Society CMS

Ovaj priručnik služi kao vodič za administratore, moderatore i članove za korištenje sustava za upravljanje Hrvatskim rodoslovno društvom "Pavao Ritter Vitezović".

---

## 1. Nadzorna ploča (Dashboard)
Nadzorna ploča je centralno mjesto za pregled stanja društva.

- **Statistika u realnom vremenu**: Na vrhu vidite broj ukupnih, aktivnih članova, onih s dugovanjima i ispisanih.
- **Interaktivni filteri**: Klikom na bilo koju karticu statistike (npr. "Dugovanja") sustav vas automatski prebacuje u Registar članova i filtrira upravo tu skupinu.
- **Sljedeća sjednica**: Widget koji prikazuje detalje sljedećeg zakazanog sastanka i dnevni red.
- **Trendovi**: Grafikon koji prikazuje rast članstva kroz zadnjih 12 mjeseci.

---

## 2. Registar članova
Modul za upravljanje podacima o članovima, njihovim ulogama i financijskom urednošću.

### 2.1. Statusi članstva (Automatizacija)
Sustav samostalno izračunava status člana na temelju njegovih uplata i postavki (npr. 365 dana za dug, 730 za ispis).
- **Napomena**: Status se ne može ručno mijenjati osim putem "Posebnih statusa".

### 2.2. Posebni statusi (Prioriteti)
Ako želite nekome fiksno definirati status, koristite kvačice u detaljima člana:
- **Počasni član / Oslobođen plaćanja**: Postavlja status fiksno na **AKTIVAN / PLAĆENO**.
- **Ispisan / Preminuo**: Postavlja status fiksno na **ISPISAN / ZATVORENO** (briše se iz aktivne evidencije).

### 2.3. Filtriranje i Export
- **Razina članstva**: Filter "POČASNI ČLANOVI" omogućuje brzi uvid u najistaknutije članove.
- **Excel Export**: Gumb "Izvezi u Excel" generira kompletnu bazu sa svim podacima, funkcijama i poviješću uplata.

---

## 3. Digitalna knjižnica i Arhiv
Upravljanje fizičkim knjigama, digitalnim izdanjima i autorskim pravima.

### 3.1. Katalog knjiga i časopisa
- **Status prava**: Na glavnom ekranu vidite tri ikone:
    - ✉️ (Plava): Autor/Izdavač kontaktiran.
    - 💬 (Ljubičasta): Zaprimljen odgovor.
    - ✅/❌: Dozvola za posudbu unutar društva zaprimljena.
- **Posudba**: Klikom na knjigu možete je dodijeliti članu. Sustav prati tko drži koju knjigu i od kada.

### 3.2. Digitalni prilozi
- Uz svaku knjigu ili časopis možete priložiti PDF-ove ili slike korica koji se spremaju u oblak.

---

## 4. Sastanci i Glasovanje
Organizacija rada odbora i skupština.

- **Kalendar predavanja**: Vizualni prikaz zauzetosti termina kako bi se izbjeglo preklapanje predavanja.
- **Dnevni red**: Definiranje stavki o kojima će se raspravljati.
- **Sustav glasovanja (Voting)**: Tijekom sastanka, admin može pokrenuti "Anketu" (Poll) koja se članovima pojavljuje kao interaktivni prozor ("Overlay") na ekranu.

---

## 5. Google Drive Arhiva
Centralno spremište dokumenata s potpunom kontrolom iz CMS-a.

- **RBAC Kontrola (Uloge)**: 
    - **Admin**: Može pregledavati, učitavati, preuzimati i brisati (u smeće) datoteke.
    - **Članovi**: Mogu pregledavati, učitavati i preuzimati (brisanje im je onemogućeno).
- **Sigurnost**: Datoteke se preuzimaju putem CMS proxyja, što znači da ne moraju biti javno podijeljene na Drive-u da bi ih članovi mogli preuzeti.

---

## 6. Moj Kutak (Personal Space)
Osobni prostor za svakog korisnika sustava.

- **Bilješke**: Privatni prostor za pisanje povezan s vašim profilom.
- **TODO lista**: Upravljanje zadacima s prioritetima (Visok, Srednji, Nizak).
- **Statistika aktivnosti**: Pregled vaših zadnjih 5 akcija unutar cijelog CMS sustava.

---

## 7. Administracija i Postavke
- **Konfiguracija**: Unos ključeva za Google Drive (Service Account JSON), Gmail API i definiranje pragova za članarinu.
- **Logovi aktivnosti**: Detaljan uvid u to tko je, kada i što radio u sustavu (brisanja, uplate, promjene podataka).

---
*Izradio: Antigravity AI Coding Assistant*
