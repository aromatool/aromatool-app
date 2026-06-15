// ============================================================
// ȚĂRI — sursă unică pentru selectorul de țară și prefixul de
// telefon. Steagul se calculează din codul ISO2 (regional
// indicators), deci nu stocăm emoji în date.
// ============================================================

export interface Country {
  code: string; // ISO 3166-1 alpha-2 (ex: "RO")
  name: string; // nume în română
  nameEn: string; // nume în engleză (pentru căutare / UI EN)
  dial: string; // prefix telefonic E.164 (ex: "+40")
}

// Steag emoji din codul ISO2 (ex: "RO" → 🇷🇴).
export function flagOf(code: string): string {
  if (!code || code.length !== 2) return "🏳️";
  const base = 0x1f1e6;
  const A = "A".charCodeAt(0);
  return String.fromCodePoint(
    base + (code.charCodeAt(0) - A),
    base + (code.charCodeAt(1) - A),
  );
}

// Listă completă (alfabetic după nume RO). Țări + teritorii uzuale.
export const COUNTRIES: Country[] = [
  { code: "AF", name: "Afganistan", nameEn: "Afghanistan", dial: "+93" },
  { code: "ZA", name: "Africa de Sud", nameEn: "South Africa", dial: "+27" },
  { code: "AL", name: "Albania", nameEn: "Albania", dial: "+355" },
  { code: "DZ", name: "Algeria", nameEn: "Algeria", dial: "+213" },
  { code: "AD", name: "Andorra", nameEn: "Andorra", dial: "+376" },
  { code: "AO", name: "Angola", nameEn: "Angola", dial: "+244" },
  { code: "AI", name: "Anguilla", nameEn: "Anguilla", dial: "+1264" },
  { code: "AG", name: "Antigua și Barbuda", nameEn: "Antigua and Barbuda", dial: "+1268" },
  { code: "SA", name: "Arabia Saudită", nameEn: "Saudi Arabia", dial: "+966" },
  { code: "AR", name: "Argentina", nameEn: "Argentina", dial: "+54" },
  { code: "AM", name: "Armenia", nameEn: "Armenia", dial: "+374" },
  { code: "AW", name: "Aruba", nameEn: "Aruba", dial: "+297" },
  { code: "AU", name: "Australia", nameEn: "Australia", dial: "+61" },
  { code: "AT", name: "Austria", nameEn: "Austria", dial: "+43" },
  { code: "AZ", name: "Azerbaidjan", nameEn: "Azerbaijan", dial: "+994" },
  { code: "BS", name: "Bahamas", nameEn: "Bahamas", dial: "+1242" },
  { code: "BH", name: "Bahrain", nameEn: "Bahrain", dial: "+973" },
  { code: "BD", name: "Bangladesh", nameEn: "Bangladesh", dial: "+880" },
  { code: "BB", name: "Barbados", nameEn: "Barbados", dial: "+1246" },
  { code: "BE", name: "Belgia", nameEn: "Belgium", dial: "+32" },
  { code: "BZ", name: "Belize", nameEn: "Belize", dial: "+501" },
  { code: "BJ", name: "Benin", nameEn: "Benin", dial: "+229" },
  { code: "BM", name: "Bermuda", nameEn: "Bermuda", dial: "+1441" },
  { code: "BY", name: "Belarus", nameEn: "Belarus", dial: "+375" },
  { code: "BO", name: "Bolivia", nameEn: "Bolivia", dial: "+591" },
  { code: "BA", name: "Bosnia și Herțegovina", nameEn: "Bosnia and Herzegovina", dial: "+387" },
  { code: "BW", name: "Botswana", nameEn: "Botswana", dial: "+267" },
  { code: "BR", name: "Brazilia", nameEn: "Brazil", dial: "+55" },
  { code: "BN", name: "Brunei", nameEn: "Brunei", dial: "+673" },
  { code: "BG", name: "Bulgaria", nameEn: "Bulgaria", dial: "+359" },
  { code: "BF", name: "Burkina Faso", nameEn: "Burkina Faso", dial: "+226" },
  { code: "BI", name: "Burundi", nameEn: "Burundi", dial: "+257" },
  { code: "KH", name: "Cambodgia", nameEn: "Cambodia", dial: "+855" },
  { code: "CM", name: "Camerun", nameEn: "Cameroon", dial: "+237" },
  { code: "CA", name: "Canada", nameEn: "Canada", dial: "+1" },
  { code: "CV", name: "Capul Verde", nameEn: "Cape Verde", dial: "+238" },
  { code: "CZ", name: "Cehia", nameEn: "Czechia", dial: "+420" },
  { code: "CL", name: "Chile", nameEn: "Chile", dial: "+56" },
  { code: "CN", name: "China", nameEn: "China", dial: "+86" },
  { code: "CY", name: "Cipru", nameEn: "Cyprus", dial: "+357" },
  { code: "CO", name: "Columbia", nameEn: "Colombia", dial: "+57" },
  { code: "KM", name: "Comore", nameEn: "Comoros", dial: "+269" },
  { code: "CG", name: "Congo", nameEn: "Congo", dial: "+242" },
  { code: "CD", name: "Congo (RD)", nameEn: "Congo (DRC)", dial: "+243" },
  { code: "KR", name: "Coreea de Sud", nameEn: "South Korea", dial: "+82" },
  { code: "KP", name: "Coreea de Nord", nameEn: "North Korea", dial: "+850" },
  { code: "CR", name: "Costa Rica", nameEn: "Costa Rica", dial: "+506" },
  { code: "CI", name: "Coasta de Fildeș", nameEn: "Ivory Coast", dial: "+225" },
  { code: "HR", name: "Croația", nameEn: "Croatia", dial: "+385" },
  { code: "CU", name: "Cuba", nameEn: "Cuba", dial: "+53" },
  { code: "CW", name: "Curaçao", nameEn: "Curaçao", dial: "+599" },
  { code: "DK", name: "Danemarca", nameEn: "Denmark", dial: "+45" },
  { code: "DJ", name: "Djibouti", nameEn: "Djibouti", dial: "+253" },
  { code: "DM", name: "Dominica", nameEn: "Dominica", dial: "+1767" },
  { code: "DO", name: "Republica Dominicană", nameEn: "Dominican Republic", dial: "+1809" },
  { code: "EG", name: "Egipt", nameEn: "Egypt", dial: "+20" },
  { code: "SV", name: "El Salvador", nameEn: "El Salvador", dial: "+503" },
  { code: "CH", name: "Elveția", nameEn: "Switzerland", dial: "+41" },
  { code: "AE", name: "Emiratele Arabe Unite", nameEn: "United Arab Emirates", dial: "+971" },
  { code: "EC", name: "Ecuador", nameEn: "Ecuador", dial: "+593" },
  { code: "ER", name: "Eritreea", nameEn: "Eritrea", dial: "+291" },
  { code: "EE", name: "Estonia", nameEn: "Estonia", dial: "+372" },
  { code: "ET", name: "Etiopia", nameEn: "Ethiopia", dial: "+251" },
  { code: "FJ", name: "Fiji", nameEn: "Fiji", dial: "+679" },
  { code: "PH", name: "Filipine", nameEn: "Philippines", dial: "+63" },
  { code: "FI", name: "Finlanda", nameEn: "Finland", dial: "+358" },
  { code: "FR", name: "Franța", nameEn: "France", dial: "+33" },
  { code: "GA", name: "Gabon", nameEn: "Gabon", dial: "+241" },
  { code: "GM", name: "Gambia", nameEn: "Gambia", dial: "+220" },
  { code: "GE", name: "Georgia", nameEn: "Georgia", dial: "+995" },
  { code: "DE", name: "Germania", nameEn: "Germany", dial: "+49" },
  { code: "GH", name: "Ghana", nameEn: "Ghana", dial: "+233" },
  { code: "GI", name: "Gibraltar", nameEn: "Gibraltar", dial: "+350" },
  { code: "GR", name: "Grecia", nameEn: "Greece", dial: "+30" },
  { code: "GD", name: "Grenada", nameEn: "Grenada", dial: "+1473" },
  { code: "GL", name: "Groenlanda", nameEn: "Greenland", dial: "+299" },
  { code: "GP", name: "Guadelupa", nameEn: "Guadeloupe", dial: "+590" },
  { code: "GU", name: "Guam", nameEn: "Guam", dial: "+1671" },
  { code: "GT", name: "Guatemala", nameEn: "Guatemala", dial: "+502" },
  { code: "GG", name: "Guernsey", nameEn: "Guernsey", dial: "+44" },
  { code: "GN", name: "Guineea", nameEn: "Guinea", dial: "+224" },
  { code: "GW", name: "Guineea-Bissau", nameEn: "Guinea-Bissau", dial: "+245" },
  { code: "GQ", name: "Guineea Ecuatorială", nameEn: "Equatorial Guinea", dial: "+240" },
  { code: "GY", name: "Guyana", nameEn: "Guyana", dial: "+592" },
  { code: "HT", name: "Haiti", nameEn: "Haiti", dial: "+509" },
  { code: "HN", name: "Honduras", nameEn: "Honduras", dial: "+504" },
  { code: "HK", name: "Hong Kong", nameEn: "Hong Kong", dial: "+852" },
  { code: "IN", name: "India", nameEn: "India", dial: "+91" },
  { code: "ID", name: "Indonezia", nameEn: "Indonesia", dial: "+62" },
  { code: "JO", name: "Iordania", nameEn: "Jordan", dial: "+962" },
  { code: "IQ", name: "Irak", nameEn: "Iraq", dial: "+964" },
  { code: "IR", name: "Iran", nameEn: "Iran", dial: "+98" },
  { code: "IE", name: "Irlanda", nameEn: "Ireland", dial: "+353" },
  { code: "IS", name: "Islanda", nameEn: "Iceland", dial: "+354" },
  { code: "IL", name: "Israel", nameEn: "Israel", dial: "+972" },
  { code: "IT", name: "Italia", nameEn: "Italy", dial: "+39" },
  { code: "JM", name: "Jamaica", nameEn: "Jamaica", dial: "+1876" },
  { code: "JP", name: "Japonia", nameEn: "Japan", dial: "+81" },
  { code: "JE", name: "Jersey", nameEn: "Jersey", dial: "+44" },
  { code: "KZ", name: "Kazahstan", nameEn: "Kazakhstan", dial: "+7" },
  { code: "KE", name: "Kenya", nameEn: "Kenya", dial: "+254" },
  { code: "KG", name: "Kârgâzstan", nameEn: "Kyrgyzstan", dial: "+996" },
  { code: "KI", name: "Kiribati", nameEn: "Kiribati", dial: "+686" },
  { code: "KW", name: "Kuwait", nameEn: "Kuwait", dial: "+965" },
  { code: "LA", name: "Laos", nameEn: "Laos", dial: "+856" },
  { code: "LS", name: "Lesotho", nameEn: "Lesotho", dial: "+266" },
  { code: "LV", name: "Letonia", nameEn: "Latvia", dial: "+371" },
  { code: "LB", name: "Liban", nameEn: "Lebanon", dial: "+961" },
  { code: "LR", name: "Liberia", nameEn: "Liberia", dial: "+231" },
  { code: "LY", name: "Libia", nameEn: "Libya", dial: "+218" },
  { code: "LI", name: "Liechtenstein", nameEn: "Liechtenstein", dial: "+423" },
  { code: "LT", name: "Lituania", nameEn: "Lithuania", dial: "+370" },
  { code: "LU", name: "Luxemburg", nameEn: "Luxembourg", dial: "+352" },
  { code: "MO", name: "Macao", nameEn: "Macao", dial: "+853" },
  { code: "MK", name: "Macedonia de Nord", nameEn: "North Macedonia", dial: "+389" },
  { code: "MG", name: "Madagascar", nameEn: "Madagascar", dial: "+261" },
  { code: "MY", name: "Malaysia", nameEn: "Malaysia", dial: "+60" },
  { code: "MW", name: "Malawi", nameEn: "Malawi", dial: "+265" },
  { code: "MV", name: "Maldive", nameEn: "Maldives", dial: "+960" },
  { code: "ML", name: "Mali", nameEn: "Mali", dial: "+223" },
  { code: "MT", name: "Malta", nameEn: "Malta", dial: "+356" },
  { code: "MA", name: "Maroc", nameEn: "Morocco", dial: "+212" },
  { code: "MH", name: "Insulele Marshall", nameEn: "Marshall Islands", dial: "+692" },
  { code: "MQ", name: "Martinica", nameEn: "Martinique", dial: "+596" },
  { code: "MU", name: "Mauritius", nameEn: "Mauritius", dial: "+230" },
  { code: "MR", name: "Mauritania", nameEn: "Mauritania", dial: "+222" },
  { code: "MX", name: "Mexic", nameEn: "Mexico", dial: "+52" },
  { code: "FM", name: "Micronezia", nameEn: "Micronesia", dial: "+691" },
  { code: "MD", name: "Moldova", nameEn: "Moldova", dial: "+373" },
  { code: "MC", name: "Monaco", nameEn: "Monaco", dial: "+377" },
  { code: "MN", name: "Mongolia", nameEn: "Mongolia", dial: "+976" },
  { code: "ME", name: "Muntenegru", nameEn: "Montenegro", dial: "+382" },
  { code: "MS", name: "Montserrat", nameEn: "Montserrat", dial: "+1664" },
  { code: "MZ", name: "Mozambic", nameEn: "Mozambique", dial: "+258" },
  { code: "MM", name: "Myanmar", nameEn: "Myanmar", dial: "+95" },
  { code: "NA", name: "Namibia", nameEn: "Namibia", dial: "+264" },
  { code: "NR", name: "Nauru", nameEn: "Nauru", dial: "+674" },
  { code: "NP", name: "Nepal", nameEn: "Nepal", dial: "+977" },
  { code: "NI", name: "Nicaragua", nameEn: "Nicaragua", dial: "+505" },
  { code: "NE", name: "Niger", nameEn: "Niger", dial: "+227" },
  { code: "NG", name: "Nigeria", nameEn: "Nigeria", dial: "+234" },
  { code: "NO", name: "Norvegia", nameEn: "Norway", dial: "+47" },
  { code: "NC", name: "Noua Caledonie", nameEn: "New Caledonia", dial: "+687" },
  { code: "NZ", name: "Noua Zeelandă", nameEn: "New Zealand", dial: "+64" },
  { code: "NL", name: "Olanda", nameEn: "Netherlands", dial: "+31" },
  { code: "OM", name: "Oman", nameEn: "Oman", dial: "+968" },
  { code: "PK", name: "Pakistan", nameEn: "Pakistan", dial: "+92" },
  { code: "PW", name: "Palau", nameEn: "Palau", dial: "+680" },
  { code: "PS", name: "Palestina", nameEn: "Palestine", dial: "+970" },
  { code: "PA", name: "Panama", nameEn: "Panama", dial: "+507" },
  { code: "PG", name: "Papua Noua Guinee", nameEn: "Papua New Guinea", dial: "+675" },
  { code: "PY", name: "Paraguay", nameEn: "Paraguay", dial: "+595" },
  { code: "PE", name: "Peru", nameEn: "Peru", dial: "+51" },
  { code: "PL", name: "Polonia", nameEn: "Poland", dial: "+48" },
  { code: "PT", name: "Portugalia", nameEn: "Portugal", dial: "+351" },
  { code: "PR", name: "Puerto Rico", nameEn: "Puerto Rico", dial: "+1787" },
  { code: "QA", name: "Qatar", nameEn: "Qatar", dial: "+974" },
  { code: "GB", name: "Regatul Unit", nameEn: "United Kingdom", dial: "+44" },
  { code: "CF", name: "Republica Centrafricană", nameEn: "Central African Republic", dial: "+236" },
  { code: "RE", name: "Réunion", nameEn: "Réunion", dial: "+262" },
  { code: "RO", name: "România", nameEn: "Romania", dial: "+40" },
  { code: "RU", name: "Rusia", nameEn: "Russia", dial: "+7" },
  { code: "RW", name: "Rwanda", nameEn: "Rwanda", dial: "+250" },
  { code: "KN", name: "Saint Kitts și Nevis", nameEn: "Saint Kitts and Nevis", dial: "+1869" },
  { code: "LC", name: "Saint Lucia", nameEn: "Saint Lucia", dial: "+1758" },
  { code: "VC", name: "Saint Vincent și Grenadine", nameEn: "Saint Vincent and the Grenadines", dial: "+1784" },
  { code: "WS", name: "Samoa", nameEn: "Samoa", dial: "+685" },
  { code: "SM", name: "San Marino", nameEn: "San Marino", dial: "+378" },
  { code: "ST", name: "São Tomé și Príncipe", nameEn: "São Tomé and Príncipe", dial: "+239" },
  { code: "SN", name: "Senegal", nameEn: "Senegal", dial: "+221" },
  { code: "RS", name: "Serbia", nameEn: "Serbia", dial: "+381" },
  { code: "SC", name: "Seychelles", nameEn: "Seychelles", dial: "+248" },
  { code: "SL", name: "Sierra Leone", nameEn: "Sierra Leone", dial: "+232" },
  { code: "SG", name: "Singapore", nameEn: "Singapore", dial: "+65" },
  { code: "SY", name: "Siria", nameEn: "Syria", dial: "+963" },
  { code: "SK", name: "Slovacia", nameEn: "Slovakia", dial: "+421" },
  { code: "SI", name: "Slovenia", nameEn: "Slovenia", dial: "+386" },
  { code: "SB", name: "Insulele Solomon", nameEn: "Solomon Islands", dial: "+677" },
  { code: "SO", name: "Somalia", nameEn: "Somalia", dial: "+252" },
  { code: "ES", name: "Spania", nameEn: "Spain", dial: "+34" },
  { code: "LK", name: "Sri Lanka", nameEn: "Sri Lanka", dial: "+94" },
  { code: "US", name: "Statele Unite", nameEn: "United States", dial: "+1" },
  { code: "SD", name: "Sudan", nameEn: "Sudan", dial: "+249" },
  { code: "SS", name: "Sudanul de Sud", nameEn: "South Sudan", dial: "+211" },
  { code: "SE", name: "Suedia", nameEn: "Sweden", dial: "+46" },
  { code: "SR", name: "Surinam", nameEn: "Suriname", dial: "+597" },
  { code: "SZ", name: "Eswatini", nameEn: "Eswatini", dial: "+268" },
  { code: "TJ", name: "Tadjikistan", nameEn: "Tajikistan", dial: "+992" },
  { code: "TH", name: "Thailanda", nameEn: "Thailand", dial: "+66" },
  { code: "TW", name: "Taiwan", nameEn: "Taiwan", dial: "+886" },
  { code: "TZ", name: "Tanzania", nameEn: "Tanzania", dial: "+255" },
  { code: "TD", name: "Ciad", nameEn: "Chad", dial: "+235" },
  { code: "TG", name: "Togo", nameEn: "Togo", dial: "+228" },
  { code: "TO", name: "Tonga", nameEn: "Tonga", dial: "+676" },
  { code: "TT", name: "Trinidad și Tobago", nameEn: "Trinidad and Tobago", dial: "+1868" },
  { code: "TN", name: "Tunisia", nameEn: "Tunisia", dial: "+216" },
  { code: "TR", name: "Turcia", nameEn: "Turkey", dial: "+90" },
  { code: "TM", name: "Turkmenistan", nameEn: "Turkmenistan", dial: "+993" },
  { code: "TV", name: "Tuvalu", nameEn: "Tuvalu", dial: "+688" },
  { code: "UA", name: "Ucraina", nameEn: "Ukraine", dial: "+380" },
  { code: "UG", name: "Uganda", nameEn: "Uganda", dial: "+256" },
  { code: "HU", name: "Ungaria", nameEn: "Hungary", dial: "+36" },
  { code: "UY", name: "Uruguay", nameEn: "Uruguay", dial: "+598" },
  { code: "UZ", name: "Uzbekistan", nameEn: "Uzbekistan", dial: "+998" },
  { code: "VU", name: "Vanuatu", nameEn: "Vanuatu", dial: "+678" },
  { code: "VA", name: "Vatican", nameEn: "Vatican City", dial: "+379" },
  { code: "VE", name: "Venezuela", nameEn: "Venezuela", dial: "+58" },
  { code: "VN", name: "Vietnam", nameEn: "Vietnam", dial: "+84" },
  { code: "YE", name: "Yemen", nameEn: "Yemen", dial: "+967" },
  { code: "ZM", name: "Zambia", nameEn: "Zambia", dial: "+260" },
  { code: "ZW", name: "Zimbabwe", nameEn: "Zimbabwe", dial: "+263" },
];

