const fs = require('fs');
let s = fs.readFileSync('components/app-sidebar.tsx', 'utf8');

// Replace using generic matches to avoid missing mojibake
s = s.replace(/NADZORNA PLO[^"]*A/, 'NADZORNA PLOČA');
s = s.replace(/[^"]*OLANOVI/, 'ČLANOVI');
s = s.replace(/KNJI[^"]*NICA/, 'KNJIŽNICA');
s = s.replace(/LJETOPIS DRU[^"]*TVA/, 'LJETOPIS DRUŠTVA');
s = s.replace(/KORISNI[^"]*KI PRIRU[^"]*NIK/, 'KORISNIČKI PRIRUČNIK');
s = s.replace(/Logo dru[^"]*tva/, 'Logo društva');
s = s.replace(/Administracija dru[^"]*tva/, 'Administracija društva');
s = s.replace(/HRD Pavao Ritter Vitezovi[^<]*</g, 'HRD Pavao Ritter Vitezović<');
s = s.replace(/HRD Vitezovi[^"]*"/g, 'HRD Vitezović"');

fs.writeFileSync('components/app-sidebar.tsx', s);
