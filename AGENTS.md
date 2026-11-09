# Pravila rada na projektu HRD-CMS („Pavao Ritter Vitezović”)

## 1. Obavezni završni koraci nakon svake promjene u kodu
Nakon svake implementirane izmjene, nove funkcionalnosti ili ispravka u aplikaciji, agent MORA automatski (bez čekanja dodatnog podsjetnika korisnika) izvršiti sljedeće korake:

1. **Provjera i ažuriranje verzije aplikacije:**
   - Provjeriti i po potrebi uskladiti oznaku verzije u formatu `vDD.MM.YYYY` (prema trenutnom datumu) na sljedećim mjestima:
     - `components/changelog-content.tsx` (vršni zapis u `CHANGELOG_DATA` s `isLatest: true` i bedž `Aktualna verzija: vDD.MM.YYYY`)
     - `components/app-sidebar.tsx` (link na `/changelog` u podnožju bočne trake)
     - `components/boot-splash.tsx` (oznaka verzije na uvodnom zaslonu)
     - `components/manual-content.tsx` (gumb i podnožje korisničkog priručnika)
     - `package.json` (`version` polje)

2. **Dopuna popisa promjena (Changelog):**
   - U `components/changelog-content.tsx` unutar aktivne verzije (`CHANGELOG_DATA[0]`) dopisati jasan i strukturiran opis napravljene promjene (`type: "novo" | "poboljsanje" | "ispravak"`).

3. **Slanje promjena na GitHub:**
   - Provjeriti tipove (`npx tsc --noEmit`) kako bi se osiguralo da nema grešaka.
   - Izvršiti `git add -A`, `git commit -m "..."` s opisnom porukom na hrvatskom jeziku te `git push` na `origin main`.

## 2. Formatiranje datuma
- Svi datumi u sučelju, tablicama, izvješćima i izvozima moraju biti u formatu `DD/MM/YYYY` (odnosno `DD/MM/YYYY HH:mm` za datume s vremenom), koristeći pomoćne funkcije `formatDateDMY` i `formatDateTimeDMY` iz `lib/utils.ts`.
