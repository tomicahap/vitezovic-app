// Sveobuhvatna baza hrvatskih gradova, većih općina i čestih mjesta gostovanja
// s točnim geografskim koordinatama [lat, lon] i prepoznavanjem padeža / ustanova.

export const CROATIA_CITIES: Record<string, [number, number]> = {
  // Svi službeni gradovi u Republici Hrvatskoj (128) + važna mjesta
  "Zagreb": [45.8150, 15.9819],
  "Split": [43.5081, 16.4402],
  "Rijeka": [45.3271, 14.4422],
  "Osijek": [45.5550, 18.6955],
  "Zadar": [44.1194, 15.2314],
  "Velika Gorica": [45.7144, 16.0740],
  "Slavonski Brod": [45.1631, 18.0116],
  "Pula": [44.8683, 13.8481],
  "Karlovac": [45.4929, 15.5553],
  "Sisak": [45.4851, 16.3778],
  "Varaždin": [46.3044, 16.3378],
  "Šibenik": [43.7322, 15.8943],
  "Dubrovnik": [42.6507, 18.0944],
  "Bjelovar": [45.8988, 16.8423],
  "Kaštela": [43.5531, 16.3769],
  "Samobor": [45.8011, 15.7142],
  "Vinkovci": [45.2890, 18.8043],
  "Koprivnica": [46.1628, 16.8275],
  "Đakovo": [45.3090, 18.4116],
  "Vukovar": [45.3435, 18.9998],
  "Čakovec": [46.3844, 16.4336],
  "Požega": [45.3403, 17.6853],
  "Zaprešić": [45.8569, 15.8042],
  "Sinj": [43.7031, 16.6394],
  "Petrinja": [45.4372, 16.2783],
  "Solin": [43.5419, 16.4919],
  "Kutina": [45.4792, 16.7769],
  "Virovitica": [45.8319, 17.3839],
  "Križevci": [46.0272, 16.5433],
  "Sveta Nedelja": [45.7969, 15.7772],
  "Dugo Selo": [45.8058, 16.2419],
  "Metković": [43.0539, 17.6483],
  "Poreč": [45.2272, 13.5956],
  "Našice": [45.4886, 18.0878],
  "Jastrebarsko": [45.6692, 15.6517],
  "Županja": [45.0736, 18.6967],
  "Sveti Ivan Zelina": [45.9597, 16.2431],
  "Nova Gradiška": [45.2547, 17.3828],
  "Makarska": [43.2936, 17.0197],
  "Knin": [44.0408, 16.1964],
  "Vrbovec": [45.8839, 16.4167],
  "Rovinj": [45.0811, 13.6386],
  "Ivanić-Grad": [45.7069, 16.3944],
  "Ogulin": [45.2678, 15.2281],
  "Trogir": [43.5169, 16.2500],
  "Slatina": [45.7033, 17.7028],
  "Novska": [45.3406, 16.9769],
  "Daruvar": [45.5906, 17.2250],
  "Omiš": [43.4447, 16.6886],
  "Gospić": [44.5461, 15.3746],
  "Krapina": [46.1608, 15.8753],
  "Umag": [45.4314, 13.5239],
  "Labin": [45.0950, 14.1228],
  "Beli Manastir": [45.7700, 18.6033],
  "Valpovo": [45.6608, 18.4186],
  "Crikvenica": [45.1769, 14.6922],
  "Đurđevac": [46.0408, 17.0717],
  "Belišće": [45.6856, 18.4044],
  "Garešnica": [45.5744, 16.9414],
  "Ploče": [43.0522, 17.4322],
  "Buzet": [45.4094, 13.9667],
  "Otočac": [44.8694, 15.2375],
  "Donji Miholjac": [45.7608, 18.1672],
  "Trilj": [43.6175, 16.7244],
  "Glina": [45.3381, 16.0881],
  "Zabok": [46.0294, 15.9089],
  "Vodice": [43.7608, 15.7789],
  "Pazin": [45.2403, 13.9350],
  "Pakrac": [45.4369, 17.1908],
  "Lipik": [45.4144, 17.1578],
  "Ludbreg": [46.2519, 16.6147],
  "Lepoglava": [46.2106, 16.0358],
  "Ivanec": [46.2231, 16.1253],
  "Novi Marof": [46.1669, 16.3350],
  "Varaždinske Toplice": [46.2089, 16.4197],
  "Prelog": [46.3350, 16.6156],
  "Mursko Središće": [46.5094, 16.4411],
  "Čazma": [45.7483, 16.6139],
  "Grubišno Polje": [45.7022, 17.1728],
  "Kutjevo": [45.4261, 17.8825],
  "Pleternica": [45.2886, 17.8064],
  "Orahovica": [45.5400, 17.8847],
  "Ilok": [45.2225, 19.3772],
  "Otok": [45.1467, 18.8839],
  "Hrvatska Kostajnica": [45.2292, 16.5392],
  "Popovača": [45.5686, 16.6250],
  "Duga Resa": [45.4461, 15.4978],
  "Ozalj": [45.6139, 15.4789],
  "Slunj": [45.1150, 15.5856],
  "Zlatar": [46.0942, 16.0708],
  "Donja Stubica": [45.9800, 15.9708],
  "Stubičke Toplice": [45.9756, 15.9325],
  "Krapinske Toplice": [46.0919, 15.8419],
  "Oroslavje": [46.0003, 15.9136],
  "Pregrada": [46.1636, 15.7508],
  "Klanjec": [46.0511, 15.7444],
  "Opatija": [45.3376, 14.3052],
  "Kastav": [45.3761, 14.3486],
  "Bakar": [45.3072, 14.5333],
  "Kraljevica": [45.2719, 14.5689],
  "Novi Vinodolski": [45.1281, 14.7889],
  "Senj": [44.9894, 14.9036],
  "Novalja": [44.5567, 14.8867],
  "Pag": [44.4439, 15.0558],
  "Krk": [45.0258, 14.5753],
  "Cres": [44.9603, 14.4081],
  "Mali Lošinj": [44.5306, 14.4686],
  "Rab": [44.7569, 14.7600],
  "Delnice": [45.3986, 14.8022],
  "Vrbovsko": [45.3736, 15.0783],
  "Čabar": [45.5978, 14.6464],
  "Buje": [45.4100, 13.6606],
  "Novigrad": [45.3150, 13.5581],
  "Vodnjan": [44.9600, 13.8519],
  "Biograd na Moru": [43.9433, 15.4519],
  "Benkovac": [44.0344, 15.6128],
  "Nin": [44.2414, 15.1783],
  "Obrovac": [44.2008, 15.6822],
  "Drniš": [43.8625, 16.1556],
  "Skradin": [43.8178, 15.9233],
  "Imotski": [43.4472, 17.2139],
  "Vrgorac": [43.2053, 17.3711],
  "Vrlika": [43.9111, 16.3983],
  "Supetar": [43.3842, 16.5553],
  "Hvar": [43.1725, 16.4411],
  "Stari Grad": [43.1842, 16.5950],
  "Vis": [43.0614, 16.1836],
  "Komiža": [43.0442, 16.0911],
  "Korčula": [42.9597, 17.1358],
  "Opuzen": [43.0169, 17.5656],
  "Cavtat": [42.5811, 18.2181],
  "Ston": [42.8386, 17.6964],
  "Orebić": [42.9761, 17.1753],
  // Česta mjesta gostovanja u susjednim državama
  "Mostar": [43.3438, 17.8078],
  "Sarajevo": [43.8563, 18.4131],
  "Banja Luka": [44.7722, 17.1910],
  "Široki Brijeg": [43.3828, 17.5942],
  "Ljubuški": [43.1969, 17.5450],
  "Livno": [43.8269, 17.0078],
  "Tomislavgrad": [43.7186, 17.2267],
  "Travnik": [44.2264, 17.6658],
  "Tuzla": [44.5384, 18.6763],
  "Subotica": [46.1003, 19.6676],
  "Sombor": [45.7742, 19.1122],
  "Tavankut": [46.0442, 19.4889],
  "Novi Sad": [45.2671, 19.8335],
  "Beograd": [44.7866, 20.4489],
  "Pečuh": [46.0727, 18.2323],
  "Budimpešta": [47.4979, 19.0402],
  "Ljubljana": [46.0569, 14.5058],
  "Maribor": [46.5547, 15.6459],
  "Beč": [48.2082, 16.3738],
  "Željezno": [47.8456, 16.5236],
  "Trst": [45.6495, 13.7768],
  "Kotor": [42.4247, 18.7712],
  "Tivat": [42.4319, 18.6983],
}

