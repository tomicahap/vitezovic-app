const Database = require('better-sqlite3');
const db = new Database('./data/app.db');

const template = {
  ime: '7af5dceb-cbec-413c-a962-995ae696b7a8',
  prezime: '016f9056-bb71-471b-b0cb-a158125ada0b',
  email: '21ad862b-b0ae-46fc-966f-e9baad5368ca',
  telefon: 'aa710b6c-efab-43a0-b609-ae01f32ee760',
  oznaka: '412616f7-5465-47f8-853e-ee7bc572602f'
};

const rawData = `Tomica	Hap	tomica.hap@gmail.com	0916215853	IR-0001
Tomo	Krivačić	tkrivacic58@gmail.com	0916040704	IR-0002
Drago	Brajdić	drago.brajdic@gmail.com	0992011401	IR-0003
Dejan	Perhat	deperhat@gmail.com	0996743025	IR-0004
Ivan	Turčinov	ivan.turcinov1@gmail.com 	098302800	IR-0005
Marko	Rimac	ileka_rimac@yahoo.com 	0921218994	IR-0006
Vladimir	Matek	vmatek4@gmail.com		IR-0007
Heidi	Lončar	loncar.heidi@gmail.com	099 532 1903	IR-0008
Zlata	Bujan-Kovačević	zlata.bujan@gmail.com	0981847678	IR-0009
Ivan	Grgurić	igrgur71@gmail.com	0994046255	IR-0010
Ivo	Lubina	ivo.lubina@gmail.com	0038763360363	IR-0011
Željka	Nađ	zeljka.nad@gmail.com	0911132223	IR-0012
Marko	Kurdija	markokurdija@gmail.com	0917277419	IR-0013
Zvjezdana	Živko Fernandes	zivkofernandesz@gmail.com	0911971003	IR-0014
Walter	Rosmarin	rosmarin@a1.net		IR-0015
Sunčica	Vitrović	suncica.vitorovic@gmail.com	0915637659	IR-0016
Branka	Šipušić Mikulić	brankasimi@gmail.com		IR-0017
Mato	Petričević	babogredac@gmail.com	0917942492	IR-0018
Anton	Afrić	aafric@gmail.com	0989389104	IR-0019
Jelena	Rožić	jelena.h.rozic@gmail.com	0989059849	IR-0020
Patrizia	Socolich Skunca	patrizia.skunca@ogc.hr		IR-0021
Alexander 	Banović	Alexanderbanovic@yahoo.se	0760602378	IR-0022
Vladimir	Lodeta	lodeta@gmail.com		IR-0023
Ivan	Vlašić	vlasic1111@gmail.com	0984033852	IR-0024
Zlatko	Lacković	zlatko@lackovic.dk	+45 40987287	IR-0025
Stela	Selvić	stelas482@gmail.com		IR-0026
Draga	Ljilja-Šćepanović	draga.s@net.hr	098433062	IR-0027
Snježana	Tonković Fernežir	Snjezana.tonkovic@zg.t-com.hr	0911521182	IR-0028
Ante	Kovač	ante.kovac@hrsume.hr	099 3178425	IR-0029
Siniša	Bosanac	sinisa1.bosanac2@gmail.com	098876815	IR-0030
Vera	Milinković	Vermdal@gmail.com		IR-0031
Igor	Kramarsich	igor.kramarsich@gmail.com	0989836211	IR-0032
Sacha	Osrecki	Sacha.osrecki@steiermaerkische.at		IR-0033
Lejla 	Krdzalic	Lejla_krdzalic@hotmail.com	905-617-4760	IR-0034
Vladimir	Tkalčić	vladimir.tkalcic@gmail.com	0994212212	IR-0035
Sanja	Vlahovic Erkan	vlahovic_sanja@yahoo.com		IR-0036
Marina	Bokulić	marinabokulic09@gmail.com		IR-0037
Marijana	Magzan	magzan.marijana@gmail.com		IR-0038
Petra	Barbarić	petrabarbaric0524@gmail.com	0923943890	IR-0039
Zvonko	Picukarić	picukare@gmail.com		IR-0040
Tudor	Vidović	tudor.vidovic@inet.hr	0915625557	IR-0041
Ana	Prskalo	ana.prskalo92@gmail.com		IR-0042
Tjaša	Vrhovnik Mlekuž	tjasa.vrh@gmail.com		IR-0043
Božana	Ivanović	zoran.bo@bigpond.com		IR-0044
Tomislav	Grđan	tomislav@timgo.eu		IR-0045
Tomislav	Kojundžić	tomislavko@gmail.com	0955654350	IR-0046
Martina	Krivić-Lekić	martina.krivi@gmail.com		IR-0047
Rok	Petrušić	Rok.peteusic@gmail.com	0038670633097	IR-0048
Romana	Cindrić	romana173@gmail.com	0981639197	IR-0049
Ivana	Jakšić	ivan.jaksic@yahoo.co.uk		IR-0050
Lovre	Mitrović	Lovre.mitrovic@gmail.com	098524311	IR-0051
Hrvoje	Golek	hgolek74@gmail.com	+1 514 250 4192	IR-0052
Marko	Botica	marko.botica4792@gmail.com		IR-0053
Martina	Prysch	martina_prysch@msn.com		IR-0054
Sara	Katanec Kraljević	sara.katanec@gmail.com	0989198424	IR-0055
Branko	Švorinić	brankosvorinic73@gmail.com		IR-0056
Daniel	Car	danielcar69@gmail.com	0995914391	IR-0057
Andreja	Horvat	sunianda@gmail.com	0989657703	IR-0058
Aleš	Kuretič	aleskuretich@gmail.com		IR-0059
Siniša	Žnidarec	sinisaznidarec@gmail.com	098835456	IR-0060
Gordana	Bertović	gordana99@hotmail.com	0917640451	IR-0061
Dario	Hostić	dahostic@gmail.com	091 762 8155	IR-0062
Radenko	Sloković	oknedar@gmail.com	0917694727	IR-0063
Stjepan	Korent	stkorent@gmail.com	0981970067	IR-0064
Zvonko	Sekula	zvonko.sekula@gs.ht.hr	0917969618	IR-0065
Vlado	Bogut	vlado.bogut1954@gmail.com	0038763328361	IR-0066
Tudor	Vidović	tudor.vidovic@inet.hr	0915625557	IR-0067
Šimun	Čanić	Lts.simun@gmail.com	098381537	IR-0068
Ljiljana	Mance	ljiljana.mance1@gmail.com	0915066358	IR-0069
Davor	Marković	davor.markovic2@gmail.com	0915726706	IR-0070
Boris	Pleskina	boris.pleskina@gmail.com	0921655827	IR-0071
Krešimir	Furić	kfuric@gmail.com	0917677370	IR-0072
Radovan	Sremac	radovansremac@yahoo.com		IR-0073
Andrija Petar	Bosnjak	apbosnjak@gmail.com	0916204243	IR-0074
Radenko	Sloković	oknedar@gmail.com	0917694727	IR-0075
Jasminka	Bedeković	Jasna.bedekovic@gmail.com	0981754789	IR-0076
Matea	Ćutuk	Matea.cutuk@gmail.com	0977338319	IR-0077
Jasmina	Godler	Godler.jasmina@gmail.com		IR-0078
Prosper	Maričić	prosper@maricic.info	0915416787	IR-0079
Mira	Vuković	miravukovic09@gmail.com	0641571076	IR-0080
Damir	Leko	damir.leko1@gmail.com	0038763490925	IR-0081
Ivan	Mladenović	ivan.mladenovic177@gmail.com	095 587 6002	IR-0082
Jasna	Sušac	jasnasusac@gmail.com	098660044	IR-0083
Tonka	Leš	tonka.les25@gmail.com	099 758 3201	IR-0084
Mary Frances 	Mahalovich	maryf123@moscow.com	1 208 882 2511	IR-0085
Tjaša	Vrhovnik Mlekuž	Tjasa.vrh@gmail.com		IR-0086
Melita	Marčelja	melitamarcelja@gmail.com	0915975674	IR-0087
Marina	Marjanović	marina_zmaj@hotmail.com		IR-0088
Emil	Mikša	emil.miksa@gmail.com	098415818	IR-0089
Deana	Marković	daena881@gmail.com	098186513	IR-0090
Veronika	Marić-Tušić	tusicnikola@att.net	1-414-795-0125	IR-0091
Velimir	Geci	gemb62@gmail.com	0958184395	IR-0092
Nikša	Kuščić	nkuscic@hotmail.com	0981709153	IR-0093
Ivan	Butković	bitoraj1385@gmail.com	0916109733	IR-0094
Josip	Puh	josip.puh@gmail.com	098 903 6049	IR-0095
Renata	Tešija	Renatatesijabasic@gmail.com	0912190080	IR-0096
Klaudija	Gamulin	teta_koludija@hotmail.com		IR-0097
Draga Ljilja	Šćepanović	draga.s@net.hr		IR-0098
Jana 	Krajinovic	j.pusic@yahoo.de	+49 176 80131582	IR-0099
Branimir 	Parađ	paradrun@gmail.com		IR-0100
Gary	Yurkovich	gary@yurkovich.com	+1-604-889-8454	IR-0101
Tomislav	Ivančan	ivancan.tomislav@gmail.com	095 3709649	IR-0102
Mihaela	Hečimović	mh9272@gmail.com		IR-0103
Jelena	Plesa	jelena.plesa17@gmail.com	+1-647-297-4374	IR-0104
Stephanie	Zupcic	stefanizupcic@gmail.com		IR-0105
Elvis	Gotal	egotal@gmail.com	098/638-723	IR-0106
Jasna	Brčić	jasna3003@gmail.com	0989588859	IR-0107
Zdravko	Benedik	benedik.zdravko@gmail.com	0914973260	IR-0108
Lidija	Dinjar	lidija.pranjes@gmail.com		IR-0109
Lidija	Beneš	lidija.benes@gmail.com	+491784181681	IR-0110
Damir	Basar	basardamir@gmail.com	0916089502	IR-0111
Luka	Marunić	luka.marunic@panon-trade.hr	091 33 25 969	IR-0112
Snježana	Ajhler	nena.ajhler@gmail.com	0992148427	IR-0113
Nathalie	Malenica Neskovcin	malenicanathr@gmail.com	0912888885	IR-0114
Franjo	Barišić	fbarisic@gmail.com	0915863072	IR-0115
Ljubo	Stipić	ljubostipic@gmail.com	0038763194097	IR-0116
Lidija	Žderić	zdericlidija@gmail.com	0953581270	IR-0117
Mario	Klobučar	Martinklobucar@gmail.com	6477711681	IR-0118
Iris	Meško	meskoiris@hotmail.com	004915115580438	IR-0119
Vlatka	Doko	vlatka.matejic@gmail.com	0959022350	IR-0120
Nikola	Kovač	Livnogen@gmail.com	+491601006000	IR-0121
Slobodan	Rajić	slobodan.rajic@icloud.com	+385 98 232 606	IR-0122
Jadranka	Marić	jadranka.maric.zagreb@gmail.com	+385989581658	IR-0123
Branka	Weber	weber.branka@gmail.com	0918904693	IR-0124
Ines	Vujnović	ines.vujnovic@zg.t-com.hr	0955333206	IR-0125
Boja	Šegrt	bojas1388@gmail.com	381649417096	IR-0126
Mario	Lagator	mario.lagator1@gmail.com	0951993994	IR-0127
Luka	Kapulica	cunculovicluk@gmail.com	+436705080074	IR-0128
Jasna	Lukić	ljasna32@gmail.com	099 444 4498	IR-0129
Anto	Plejić	anto.plejic13@gmail.com	00385958818454	IR-0130
Boris	Guberina	bguberina@gmail.com	0916100777	IR-0131
Zdravko	Semper	zdravko.semper@gmail.com	0915937711	IR-0132
Tania	Lugomer-Pomper	indigohr@gmail.com	+912224400	IR-0133
Milenko	Rašić	milenko.rasic@tel.net.ba	091 9754300	IR-0134
Dubravka	Franjić	dubravk.franjic11@gmail.com	0979538904	IR-0135
Krešimir	Sliepčević	ksliepcevic11@gmail.com	0992605554	IR-0136
Miho	Bender	miso.bender@gmail.com	0914865011	IR-0137
Đuro	Mesić	djuro.mesic@gmail.com	0914035815	IR-0138
Božidar	Koska	bozidar.koska@gmail.com	0989700391	IR-0139
Azijada	Fazlić	azijada.fazlic@gmail.com	098 210 318	IR-0140
Laura	Hercog	laurencountey@proton.me		IR-0141`;