// Țări favorite, fixate sus în selector (ordine deliberată).
export const FAVORITE_CODES = ["RO", "DE", "AT", "GB", "FR", "IT", "ES", "NL", "BE"];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function countryByCode(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  return BY_CODE.get(code.toUpperCase());
}

// Normalizează pentru căutare: minuscule, fără diacritice.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Caută țări după nume (RO + EN), prefix telefonic sau cod ISO.
// Ex: "rom"→România, "40"→România, "germ"→Germania, "49"→Germania.
export function searchCountries(query: string): Country[] {
  const q = normalize(query.trim());
  if (!q) return COUNTRIES;
  const digits = q.replace(/[^\d]/g, "");
  return COUNTRIES.filter((c) => {
    if (normalize(c.name).includes(q)) return true;
    if (normalize(c.nameEn).includes(q)) return true;
    if (c.code.toLowerCase().includes(q)) return true;
    // Prefix telefonic: potrivire pe început (fără "+"), ex: "40"→RO, "49"→DE.
    if (digits && c.dial.slice(1).startsWith(digits)) return true;
    return false;
  });
}

// ---- Țări folosite recent (persistate în localStorage) ----
const RECENT_KEY = "aromatool.recentCountries";
const RECENT_MAX = 4;

export function getRecentCountryCodes(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((c) => typeof c === "string" && BY_CODE.has(c)).slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

export function pushRecentCountry(code: string): void {
  if (!BY_CODE.has(code)) return;
  try {
    const current = getRecentCountryCodes().filter((c) => c !== code);
    const next = [code, ...current].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

// Desparte un număr E.164 ("+40712345678") în { country, national }.
// Alege prefixul cel mai lung care se potrivește (ex: +1264 înainte de +1).
export function parsePhone(
  value: string | null | undefined,
  fallbackCode = "RO",
): { code: string; national: string } {
  const fallback = countryByCode(fallbackCode) ?? COUNTRIES.find((c) => c.code === "RO")!;
  const raw = (value || "").trim();
  if (!raw.startsWith("+")) {
    return { code: fallback.code, national: raw.replace(/[^\d]/g, "") };
  }
  const digits = raw;
  let best: Country | undefined;
  for (const c of COUNTRIES) {
    if (digits.startsWith(c.dial)) {
      if (!best || c.dial.length > best.dial.length) best = c;
    }
  }
  if (!best) return { code: fallback.code, national: digits.replace(/[^\d]/g, "") };
  return {
    code: best.code,
    national: digits.slice(best.dial.length).replace(/[^\d]/g, ""),
  };
}

// Construiește E.164 dintr-un cod de țară + număr național.
// Întoarce "" dacă nu există parte națională (ca să nu salvăm doar prefixul).
export function buildPhone(code: string, national: string): string {
  const country = countryByCode(code);
  const digits = (national || "").replace(/[^\d]/g, "");
  if (!country || !digits) return "";
  return `${country.dial}${digits}`;
}