export const CROATIA_CITY_NAMES: string[] = Object.keys(CROATIA_CITIES).sort((a, b) =>
  a.localeCompare(b, "hr")
)

// Poznate ustanove, dvorane i ulice koje jednoznačno određuju grad
const KNOWN_VENUE_TO_CITY: Array<{ match: string; city: string }> = [
  { match: "hrvatski državni arhiv", city: "Zagreb" },
  { match: "marulićev trg", city: "Zagreb" },
  { match: "bogdana ogrizovića", city: "Zagreb" },
  { match: "bogdan ogrizović", city: "Zagreb" },
  { match: "preradovićeva", city: "Zagreb" },
  { match: "matica hrvatska, strossmayerov", city: "Zagreb" },
  { match: "strossmayerov trg", city: "Zagreb" },
  { match: "dvorana jure petričevića", city: "Zagreb" },
  { match: "nacionalna i sveučilišna", city: "Zagreb" },
  { match: "hrvatske bratske zajednice", city: "Zagreb" },
  { match: "kulturni centar travno", city: "Zagreb" },
  { match: "kc travno", city: "Zagreb" },
  { match: "klovićevi dvori", city: "Zagreb" },
  { match: "muzej za umjetnost i obrt", city: "Zagreb" },
  { match: "muzej grada zagreba", city: "Zagreb" },
  { match: "opatovina", city: "Zagreb" },
  { match: "kaptol", city: "Zagreb" },
  { match: "hazu", city: "Zagreb" },
  { match: "društvo zagrepčana", city: "Zagreb" },
  { match: "šetalište franje lučića", city: "Velika Gorica" },
  { match: "muzej turopolja", city: "Velika Gorica" },
  { match: "spahijski podrum", city: "Pakrac" },
]

