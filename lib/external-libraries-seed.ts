import { ExternalLibrariesDB } from './database';

const rawData = `K-kod,Naziv ustanove,Poštanski broj,Mjesto,Adresa,E-mail (službeni),E-mail (direktni),Telefon,Odgovorna osoba
K-1337/6,Javna ustanova Narodna knjižnica Kostrena,51221,Kostrena,Sveta Lucija 14,knjiznica@knjiznica-kostrena.hr,-,051 289 578,Dragana Vučinić
K-1339/3,Gradska knjižnica Slobodana Novaka Rab,51280,Rab,Gornja ulica 21,knjiznica@gk-rab.hr,-,051 726 035,Lidija Domijan Šipovac
K-1610/2,Općinska knjižnica Ivan Matij Škarić,21410,Postira,Glavica 1,knjiznica@opcina-postira.hr,-,021 254 183,Marijana Kličinović
K-27/5,Narodna knjižnica Petar Preradović,43000,Bjelovar,Trg Eugena Kvaternika 11,ravnateljstvo@knjiznica-bjelovar.hr,-,043 243 624,Vjeruška Štivić
K-308/5,Gradska knjižnica Labin,52220,Labin,Rudarska 1/A,gklabin@gk-labin.hr,-,052 852 257,Silvia Fiamengo
K-463/7,Gradska knjižnica Ivan Goran Kovačić Karlovac,47000,Karlovac,Ljudevita Šestića 1,info@gkka.hr,-,047 412 377,Željka Janči
K-527/4,Gradska knjižnica Orahovica,33515,Orahovica,Kralja Zvonimira 28,gkorahovica@gmail.com,-,033 561 388,Matea Šumrada
K-1428/2,Narodna knjižnica i čitaonica Majur,44433,Majur,Svetog Mihovila 2,nkc_majur@net.hr,-,044 858 064,Suzana Tumurad
K-129/13,Gradska i sveučilišna knjižnica Osijek,31000,Osijek,Europska avenija 24,gisko@gskos.hr,-,031 211 218,Renata Šinko
K-1676/2,Općinska knjižnica Pokupsko,10414,Pokupsko,Trg Pavla Štoosa 15,knjiznica@pokupsko.hr,-,01 621 6234,Gordana Markuz
K-934/11,Narodna knjižnica i čitaonica Halubajska zora,51216,Viškovo,Marinići 9,sredisnja.marinici@gmail.com,-,051 682 404,Danijela Pešić
K-1635/1,Narodna knjižnica i čitaonica Lekenik,44272,Lekenik,Hermana Gmainera 2,nkc.lekenik@gmail.com,-,044 772 605,Snježana Pokorny
K-24/6,Knjižnica i čitaonica Fran Galović Koprivnica,48000,Koprivnica,Zrinski trg 6,info@knjiznica-koprivnica.hr,-,048 622 363,Anita Mehkek
K-886/11,Gradska knjižnica Rijeka,51000,Rijeka,Viktora Cara Emina 1,gkri@gkri.hr,-,051 211 139,Irena Pravdica
-,Ogranak Drenova,51000,Rijeka,Brca 8b,drenova@gkri.hr,-,051 254 813,-
-,Ogranak Trsat,51000,Rijeka,Trg Viktora Bubnja 1,trsat@gkri.hr,-,051 264 251,-
-,Ogranak Turnić,51000,Rijeka,Franje Čandeka 36E,turnic@gkri.hr,-,051 646 859,-
-,Ogranak Zamet,51000,Rijeka,Trg riječkih olimpijaca 1,zamet@gkri.hr,-,051 265 039,-
-,Knjižnica Čavle,51219,Čavle,Čavja 31,cavle@gkri.hr,-,051 208 313,-
-,Knjižnica Omišalj,51513,Omišalj,Prikešte 13,vidomisljanin@gkri.hr,-,051 661 985,-
K-1448/8,Gradska knjižnica Bakar,51222,Bakar,Primorje 45,knjiznica@gkbakar.hr,-,051 761 263,Dolores Paro-Mikeli
K-265/5,Narodna knjižnica Ploče,20340,Ploče,Vladimira Nazora 12/A,narodna-knjiznica-ploce@h-1.hr,-,020 676 393,Jurica Karamatić
K-935/4,Narodna knjižnica i čitaonica Kraljevica,51262,Kraljevica,Frankopanska 1/A,knjiznica.kraljevica@email.t-com.hr,-,051 282 099,Milanka Gudac
K-1542/3,Gradska knjižnica Opuzen,20355,Opuzen,Trg opuzenske bojne 2,gkopuzen@gmail.com,karmela.pk@gmail.com,020 672 352,Karmela Popić Kešina
K-740/24,Gradska knjižnica Marka Marulića Split,21000,Split,Ulica Slobode 2,gkmm@gkmm.hr,-,021 685 012,Jelena Grgić
-,Knjižnica Podstrana,21312,Podstrana,Dr. Franje Tuđmana 3,podstrana@gkmm.hr,-,021 331 001,-
-,Knjižnica Grohote-Šolta,21430,Grohote,Grohote b.b.,solta@gkmm.hr,-,021 654 616,-
K-827/5,Općinska knjižnica i čitaonica Jelsa,21465,Jelsa,Jelsa 408,opcinska.knjiznica.i.citaonica.jelsa@st.t-com.hr,-,021 761 237,Maja Vukić
K-1244/2,Narodna knjižnica Hrvatski skup,21412,Pučišća,Trg Hrvatskog skupa 10,hrvatski.skup@st.t-com.hr,-,021 633 533,Zorka Martinić
K-137/3,Gradska knjižnica Našice,31500,Našice,Trg dr. Franje Tuđmana 5,knjiznica.nasice.ravnateljica@gmail.com,-,031 614 421,Marija Buha
K-464/2,Knjižnica i čitaonica Vojnić,47220,Vojnić,A. Hebranga 2,knjiznica-vojnic@ka.t-com.hr,ivicajosip@gmail.com,047 883 024,Ivica Josipović
K-472/4,"Gradska knjižnica ""Juraj Šižgorić"" Šibenik",22000,Šibenik,Poljana 6,gks@knjiznica-sibenik.hr,azafranovic@knjiznica-sibenik.hr,022 201 280,Anita Zafranović
K-1090/19,Knjižnice grada Zagreba,10000,Zagreb,Starčevićev trg 6,kgz@kgz.hr,-,01 469 4300,-
-,Knjižnica Božidara Adžije,10000,Zagreb,Ulica Petra Krešimira IV. 2,knjiznica.bozidara.adzije@kgz.hr,-,01 465 5025,Ivan Jelić
-,Knjižnica Tina Ujevića,10000,Zagreb,Ulica grada Vukovara 14,knjiznica.tina.ujevica@kgz.hr,-,01 309 5220,Lucija Hodžajev
-,Knjižnica Dubrava,10000,Zagreb,Avenija Dubrava 51 A,knjiznica.dubrava@kgz.hr,-,01 285 1788,Đurđica Pugelnik
-,Knjižnica Medveščak,10000,Zagreb,Trg žrtava fašizma 7,knjiznica.medvescak@kgz.hr,-,01 461 1481,Luka Kvesić
-,Knjižnica Novi Zagreb,10000,Zagreb,Ulica Božidara Magovca 15,knjiznica.novi.zagreb@kgz.hr,-,01 660 4088,Tihana Rašeta
-,Knjižnica Augusta Cesarca,10000,Zagreb,Šubićeva 40/2,knjiznica.augusta.cesarca@kgz.hr,-,01 231 3066,Aleksandra Cvitković
-,Knjižnica Sesvete,10360,Sesvete,Trg Dragutina Domjanića 6,knjiznica.sesvete@kgz.hr,-,01 200 2064,Ivan Babić
-,Knjižnica S. S. Kranjčevića,10000,Zagreb,Zapoljska 1,knjiznica.s.s.kranjcevica@kgz.hr,-,01 231 8596,Iva Lorković
-,Knjižnica Marije Jurić Zagorke,10000,Zagreb,Krvavi most 2,knjiznica.m.j.zagorke@kgz.hr,-,01 481 3993,Maja Pranić
-,Knjižnica Marina Držića,10000,Zagreb,Ulica grada Vukovara 222,knjiznica.marina.drzica@kgz.hr,-,01 615 1697,Božica Dragaš
-,Knjižnica Bogdana Ogrizovića,10000,Zagreb,Preradovićeva 5,knjiznica.bogdana.ogrizovica@kgz.hr,-,01 481 0704,Jasna Kovačević
-,Knjižnica Vladimira Nazora,10000,Zagreb,Vodovodna 13,knjiznica.vladimira.nazora@kgz.hr,-,01 370 3414,Svjetlana Ciglar
-,Gradska knjižnica Ante Kovačića,10290,Zaprešić,Trg žrtava fašizma 6,gradska.knjiznica.zapresic@kgz.hr,-,01 331 0290,Tatjana Vrdoljak
K-136/2,Gradska knjižnica i čitaonica Valpovo,31550,Valpovo,J.J.Strossmayera 36,gradska_knjiznica_valpovo@yahoo.com,sandra.miljacki@gmail.com,031 651 499,Sandra Miljački Andrić
K-1348/2,Gradska knjižnica Vrgorac,21276,Vrgorac,Matice hrvatske 11,gradska.knjiznica.vrgorac@gmail.com,-,021 675 055,Jelena Mihnjak
K-556/5,Gradska knjižnica i čitaonica Mursko Središće,40315,Mursko Središće,Trg bana Josipa Jelačića 10,gradska-knjiznica-i-citaonica@ck.t-com.hr,knjiznica@mursko-sredisce.hr,040 543 113,Ivana Sakač
K-262/4,Gradska knjižnica Pazin,52000,Pazin,Šetalište Pazinske gimnazije 1a,info@gk-pazin.hr,ravnateljica@gk-pazin.hr,052 624 488,Majda Milevoj Klapčić
K-1450/1,Hrvatska narodna knjižnica Antonio Rendić Ivanović Sutivan,21403,Sutivan,Kala o konguli 2,knjiznica-sutivan@otok-brac.info,franjo.brac@gmail.com,021 718 000,Franjo Mlinac
K-73/3,Gradska knjižnica i čitaonica Mladen Kerstner Ludbreg,42230,Ludbreg,Trg svetog Trojstva 19,info@knjiznica-ludbreg.hr,ravnatelj@knjiznica-ludbreg.hr,042 306 065,Stjepan Stjepić
K-1338/5,Narodna knjižnica Ivan Žagar Čabar,51306,Čabar,Narodnog oslobođenja 2,s.zurgaparipovic@cabar.hr,-,051 821 412,Žurga Paripović Sintija
K-1547/2,Knjižnica i čitaonica grada Preloga,40323,Prelog,Glavna ulica 33,knjiznica.prelog@gmail.com,-,040 646 753,Maja Lesinger
K-1426/1,Gradska knjižnica i čitaonica Ante Jagar,44330,Novska,Trg dr. Franje Tuđmana 4,knjiznica@knjiznica-novska.hr,-,044 600 252,Darija Jež
K-677/4,Gradska knjižnica Ivanić-Grad,10310,Ivanić-Grad,Moslavačka 11,gkig@gkig.hr,senka@gkig.hr,01 288 2974,Senka Kušar Bisić
K-689/3,Gradska knjižnica Samobor,10430,Samobor,M. Krleže 9,gks@vip.hr,mdimnjakovic@samobor.hr,01 336 1803,Mirjana Dimnjaković
K-930/5,Knjižnica i čitaonica Gračac,23440,Gračac,Nikole Tesle 44,knjiznica.i.citaonica@gracac.tcloud.hr,-,023 775 003,Soka Stanisavljević
K-938/3,Javna ustanova Narodna knjižnica i čitaonica Bribir,51253,Vinodolska općina,Bribir 31,zjk@vinodol.hr,-,051 248 103,Željka Jurčić-Kleković
K-1250/1,Narodna knjižnica Drniš,22320,Drniš,Kralja Zvonimira 8,kontakt@narodna-knjiznica-drnis.hr,-,022 888 140,Danijela Drezga
K-1695/1,Narodna knjižnica i čitaonica sv. Benedikta Nuštar,32221,Nuštar,Križnog puta 18,knjiznicanustar@gmail.com,mmihaljkovic1311@gmail.com,032 386 309,Martina Vignjević
K-135/3,Gradska knjižnica i čitaonica Belišće,31551,Belišće,Trg Ante Starčevića 1,knjiznica@belisce.hr,-,031 400 627,Vlasta Putar
K-370/3,Narodna knjižnica Hum na Sutli,49231,Hum na Sutli,Hum na Sutli 175,knjiznica@humnasutli.hr,-,049 341 064,Narcisa Brezinščak
K-528/4,Gradska knjižnica i čitaonica Slatina,33520,Slatina,Šetalište Julija Burgera 1,ravnatelj@knjiznica-slatina.hr,-,033 300 675,Sanja Pajnić
K-487/3,Gradska knjižnica Vodice,22211,Vodice,Obala Vladimira Nazora 4,info@gkv.hr,-,022 442 095,Martina Tabula
K-414/7,Gradska knjižnica Novigrad-Cittanova,52466,Novigrad,Rivarela 7,info@knjiznicanovigrad.hr,-,052 729 040,Morena Moferdin
K-1087/5,Općinska knjižnica Hrvatska sloga Gradac,21330,Gradac,Jadranska 107,opcinska.knjiznica.hrvatska.sloga.gradac@st.t-com.hr,msinkovicpavlovic@yahoo.com,021 697 366,Mandalena Sinković Pavlović
K-467/2,Općinska knjižnica Hrvatska čitaonica Bol,21420,Bol,Porat bolskih pomoraca bb,hrvatska.citaonica.bol@gmail.com,-,021 663 5434,Irma Bezmalinović
K-460/3,Gradska knjižnica i čitaonica Duga Resa,47250,Duga Resa,Kasar 19,info@gkicdr.hr,-,047 841 491,Astrid Grobenski-Grgurić
K-1593/3,Narodna knjižnica i čitaonica Tisno,22240,Tisno,Uska ulica 1,ravnateljica@nkc-tisno.hr,-,022 438 277,Andrea Vlaić
K-1422/5,Gradska knjižnica i čitaonica Vinkovci,32100,Vinkovci,Kralja Zvonimira 9,knjiznica@gkvk.hr,iva@gkvk.hr,032 616 420,Iva Grković
-,Narodna knjižnica i čitaonica Bošnjaci,32275,Bošnjaci,Trg fra Bernardina Tome Leakovića 10,bosnjaci@gkvk.hr,-,032 619 716,-
K-1053/3,Narodna knjižnica Kali,23272,Kali,Trg Marnjiva 23,knjiznica.kali@gmail.com,-,023 281 804,Tomislava Radović
K-1336/1,Gradska knjižnica Krk,51500,Krk,Kvarnerska 23,narodna.knjiznica.krk@ri.t-com.hr,-,051 221 149,Ivančica Justinić
K-578/5,Gradska knjižnica Matija Vlačić Ilirik Rovinj,52210,Rovinj,Domenica Pergolisa 2,knjiznica@gk-rovinj.hr,vedrana@gk-rovinj.hr,052 840 194,Vedrana Damijanić
K-676/7,Javna ustanova Narodna knjižnica Otočac,53220,Otočac,Bana Josipa Jelačića 16,narodna.knjiznica@gs.t-com.hr,-,053 773 283,Jadranka Prša
K-1268/4,Narodna knjižnica Virje,48326,Virje,Trg Stjepana Radića 1,narodna.knjiznica@virje.hr,ivanka.martincic@virje.hr,048 897 095,Ivanka Ferenčić Martinčić
K-1653/2,Narodna knjižnica i čitaonica Okučani,35430,Okučani,Trg dr. Franje Tuđmana 1,knjiznica.okucani@gmail.com,-,035 371 445,Dijana Kašljević
K-1661/1,Gradska knjižnica Novalja,53291,Novalja,Vodovodna 3,info@gknv.hr,ibreznickikustic@gmail.com,053 661 391,Ivana Kustić
K-932/4,Gradska knjižnica Janet Majnarich Delnice,51300,Delnice,Radićeva 3,knjiznicadelnice@gmail.com,-,051 812 430,Indira Rački Joskić
K-928/3,Knjižnica i čitaonica Plaški,47304,Plaški,Saborčanska bb,knjiznica.i.citaonica@ka.t-com.hr,vvezmar@gmail.com,047 811 868,Veljko Vezmar
K-1431/1,Knjižnica i čitaonica Glina,44400,Glina,Stjepana i Antuna Radića 10,knjiznica.glina@gmail.com,-,044 882 844,Suzana Šantek
K-264/4,Narodna knjižnica Blato,20271,Blato,1. ulica 25,knjiznica.blato@gmail.com,-,020 851 190,Nina Cvitković Bačić
K-331/3,Javna gradska ustanova Gradska knjižnica Sinj,21230,Sinj,Ul. Alajčauša Frane Bareze Šore 1,gk-sinj@st.t-com.hr,-,021 821 283,Ira Pandža
K-1698,Knjižnica Mihaela Šiloboda Sveta Nedelja,10431,Sveta Nedelja,Marijana Stilinovića 7,kulturnicentar@grad-svetanedelja.hr,robert.maracic@grad-svetanedelja.hr,01 485 2388,Robert Maračić
K-825/4,Gradska knjižnica i čitaonica Stari Grad,21460,Stari Grad,Novo riva 2,czk-stari-grad@st.htnet.hr,-,021 765 910,Jelena Gracin
K-927/2,Narodna knjižnica Dalj,31226,Dalj,Bana Josipa Jelačića 12,knjiznicadalj@net.hr,-,031 590 533,Vukosava Milakić
K-1463/3,Općinska knjižnica općine Kolan Šime Šugar Ivanov,23251,Kolan,Bartula Kašića 10,knjiznicakolan@yahoo.com,-,023 550 449,Ana Gligora
K-1468/4,Općinska narodna knjižnica Babina Greda,33276,Babina Greda,Ulica Vladimira Nazora 1,knjiznica.bg@gmail.com,-,032 854 037,Ivana Jurić
K-834/4,Gradska knjižnica Nova Gradiška,35400,Nova Gradiška,Matije Antuna Relkovića 4,gradskaknjiznicang@gmail.com,-,035 330 040,Ernestina Straga-Šašić
K-933/1,Narodna čitaonica i knjižnica Novi Vinodolski,51250,Novi Vinodolski,Trg Vinodolskog zakona 1,citaonica@novi.tcloud.hr,-,051 244 413,Barbara Kalanj Butković
K-1594/2,Knjižnica i čitaonica Velika Ludina,44316,Velika Ludina,Obrtnička 3,knjiznica.velika.ludina@gmail.com,-,044 658 910,Josipa Lažeta
K-371/2,Knjižnica Donja Stubica,49240,Donja Stubica,Nova ulica 1,info@pou-stubica.hr,racunovodstvo@pou-stubica.hr,049 286 133,Vesna Gospočić Mokrovčak
K-475/4,Narodna knjižnica Knin,22300,Knin,Krešimirova 20-24,narodna.knjiznica.knin@gmail.com,ivica.simic73@gmail.com,022 660 010,Ivica Šimić
K-884/14,Gradska knjižnica Kaštela,21212,Kaštela,Trg palih za domovinu 1,gkkracunovodstvo@gmail.com,dobricrenata9@gmail.com,021 226 303,Renata Dobrić
-,Odjel Kaštel Gomilica,21213,Kaštel Gomilica,Cesta dr. Franje Tuđmana 52,gkkgomilica@gmail.com,-,021 223 108,-
-,Odjel Kaštel Kambelovac,21214,Kaštel Kambelovac,Brce 23,gkkambelovac@gmail.com,-,021 220 295,-
-,Odjel Kaštel Lukšić,21215,Kaštel Lukšić,Lušiško brce 3,gkkluksic@gmail.com,-,021 228 622,-
-,Dječji odjel Kaštel Stari,21216,Kaštel Stari,Put banovine,gkkstari@gmail.com,-,021 230 172,-
-,Odjel za odrasle Kaštel Novi,21217,Kaštel Novi,Brce 3,gkknovi@gmail.com,-,021 230 833,-
-,Odjel Kaštel Sućurac,21212,Kaštel Sućurac,Trg palih za domovinu 1,gkksucurac@gmail.com,-,021 226 001,-
K-570/3,Knjižnica Nikola Zrinski Čakovec,40000,Čakovec,Trg Republike 4,ravnatelj@kcc.hr,-,040 310 595,Ljiljana Križan
K-926/3,Gradska knjižnica Viktor Car Emin Opatija,51410,Opatija,Nikole Tesle 2,ravnatelj@gk-opatija.hr,-,051 711 511,Suzana Šturm-Kržić
-,Knjižnica Matulji,51211,Matulji,Kastavska cesta 4,knjiznica.matulji@gk-opatija.hr,-,051 277 595,Jelena Višnjić
-,Knjižnica Kastav,51215,Kastav,Put Vladimira Nazora 3,knjiznica.kastav@gk-opatija.hr,-,051 691 049,Mirela Kričkić-Marcan
-,Knjižnica Lovran,51415,Lovran,Šetalište maršala Tita 29,knjiznica.lovran@gk-opatija.hr,-,051 293 035,Rosana Zuljani
-,Knjižnica Mošćenička Draga,51417,Mošćenička Draga,Barba Rike 5a,knjiznica.mdraga@gk-opatija.hr,-,051 737 901,Ana Montan Velčić
K-1432/1,Knjižnica i čitaonica Dvor,44440,Dvor,Trg bana Josipa Jelačića 10,knjiznica-citaonica-dvor@sk.htnet.hr,-,044 871 169,Gorana Jandrić
K-936/6,Gradska knjižnica Ivana Gorana Kovačića Vrbovsko,51326,Vrbovsko,Ivana Gorana Kovačića 20a,vrbovsko.knjiznica@gmail.com,-,051 875 159,Gordana Vučinić
-,Knjižnična stanica Moravice,51325,Moravice,Školska 3,vrbovsko.knjiznica@gmail.com,-,051 877 222,-
-,Knjižnična stanica Severin na Kupi,51329,Severin na Kupi,Severin na Kupi 9,vrbovsko.knjiznica@gmail.com,-,091 547 5852,-
-,Knjižnična stanica Lukovdol,51328,Lukovdol,Lukovdol 8,vrbovsko.knjiznica@gmail.com,-,051 871 295,-
K-941/9,Gradska knjižnica i čitaonica Frane Petrića,51557,Cres,Trg Sv. Frane 8,knjiznica-cres@ri.t-com.hr,-,051 571 054,Stefano Negovetić
K-1664/1,Narodna knjižnica Silvije Strahimir Kranjčević Vrhovine,53223,Vrhovine,Senjska 60,snjezana@vrhovine.hr,-,053 333 345,Snježana Samolov
K-358/5,Gradska knjižnica Požega,34000,Požega,A. Kanižlića 1,gkpz@gkpz.hr,-,034 275 394,Aleksandra Šutalo
K-1249/4,Gradska knjižnica Ivana Belostenca Ozalj,47280,Ozalj,Kolodvorska 1/A,knjiznicaozalj@gmail.com,-,047 732 167,Bogdan Bošnjak
K-705/7,Gradska knjižnica Velika Gorica,10410,Velika Gorica,Zagrebačka 37,ravnateljica@knjiznica-vg.hr,-,01 623 7824,Ivana Grubačević
-,Područna knjižnica Galženica,10410,Velika Gorica,Trg Stjepana Radića 5,voditeljica@knjiznica-vg.hr,-,01 622 2194,Dražena Petrišić
K-738/3,Knjižnica i čitaonica Simo Mraović Gvozd,44410,Gvozd,Trg dr. Franje Tuđmana 1,knjiznica.gvozd@gmail.com,-,044 881 249,Senka Crevar
K-1434/13,Narodna knjižnica Vlado Gotovac Sisak,44000,Sisak,Rimska ulica 27,nkc.sisak@gmail.com,-,044 500 510,Senka Batinjan
-,Ogranak Caprag,44000,Sisak,Trg hrvatske državnosti 1,nkcogranakcaprag@gmail.com,-,044 537 686,Gordana Bjelovarac
K-720/3,Gradska knjižnica Dugo Selo,10370,Dugo Selo,J. Zorića 17,gkds@gkds.hr,-,01 275 3754,Predrag Topić
K-841/3,Gradska knjižnica Makarska,21300,Makarska,Don Mihovila Pavlinovića 1,info@gradska-knjiznica-makarska.hr,-,021 612 042,Ana Duvnjak
K-1066/2,Gradska knjižnica Benkovac,23420,Benkovac,Šetalište kneza Branimira 46,gk-benkovac@zd.t-com.hr,-,023 681 182,Mile Marić
K-266/6,Gradska knjižnica Metković,20350,Metković,Ulica kralja Zvonimira 4,gradska.knjiznica@du.t-com.hr,-,020 681 715,Vesna Vidović
K-365/2,Općinska knjižnica Krapinske Toplice,49217,Krapinske Toplice,Ljudevita Gaja 27,knjiznica.ktoplice@kr.t-com.hr,-,049 232 288,Nadica Majsec-Kobaš
K-1057/4,Knjižnica i čitaonica Obrovac,23450,Obrovac,Trg dr. Franje Tuđmana 2,pucko.otvoreno.uciliste.obrovac@zd.t-com.hr,-,023 689 140,Marina Brkić
K-468/2,Gradska knjižnica Trogir,21220,Trogir,Obala bana Berislavića 15,gkt@gkt.hr,-,021 882 949,Sanda Marlais Buble
K-685/5,Gradska knjižnica Sveti Ivan Zelina,10380,Sveti Ivan Zelina,Trg Ante Starčevića 12,valentina@knjiznica-zelina.hr,-,01 206 1064,Valentina Strelar Dananić
K-940/10,Gradska knjižnica Mali Lošinj,51550,Mali Lošinj,Zagrebačka 2,knjiznica-losinj@ri.t-com.hr,armida.vlasic@knjiznica-losinj.hr,051 231 014,Armida Vlašić
K-1597/1,Narodna knjižnica i čitaonica Murter,22243,Murter-Kornati,Butina 2,knjiznica.murter@si.t-com.hr,mande.turcinov@si.t-com.hr,022 435 500,Mande Turčinov-Ježina
K-699/2,Narodna knjižnica i čitaonica Jastrebarsko,10450,Jastrebarsko,Dr. Franje Tuđmana 9,knjiznica@czk-jastrebarsko.hr,marko.savic@czk-jastrebarsko.hr,01 552 0442,Marko Savić
K-824/3,Gradska knjižnica i čitaonica Hvar,21450,Hvar,Vicka Butorovića 2,knjiznica.hvar@inet.hr,-,021 742 997,Nikla Barbarić
K-1251/2,Gradska knjižnica Ranko Marinković Komiža,21485,Komiža,Ulica komiških iseljenika 1,knjiznica.komiza@email.t-com.hr,luce.bodanovic82@gmail.com,021 713 216,Luca Bogdanović
K-1319/1,Gradska knjižnica i čitaonica Vis,21480,Vis,Šetalište Viškog boja 13,gkc.vis@gmail.com,tamara.alavanja@yahoo.com,021 711 925,Tamara Alavanja
K-1464/7,Narodna knjižnica u Dugopolju,21204,Dugopolje,Trg Franje Tuđmana 1,knjiznica@nkd.dugopolje.hr,-,021 655 611,Slavica Plazibat
K-1628/1,Općinska knjižnica Stubičke Toplice,49244,Stubičke Toplice,Viktora Šipeka 16,knjiznicastubaki@gmail.com,-,049 238 005,Silvija Drempetić
K-267/3,Narodna knjižnica Ston,20230,Ston,Put braće Mihanović 4a,knjiznica.ston@gmail.com,sandra.vuletic6@gmail.com,020 754 603,Sandra Vuletić
K-361/5,Gradska knjižnica Vukovar,32000,Vukovar,Trg Republike Hrvatske 4/1,knjiznica-vukovar@gkvu.hr,anita.baier.jakovac@gkvu.hr,032 450 352,Anita Baier Jakovac
-,Ogranak Borovo Naselje,32010,Vukovar,Domovinskog rata 1,ogranak.borovo@gkvu.hr,-,032 423 207,-
-,Ogranak Sotin,32232,Sotin,Dr. Franje Tuđmana 20,ogranak.sotin@gkvu.hr,-,032 512 906,-
-,Ogranak Lovas,32237,Lovas,Kralja Tomislava 13,ogranak.lovas@gkvu.hr,-,032 525 041,-
K-925/2,Narodna knjižnica općine Plitvička Jezera,53230,Plitvička Jezera,Trg sv. Jurja 19,mmecev@yahoo.com,-,098 494 711,Mile Mečev
K-1350/3,Gradska knjižnica Omiša,21310,Omiš,Punta 1,gradskaknjiznicaomis@gmail.com,buljevicsvjetlana@gmail.com,021 757 192,Svjetllana Buljević
K-1351/3,Narodna knjižnica Dugi Rat,21315,Dugi Rat,Trg kralja Tomislava 9,knjiznicadugirat@gmail.com,-,021 734 610,Katica Franić
K-1401/1,Narodna knjižnica u Supetru,21400,Supetar,Ignjata Joba 7,knjiznica-supetar@st.t-com.hr,-,021 630 676,Ivana Vukasović-Lončar
K-1584/1,Gradska knjižnica Don Mihovil Pavlinović Imotski,21260,Imotski,Kralja Zvonimira 1,gradska.knjiznica.imotski@st.t-com.hr,-,021 670 572,Marija Jović
K-461/3,Gradska knjižnica i čitaonica Ogulin,47300,Ogulin,Bernardina Frankopana 7,knjiznica@gkc-ogulin.hr,-,047 522 170,Anita Brozović Šolaić
K-1031/2,Gradska knjižnica Pag,23250,Pag,Od špitala 1,gradska-knjiznica-pag@zd.t-com.hr,-,-,-
K-1047/6,Gradska knjižnica Zadar,23000,Zadar,Stjepana Radića 11b,gkzd@gkzd.hr,nada.radman@gkzd.hr,023 301 102,Nada Radman
-,Ogranak Arbanasi,23000,Zadar,V. Zmajevića 12a,arbanasi@gkzd.hr,-,023 301 973,-
-,Ogranak Bili brig,23000,Zadar,Put Pudarice 15,bilibrig@gkzd.hr,-,023 327 629,-
-,Ogranak Crno,23000,Zadar,Crno 145,crno@gkzd.hr,-,023 274 091,-
-,Ogranak Grad,23000,Zadar,Trg Petra Zoranića 1,ogranak.grad@gkzd.hr,-,023 630 611,-
-,Ogranak Ploča,23000,Zadar,Grgura Barskog Zadranina 10,ploca@gkzd.hr,-,023 342 199,-
K-1242/3,Gradska knjižnica Senj,53270,Senj,Trg Cilnica 11,gradska.knjiznica.senj@gs.t-com.hr,-,053 881 108,Ana Prpić Rogić
K-1462/1,Narodna knjižnica općine Perušić,53202,Perušić,Trg popa Marka Mesića 2,narodna.knjiznica.opcine.perusic1@gs.t-com.hr,josipamikovic95@gmail.com,053 679 231,Josipa Milković
K-1327/4,Narodna knjižnica Šime Vučetić Vela Luka,20270,Vela Luka,Ulica 26 br. 2,nksimevucetic@velaluka.hr,anitavl2020@gmail.com,020 813 001,Anita Kosović
K-29/3,Gradska knjižnica Mato Lovrak,43290,Grubišno Polje,Ivana Nepomuka Jemeršića 1,knjiznica.gp@gmail.com,jelenabuky@gmail.com,043 485 016,Jelena Ćafor
K-30/3,Gradska knjižnica Slavka Kolara Čazma,43240,Čazma,Ulica Alojza Vulinca 3,slavko.kolar.knjiznica@gmail.com,-,043 771 089,Vinka Jelić-Balta
K-263/6,Gradska knjižnica Ivan Vidali,20260,Korčula,Hrvatske bratske zajednice 15,gradska.knjiznica.ivan.vidali.korcula@du.t-com.hr,-,020 711 974,Milojka Skokandić
K-1421/1,Gradska knjižnica i čitaonica Ilok,32236,Ilok,Trg Nikole Iločkog 2,ravnatelj@knjiznica-ilok.hr,-,032 590 198,Željka Đerić
K-1538/2,Gradska knjižnica Otok,32252,Otok,Trg kralja Tomislava 6/A,knjiznica@otok.hr,marijana.barnjak@gmail.com,032 373 362,Marijana Barnjak Jelić
K-1611/3,Općinska knjižnica Bistra,10298,Bistra,Bistranska 98,knjiznica@bistra.hr,dstudak@yahoo.com,01 339 1702,Danijela Studak Čačić
K-369/1,Gradska knjižnica Zlatar,49250,Zlatar,Zagrebačka 2,info@knjiznica-zlatar.hr,-,049 466 845,Lovorka Puklin
K-929/3,Općinska narodna knjižnica Drenovci,32257,Drenovci,Braće Radića 2,kontakt@knjiznica-drenovci.hr,tenafranic@gmail.com,032 862 882,Tena Franić
K-1423/4,Gradska knjižnica Županja,32270,Županja,Veliki kraj 66.,nikolic.ivana@gkzu.hr,-,032 831 944,Ivana Nikolić
K-1427/1,Gradska knjižnica i čitaonica Petrinja,44250,Petrinja,Matije Gupca 2,ravnatelj@gkc-petrinja.hr,-,044 813 760,Ante Mrgan
K-1586/1,Narodna knjižnica i čitaonica Lipovljani,44322,Lipovljani,Trg hrvatskih branitelja 14,knjiznica.lipovljani@gmail.com,-,044 676 022,Marita Štelma
K-1435/3,Knjižnica i čitaonica Kutina,44320,Kutina,Trg kralja Tomislava 17,suzanaknjiznica@gmail.com,-,044 684 751,Suzana Pomper
K-1470/1,Knjižnica i čitaonica Popovača,44317,Popovača,Trg grofova Erdodyja 7,knjiznica.popovaca@gmail.com,-,044 679 860,Ivana Vlašić
K-26/4,Gradska knjižnica Franjo Marković Križevci,48260,Križevci,Trg sv. Florijana 14,knjiznica-krizevci@kc.t-com.hr,-,048 682 646,Marjana Janeš-Žulj
K-130/2,Knjižnica Centra za kulturu Čepin,31431,Čepin,Kralja Zvonimira 98,knjiznica@czk-cepin.hr,-,031 381 307,Željka Mamić
K-133/4,Gradska knjižnica Beli Manastir,31300,Beli Manastir,K. Tomislava 2,gradska.knjiznica.bm@os.t-com.hr,-,031 710 250,Mersiha Vehabović Štrak
K-134/5,Gradska knjižnica i čitaonica Đakovo,31400,Đakovo,Kralja Tomislava 13,djknjiznica@gmail.com,-,031 812 045,Kristina Podgornik
K-362/3,Općinska knjižnica i čitaonica Bedekovčina,49221,Bedekovčina,Trg Ante Starčevića 3,vsharonja@gmail.com,-,049 213 656,Vesna Šaronja
K-373/3,Gradska knjižnica Krapina,49000,Krapina,Šetalište Hrvatskog narodnog preporoda 1313,info@gkkr.hr,maja.vukina.bogovic@gkkr.hr,049 370 132,Maja Vukina Bogović
K-915/2,Gradska knjižnica Ivana Belostenca Lepoglava,42250,Lepoglava,Hrvatskih pavlina 7,knjiznicalepoglava@gmail.com,margareta.gecek@yahoo.com,042 792 742,Margareta Geček
K-1036/5,Gradska knjižnica Biograd na Moru,23210,Biograd na Moru,Šetalište kneza Branimira 52,info@gkbnm.hr,tihana.jurisic@gkbnm.hr,023 386 487,Tihana Jurišić
K-1326/2,Narodna knjižnica i čitaonica Kutjevo,34340,Kutjevo,Republike Hrvatske 109,narodna.knjiznica.kutjevo@gmail.com,-,034 255 463,Renata Đurak
K-1460/8,Knjižnica i čitaonica Novigrad,23312,Novigrad,Stjepana Radića 1,knjiznica.novigrad@zd.t-com.hr,anabuterin@gmail.com,023 375 093,Ana Vlatković
K-355/2,Hrvatska knjižnica i čitaonica Pleternica,34310,Pleternica,Vinogradska 3,hkcp@hkcp.hr,-,034 251 045,Martina Krpota
K-357/3,Gradska knjižnica Pakrac,34550,Pakrac,Trg dr. Franje Tuđmana 1,knjiznica@pakrac.hr,-,034 411 716,Monika Lucić Fider
K-367/1,Gradska knjižnica i čitaonica Antun Mihanović Klanjec,49290,Klanjec,Trg Antuna Mihanovića 2,gkk@post.t-com.hr,-,049 550 235,Adrijana Čelec
K-372/2,Općinska knjižnica i čitaonica Sveti Križ Začretje,49223,Sveti Križ Začretje,Trg hrvatske kraljice Jelene 2,opcinska.knjiznica.zacretje@kr.t-com.hr,-,049 228 389,Franjo Kučko
K-28/2,Pučka knjižnica i čitaonica Daruvar,43500,Daruvar,Stjepana Radića 5,pkic@bj.t-com.hr,-,043 331 592,Romana Horvat
K-76/3,Gradska knjižnica i čitaonica Metel Ožegović Varaždin,42000,Varaždin,Franjevački trg 4,gknjizmo@vz.t-com.hr,-,042 212 767,Mario Šoštarić
K-374/2,Gradska knjižnica Pregrada,49218,Pregrada,Trg Gospe Kunagorske 3,knjiznica@pregrada.hr,-,049 376 111,Draženka Gretić
K-575/12,Gradska knjižnica i čitaonica Pula,52100,Pula,Sv. Ivana 1A,nadia.buzleta@gkc-pula.hr,tajnica@gkc-pula.hr,052 300 417,Marija Giačić
K-74/4,"Gradska knjižnica i čitaonica ""Gustav Krklec""",42240,Ivanec,Akademika Ladislava Šabana 3,knjiznica.krklec@optinet.hr,marina.grudenic@gmail.com,042 782 165,Marina Grudenić
K-1618/4,Narodna knjižnica i čitaonica u Klisu,21231,Klis,Put svetog Ante 31,knjiznica@knjiznica-klis.hr,-,021 715 087,Lea Smodlaka
K-1646/1,Narodna knjižnica i čitaonica Gunja,32260,Gunja,Vladimira Nazora 113,narodnaknjiznica.gunja@gmail.com,zana.amidzic@gmail.com,032 534 912,Žana Kužet
K-368/2,Gradska knjižnica Ksaver Šandor Gjalski,49210,Zabok,Stjepana Radića 1,knjiznica@knjiznica-zabok.hr,-,049 221 451,Branka Tuđa Kanceljak
K-887/3,Gradska knjižnica Umag,52470,Umag,Trgovačka 6,knjiznica@gku-bcu.hr,neven@gku-bcu.hr,052 721 561,Neven Ušumović
K-257/4,Gradska knjižnica Poreč,52440,Poreč,Trg Marafor 3,gradska@knjiznicaporec.hr,-,052 434 196,Irides Zović
K-530/5,Gradska knjižnica i čitaonica Virovitica,33000,Virovitica,Trg bana J. Jelačića 5,gkc@vt.t-com.hr,-,033 721 940,Robert Fritz
K-261/6,Dubrovačke knjižnice,20000,Dubrovnik,Cvijete Zuzorić 4,dubrovacke-knjiznice@dkd.hr,ivana@dkd.hr,020 324 074,Ivana Burmas
K-529/1,Knjižnica i čitaonica Pitomača,33405,Pitomača,Trg kralja Tomislava 2,knjiznica.pitomaca@vt-t-com.hr,-,033 782 284,Irena Gavrančić
K-1364/6,Gradska knjižnica Solin,21210,Solin,Kralja Zvonimira 117d,info@knjiznicasolin.hr,-,021 213 327,Jurica Benzon
K-1243/3,"Općinska knjižnica ""Hrvatski sastanak 1888.""",21425,Selca,Trg Stjepana Radića 5,knjiznica@selca.hr,-,021 778 188,Ivana Mišetić
K-732/4,Narodna knjižnica Vrbovec,10340,Vrbovec,Trg Petra Zrinskog 7,knjiznica.vrbovec@gmail.com,mateja.hrgovan@gmail.com,01 279 1043,Mateja Hrgovan
K-1430/1,Gradska knjižnica i čitaonica Milivoja Cvetnića Hrvatska Kostajnica,44430,Hrvatska Kostajnica,Vladimira Nazora 17,knjiznicahrvatskakostajnica@gmail.com,-,044 851 833,Petar Samardžija
K-1466/2,Knjižnica Jurja Barakovića Ražanac,23248,Ražanac,Ražanac XI/2,knjiznica.razanac@zd.t-com.hr,-,023 651 457,Andrea Beljo
K-1666,Gradska knjižnica Oroslavje,49243,Oroslavje,Park Vranyczany 1,gkoroslavje@gmail.com,samec.sandra@gmail.com,049 264 199,Sandra Šamec
K-132/4,Gradska knjižnica grada Donjeg Miholjca,31540,Donji Miholjac,Trg Ante Starčevića 22,ravnatelj@gkgdm.hr,-,031 631 746,Marinela Šmider
K-1665,Knjižnica i čitaonica Križ,10314,Križ,Zagrebačka ulica 2,info@kck.hr,sandra.crnkovic@opcina-kriz.hr,01 282 4464,Sandra Crnković
K-555/1,Narodna knjižnica i čitaonica Topusko,-,Topusko,-,opcina-topusko@sk.t-com.hr,-,044 885 369,Slavica Šimić
K-593,Narodna knjižnica i čitaonica Brodski Stupnik,-,Brodski Stupnik,-,-,-,035 427 137,Ankica Madžar
K-636/1,Gradska knjižnica i čitaonica Lipik,-,Lipik,-,grad.lipik1@po.t-com.hr,-,034 421 088,Jasna Molnar – Kukić
K-909,Narodna knjižnica „Petar Preradović“,-,Donji Lapac,-,-,-,053 765 830,Mira Antunović
K-924/1,Hrvatska knjižnica i čitaonica Sali,-,Sali,-,knjiznica-sali1@zd.net.hr,-,023 377 597,Ante Mihić
K-939/3,Gradska knjižnica Crikvenica,-,Crikvenica,-,knjiznica@knjiznica-crikvenica.hr,-,051 243 238,Irena Krmpotić
K-1241/3,Knjižnica i čitaonica Slunj,-,Slunj,-,knjiznica.slunj@gmail.com,-,047 777 324,Nikola Živčić
K-1370/1,Gradska knjižnica Vrlika,-,Vrlika,-,gradska.knjiznica.vrlika@st.t-com.hr,-,021 827 333,Anica Boduljak
K-1407,Knjižnica i čitaonica Šenkovec,-,Šenkovec,-,knjiznica-citaonica-senkovec@htnet.hr,-,040 343 750,Božica Mezga
K-1410/1,Knjižnica i čitaonica Kotoriba,-,Kotoriba,-,-,-,040 682 887,Bernarda Habuš
K-1429,Narodna knjižnica „Ivo Kozarčanin“ Hrvatska Dubica,-,Hrvatska Dubica,-,narodna@globalnet.hr,-,044 855 411,Marija Pranjić
K-1459/14,"Općinska knjižnica Sidonije Rubido Erdödy, Gornja Rijeka",-,Gornja Rijeka,-,opcinska.knjiznica.s.r.erdödy@kc.t-com.hr,-,048 855 370,Ivana Habijan
K-1467/1,Narodna knjižnica i čitaonica Sunja,-,Sunja,-,-,-,044 833 058,Jasmina Lađević
K-1471,Hrvatska čitaonica Vrpolje,-,Vrpolje,-,opcina.vrpolje@sb.t-com.hr,-,035 439 109,-
K-1571,Knjižnica i čitaonica Goričan,-,Goričan,-,knjiznica@gorican.hr,-,-,Jadranka Ivanović
K-1581/1,Gradska knjižnica Trilj,-,Trilj,-,gradska.knjiznica.trilj@st.t-com.hr,-,021 831 454,Stipe Roguljić
K-1625/1,Općinska knjižnica Ante Kovačića,-,Marija Gorica,-,-,-,091 551 4337,Mirko Škoc
K-1/1,Narodna knjižnica Orebić,-,Orebić,-,narodna-knjiznica-orebic@du.htnet.hr,-,020 713 683,Nataša Tolj
K-25/6,Gradska knjižnica Đurđevac,-,Đurđevac,-,gradska.knjiznica@djurdjevac.hr,-,048 812 701,Bernarda Ferderber
K-31/1,"Hrvatska knjižnica ""Đuro Sudeta"" Garešnica",-,Garešnica,-,citaonica-garesnica@bj.hinet.hr,-,043 531 232,Maja Dizdarević
K-72/5,Gradska knjižnica i čitaonica Novi Marof,-,Novi Marof,-,gknm@gknm.hr,-,042 611 234,Nadica Rain
K-131/2,Hrvatska knjižnica i čitaonica Đurđenovac,-,Đurđenovac,-,knjiznicadj@net.hr,-,031 602 692,Ružica Pavlić
K-247/1,Samostalna narodna knjižnica Gospić,-,Gospić,-,knjiznica.gospic@gs.t-com.hr,-,053 575 056,Milan Šarić
K-301/2,Narodna knjižnica Buzet,-,Buzet,-,pucko-otvoreno-uciliste@pu.t-com.hr,-,052 662 836,Mirjana Pavletić
K-363,Općinska knjižnica i čitaonica Veliko Trgovišće,-,Veliko Trgovišće,-,-,-,049 236 424,Nenad Dominić
K-466/2,Gradska knjižnica Slavonski Brod,-,Slavonski Brod,-,gksb@gksb.hr,-,035 466 963,Ružica Bobovečki`;