const lines = rawData.split('\n');
const contributors = [];

for (const line of lines) {
  if (!line.trim()) continue;
  
  // Split by tabs or multiple spaces
  const parts = line.split(/\t+| {2,}/).map(p => p.trim());
  
  // parts[0]: Ime
  // parts[1]: Prezime
  // parts[2]: Email
  // parts[3]: Telefon (might be empty/missing if it's the last one)
  // parts[4]: Oznaka (or parts[3] if parts[4] is missing and parts[3] looks like an ID)

  let ime, prezime, email, telefon = '', oznaka = '';

  if (parts.length >= 5) {
    ime = parts[0];
    prezime = parts[1];
    email = parts[2];
    telefon = parts[3];
    oznaka = parts[4];
  } else if (parts.length === 4) {
    ime = parts[0];
    prezime = parts[1];
    email = parts[2];
    // Check if parts[3] is an ID (IR-XXXX)
    if (parts[3].startsWith('IR-')) {
      oznaka = parts[3];
    } else {
      telefon = parts[3];
    }
  } else if (parts.length === 3) {
      // Very minimal case
      ime = parts[0];
      prezime = parts[1];
      email = parts[2];
  }

  const contributor = {
    id: `contributor_${Math.random().toString(36).substr(2, 9)}`,
    data: {
      [template.ime]: ime,
      [template.prezime]: prezime,
      [template.email]: email,
      [template.telefon]: telefon,
      [template.oznaka]: oznaka
    }
  };
  contributors.push(contributor);
}

const contributorsJson = JSON.stringify(contributors);
db.prepare('UPDATE projects SET contributors = ? WHERE id = 2').run(contributorsJson);

console.log(`Successfully added ${contributors.length} contributors to project ID 2.`);
db.close();