// Padežni korijeni za višerječne i nepravilne gradove (lokativ, genitiv, akuzativ)
const IRREGULAR_CITY_PATTERNS: Array<{ pattern: RegExp; city: string }> = [
  { pattern: /\bvelik(a|oj|e|u)\s+goric(a|i|e|u)\b/i, city: "Velika Gorica" },
  { pattern: /\bslavonsk(i|om|og)\s+brod(u|a)?\b/i, city: "Slavonski Brod" },
  { pattern: /\bnov(a|oj|e|u)\s+gradišk(a|i|oj|e|u)\b/i, city: "Nova Gradiška" },
  { pattern: /\bsvet(a|oj|e|u)\s+nedelj(a|i|e|u)\b/i, city: "Sveta Nedelja" },
  { pattern: /\bdug(o|om|og)\s+sel(o|u|a)\b/i, city: "Dugo Selo" },
  { pattern: /\bsvet(i|om|og)\s+ivan(u|a)?\s+zelin(a|i|e|u)\b/i, city: "Sveti Ivan Zelina" },
  { pattern: /\bivanić[\s-]grad(u|a)?\b/i, city: "Ivanić-Grad" },
  { pattern: /\bbel(i|om|og)\s+manastir(u|a)?\b/i, city: "Beli Manastir" },
  { pattern: /\bdonj(i|em|eg)\s+miholj(ac|cu|ca)\b/i, city: "Donji Miholjac" },
  { pattern: /\bmursk(o|om|og)\s+središć(e|u|a)\b/i, city: "Mursko Središće" },
  { pattern: /\bgrubišn(o|om|og)\s+polj(e|u|a)\b/i, city: "Grubišno Polje" },
  { pattern: /\bhrvatsk(a|oj|e|u)\s+kostajnic(a|i|e|u)\b/i, city: "Hrvatska Kostajnica" },
  { pattern: /\bdug(a|oj|e|u)\s+res(a|i|e|u)\b/i, city: "Duga Resa" },
  { pattern: /\bdonj(a|oj|e|u)\s+stubic(a|i|e|u)\b/i, city: "Donja Stubica" },
  { pattern: /\bstubičk(e|im)\s+toplic(e|ama)\b/i, city: "Stubičke Toplice" },
  { pattern: /\bkrapinsk(e|im)\s+toplic(e|ama)\b/i, city: "Krapinske Toplice" },
  { pattern: /\bvaraždinsk(e|im)\s+toplic(e|ama)\b/i, city: "Varaždinske Toplice" },
  { pattern: /\bnov(i|om|og)\s+marof(u|a)?\b/i, city: "Novi Marof" },
  { pattern: /\bnov(i|om|og)\s+vinodolsk(i|om|og)\b/i, city: "Novi Vinodolski" },
  { pattern: /\bmal(i|om|og)\s+lošinj(u|a)?\b/i, city: "Mali Lošinj" },
  { pattern: /\bbiograd(u|a)?\s+na\s+moru\b/i, city: "Biograd na Moru" },
  { pattern: /\bstar(i|om|og)\s+grad(u|a)?\b/i, city: "Stari Grad" },
  { pattern: /\bširok(i|om|og)\s+brijeg(u|a)?\b/i, city: "Široki Brijeg" },
  { pattern: /\bbanj(a|oj)\s+lu(ka|ci)\b/i, city: "Banja Luka" },
  { pattern: /\bnov(i|om|og)\s+sad(u|a)?\b/i, city: "Novi Sad" },
  { pattern: /\brijec(i|u)|rijek(a|e|u)\b/i, city: "Rijeka" },
  { pattern: /\bpožeg(a|i|e|u)\b/i, city: "Požega" },
  { pattern: /\bkriževc(i|ima|a)\b/i, city: "Križevci" },
  { pattern: /\bvinkovc(i|ima|a)\b/i, city: "Vinkovci" },
  { pattern: /\bčakov(ec|cu|ca)\b/i, city: "Čakovec" },
  { pattern: /\bđurđev(ac|cu|ca)\b/i, city: "Đurđevac" },
  { pattern: /\botoč(ac|cu|ca)\b/i, city: "Otočac" },
  { pattern: /\bvrbov(ec|cu|ca)\b/i, city: "Vrbovec" },
  { pattern: /\bivan(ec|cu|ca)\b/i, city: "Ivanec" },
  { pattern: /\bklanj(ec|cu|ca)\b/i, city: "Klanjec" },
  { pattern: /\boz(alj|lju|lja)\b/i, city: "Ozalj" },
  { pattern: /\bsis(ak|ku|ka)\b/i, city: "Sisak" },
  { pattern: /\bpetrinj(a|i|e|u)\b/i, city: "Petrinja" },
  { pattern: /\bvirovitic(a|i|e|u)\b/i, city: "Virovitica" },
  { pattern: /\bkoprivnic(a|i|e|u)\b/i, city: "Koprivnica" },
  { pattern: /\bmakarsk(a|oj|e|u)\b/i, city: "Makarska" },
  { pattern: /\bcrikvenic(a|i|e|u)\b/i, city: "Crikvenica" },
  { pattern: /\bkraljevic(a|i|e|u)\b/i, city: "Kraljevica" },
  { pattern: /\bgarešnic(a|i|e|u)\b/i, city: "Garešnica" },
  { pattern: /\borahovic(a|i|e|u)\b/i, city: "Orahovica" },
  { pattern: /\bpleternic(a|i|e|u)\b/i, city: "Pleternica" },
  { pattern: /\bsubotic(a|i|e|u)\b/i, city: "Subotica" },
  { pattern: /\bnovsk(a|oj|e|u)\b/i, city: "Novska" },
]