function parseCSV(csv: string) {
  const lines = csv.split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    // Simple split won't work for quoted fields, but let's try a regex for CSV
    const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
    const obj: any = {};
    parts.forEach((p, i) => {
      let val = p.trim().replace(/^"|"$/g, '');
      if (val === '-') val = '';
      obj[headers[i]] = val;
    });
    return obj;
  });
}

export async function seedExternalLibraries() {
  const libraries = parseCSV(rawData);
  console.log(`Parsed ${libraries.length} libraries.`);
  
  for (const lib of libraries) {
    const data = {
      k_kod: lib['K-kod'] || '',
      naziv: lib['Naziv ustanove'] || '',
      postanski_broj: lib['Poštanski broj'] || '',
      mjesto: lib['Mjesto'] || '',
      adresa: lib['Adresa'] || '',
      email_sluzbeni: lib['E-mail (službeni)'] || '',
      email_direktni: lib['E-mail (direktni)'] || '',
      telefon: lib['Telefon'] || '',
      odgovorna_osoba: lib['Odgovorna osoba'] || ''
    };
    
    if (data.naziv) {
      try {
        ExternalLibrariesDB.insert(data);
      } catch (e) {
        console.error(`Error inserting ${data.naziv}:`, e);
      }
    }
  }
  console.log('Seeding finished.');
}