/**
 * Pokušava iz zadanog teksta (lokacija ili naslov) prepoznati grad iz CROATIA_CITIES.
 */
export function matchCityInText(rawText?: string | null): string | null {
  if (!rawText) return null
  const text = rawText.trim()
  if (!text) return null

  const lower = text.toLowerCase()

  // 1. Izravno poklapanje punog naziva grada
  for (const city of Object.keys(CROATIA_CITIES)) {
    if (city.toLowerCase() === lower) {
      return city
    }
  }

  // 2. Provjera nepravilnih i višerječnih padeža
  for (const { pattern, city } of IRREGULAR_CITY_PATTERNS) {
    if (pattern.test(text)) {
      return city
    }
  }

  // 3. Provjera poznatih dvorana, arhiva i ulica
  for (const { match, city } of KNOWN_VENUE_TO_CITY) {
    if (lower.includes(match)) {
      return city
    }
  }

  // 4. Provjera sadrži li tekst naziv grada ili njegov standardni padežni oblik
  // Sortiramo od duljih naziva prema kraćima kako bi npr. "Velika Gorica" imala prednost pred kraćim podstringom
  const sortedCities = Object.keys(CROATIA_CITIES).sort((a, b) => b.length - a.length)
  for (const city of sortedCities) {
    const cLower = city.toLowerCase()
    const escaped = cLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    // Nominativ ili standardni padežni nastavci (-u, -a, -om, -em, -i, -e, -ama, -ima)
    const directRegex = new RegExp(`(^|[^a-zčćžšđ])${escaped}(u|a|om|em|i|e|ama|ima)?($|[^a-zčćžšđ])`, "i")
    if (directRegex.test(text)) {
      return city
    }

    // Za imenice ženskog roda na -a (npr. Kutina -> Kutini, Slatina -> Slatini, Krapina -> Krapini, Pula -> Puli)
    if (cLower.endsWith("a") && cLower.length >= 4) {
      const stem = cLower.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const femRegex = new RegExp(`(^|[^a-zčćžšđ])${stem}(a|i|e|u|om|oj)($|[^a-zčćžšđ])`, "i")
      if (femRegex.test(text)) {
        return city
      }
    }
  }

  return null
}

/**
 * Vraća prepoznati grad za obrazac (iz lokacije ili naslova).
 */
export function inferCityFromLocationOrTitle(location?: string | null, title?: string | null): string {
  return matchCityInText(location) || matchCityInText(title) || ""
}

/**
 * Za zadano predavanje određuje:
 * - city: kanonski naziv grada (iz polja city, location ili title)
 * - coords: [lat, lon] ako su poznate u CROATIA_CITIES
 * - isOnline: je li riječ o online predavanju (Meet / Zoom / Online)
 */
export function resolveLectureCityAndCoords(lecture: {
  city?: string | null
  location?: string | null
  title?: string | null
}): {
  city: string | null
  coords: [number, number] | null
  isOnline: boolean
} {
  const locStr = (lecture.location || "").trim()
  const cityStr = (lecture.city || "").trim()
  const titleStr = (lecture.title || "").trim()

  const isOnline =
    /\b(online|google\s*meet|zoom|teams|webinar)\b/i.test(locStr) ||
    /\b(online|google\s*meet|zoom|teams|webinar)\b/i.test(cityStr)

  // 1. Prvo provjeri eksplicitno polje city
  if (cityStr) {
    const matchedFromCity = matchCityInText(cityStr)
    if (matchedFromCity && CROATIA_CITIES[matchedFromCity]) {
      return {
        city: matchedFromCity,
        coords: CROATIA_CITIES[matchedFromCity],
        isOnline: false,
      }
    }
  }

  // 2. Zatim provjeri polje location
  if (locStr) {
    const matchedFromLoc = matchCityInText(locStr)
    if (matchedFromLoc && CROATIA_CITIES[matchedFromLoc]) {
      return {
        city: matchedFromLoc,
        coords: CROATIA_CITIES[matchedFromLoc],
        isOnline: false,
      }
    }
  }

  // 3. Zatim provjeri naslov predavanja (title)
  if (titleStr) {
    const matchedFromTitle = matchCityInText(titleStr)
    if (matchedFromTitle && CROATIA_CITIES[matchedFromTitle]) {
      return {
        city: matchedFromTitle,
        coords: CROATIA_CITIES[matchedFromTitle],
        isOnline: false,
      }
    }
  }

  // 4. Ako je korisnik ručno upisao strano mjesto u city ili location koje nije u CROATIA_CITIES
  const fallbackCity = cityStr || locStr || null
  return {
    city: fallbackCity,
    coords: null,
    isOnline,
  }
}
