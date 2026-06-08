// ============================================================
// ȚĂRI — sursă unică pentru selectorul de țară și prefixul de
// telefon. Steagul se calculează din codul ISO2 (regional
// indicators), deci nu stocăm emoji în date.
// ============================================================

export interface Country {
  code: string; // ISO 3166-1 alpha-2 (ex: "RO")
  name: string; // nume în română
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
  { code: "AF", name: "Afganistan", dial: "+93" },
  { code: "ZA", name: "Africa de Sud", dial: "+27" },
  { code: "AL", name: "Albania", dial: "+355" },
  { code: "DZ", name: "Algeria", dial: "+213" },
  { code: "AD", name: "Andorra", dial: "+376" },
  { code: "AO", name: "Angola", dial: "+244" },
  { code: "AI", name: "Anguilla", dial: "+1264" },
  { code: "AG", name: "Antigua și Barbuda", dial: "+1268" },
  { code: "SA", name: "Arabia Saudită", dial: "+966" },
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "AM", name: "Armenia", dial: "+374" },
  { code: "AW", name: "Aruba", dial: "+297" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "AT", name: "Austria", dial: "+43" },
  { code: "AZ", name: "Azerbaidjan", dial: "+994" },
  { code: "BS", name: "Bahamas", dial: "+1242" },
  { code: "BH", name: "Bahrain", dial: "+973" },
  { code: "BD", name: "Bangladesh", dial: "+880" },
  { code: "BB", name: "Barbados", dial: "+1246" },
  { code: "BE", name: "Belgia", dial: "+32" },
  { code: "BZ", name: "Belize", dial: "+501" },
  { code: "BJ", name: "Benin", dial: "+229" },
  { code: "BM", name: "Bermuda", dial: "+1441" },
  { code: "BY", name: "Belarus", dial: "+375" },
  { code: "BO", name: "Bolivia", dial: "+591" },
  { code: "BA", name: "Bosnia și Herțegovina", dial: "+387" },
  { code: "BW", name: "Botswana", dial: "+267" },
  { code: "BR", name: "Brazilia", dial: "+55" },
  { code: "BN", name: "Brunei", dial: "+673" },
  { code: "BG", name: "Bulgaria", dial: "+359" },
  { code: "BF", name: "Burkina Faso", dial: "+226" },
  { code: "BI", name: "Burundi", dial: "+257" },
  { code: "KH", name: "Cambodgia", dial: "+855" },
  { code: "CM", name: "Camerun", dial: "+237" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "CV", name: "Capul Verde", dial: "+238" },
  { code: "CZ", name: "Cehia", dial: "+420" },
  { code: "CL", name: "Chile", dial: "+56" },
  { code: "CN", name: "China", dial: "+86" },
  { code: "CY", name: "Cipru", dial: "+357" },
  { code: "CO", name: "Columbia", dial: "+57" },
  { code: "KM", name: "Comore", dial: "+269" },
  { code: "CG", name: "Congo", dial: "+242" },
  { code: "CD", name: "Congo (RD)", dial: "+243" },
  { code: "KR", name: "Coreea de Sud", dial: "+82" },
  { code: "KP", name: "Coreea de Nord", dial: "+850" },
  { code: "CR", name: "Costa Rica", dial: "+506" },
  { code: "CI", name: "Coasta de Fildeș", dial: "+225" },
  { code: "HR", name: "Croația", dial: "+385" },
  { code: "CU", name: "Cuba", dial: "+53" },
  { code: "CW", name: "Curaçao", dial: "+599" },
  { code: "DK", name: "Danemarca", dial: "+45" },
  { code: "DJ", name: "Djibouti", dial: "+253" },
  { code: "DM", name: "Dominica", dial: "+1767" },
  { code: "DO", name: "Republica Dominicană", dial: "+1809" },
  { code: "EG", name: "Egipt", dial: "+20" },
  { code: "SV", name: "El Salvador", dial: "+503" },
  { code: "CH", name: "Elveția", dial: "+41" },
  { code: "AE", name: "Emiratele Arabe Unite", dial: "+971" },
  { code: "EC", name: "Ecuador", dial: "+593" },
  { code: "ER", name: "Eritreea", dial: "+291" },
  { code: "EE", name: "Estonia", dial: "+372" },
  { code: "ET", name: "Etiopia", dial: "+251" },
  { code: "FJ", name: "Fiji", dial: "+679" },
  { code: "PH", name: "Filipine", dial: "+63" },
  { code: "FI", name: "Finlanda", dial: "+358" },
  { code: "FR", name: "Franța", dial: "+33" },
  { code: "GA", name: "Gabon", dial: "+241" },
  { code: "GM", name: "Gambia", dial: "+220" },
  { code: "GE", name: "Georgia", dial: "+995" },
  { code: "DE", name: "Germania", dial: "+49" },
  { code: "GH", name: "Ghana", dial: "+233" },
  { code: "GI", name: "Gibraltar", dial: "+350" },
  { code: "GR", name: "Grecia", dial: "+30" },
  { code: "GD", name: "Grenada", dial: "+1473" },
  { code: "GL", name: "Groenlanda", dial: "+299" },
  { code: "GP", name: "Guadelupa", dial: "+590" },
  { code: "GU", name: "Guam", dial: "+1671" },
  { code: "GT", name: "Guatemala", dial: "+502" },
  { code: "GG", name: "Guernsey", dial: "+44" },
  { code: "GN", name: "Guineea", dial: "+224" },
  { code: "GW", name: "Guineea-Bissau", dial: "+245" },
  { code: "GQ", name: "Guineea Ecuatorială", dial: "+240" },
  { code: "GY", name: "Guyana", dial: "+592" },
  { code: "HT", name: "Haiti", dial: "+509" },
  { code: "HN", name: "Honduras", dial: "+504" },
  { code: "HK", name: "Hong Kong", dial: "+852" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "ID", name: "Indonezia", dial: "+62" },
  { code: "JO", name: "Iordania", dial: "+962" },
  { code: "IQ", name: "Irak", dial: "+964" },
  { code: "IR", name: "Iran", dial: "+98" },
  { code: "IE", name: "Irlanda", dial: "+353" },
  { code: "IS", name: "Islanda", dial: "+354" },
  { code: "IL", name: "Israel", dial: "+972" },
  { code: "IT", name: "Italia", dial: "+39" },
  { code: "JM", name: "Jamaica", dial: "+1876" },
  { code: "JP", name: "Japonia", dial: "+81" },
  { code: "JE", name: "Jersey", dial: "+44" },
  { code: "KZ", name: "Kazahstan", dial: "+7" },
  { code: "KE", name: "Kenya", dial: "+254" },
  { code: "KG", name: "Kârgâzstan", dial: "+996" },
  { code: "KI", name: "Kiribati", dial: "+686" },
  { code: "KW", name: "Kuwait", dial: "+965" },
  { code: "LA", name: "Laos", dial: "+856" },
  { code: "LS", name: "Lesotho", dial: "+266" },
  { code: "LV", name: "Letonia", dial: "+371" },
  { code: "LB", name: "Liban", dial: "+961" },
  { code: "LR", name: "Liberia", dial: "+231" },
  { code: "LY", name: "Libia", dial: "+218" },
  { code: "LI", name: "Liechtenstein", dial: "+423" },
  { code: "LT", name: "Lituania", dial: "+370" },
  { code: "LU", name: "Luxemburg", dial: "+352" },
  { code: "MO", name: "Macao", dial: "+853" },
  { code: "MK", name: "Macedonia de Nord", dial: "+389" },
  { code: "MG", name: "Madagascar", dial: "+261" },
  { code: "MY", name: "Malaysia", dial: "+60" },
  { code: "MW", name: "Malawi", dial: "+265" },
  { code: "MV", name: "Maldive", dial: "+960" },
  { code: "ML", name: "Mali", dial: "+223" },
  { code: "MT", name: "Malta", dial: "+356" },
  { code: "MA", name: "Maroc", dial: "+212" },
  { code: "MH", name: "Insulele Marshall", dial: "+692" },
  { code: "MQ", name: "Martinica", dial: "+596" },
  { code: "MU", name: "Mauritius", dial: "+230" },
  { code: "MR", name: "Mauritania", dial: "+222" },
  { code: "MX", name: "Mexic", dial: "+52" },
  { code: "FM", name: "Micronezia", dial: "+691" },
  { code: "MD", name: "Moldova", dial: "+373" },
  { code: "MC", name: "Monaco", dial: "+377" },
  { code: "MN", name: "Mongolia", dial: "+976" },
  { code: "ME", name: "Muntenegru", dial: "+382" },
  { code: "MS", name: "Montserrat", dial: "+1664" },
  { code: "MZ", name: "Mozambic", dial: "+258" },
  { code: "MM", name: "Myanmar", dial: "+95" },
  { code: "NA", name: "Namibia", dial: "+264" },
  { code: "NR", name: "Nauru", dial: "+674" },
  { code: "NP", name: "Nepal", dial: "+977" },
  { code: "NI", name: "Nicaragua", dial: "+505" },
  { code: "NE", name: "Niger", dial: "+227" },
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "NO", name: "Norvegia", dial: "+47" },
  { code: "NC", name: "Noua Caledonie", dial: "+687" },
  { code: "NZ", name: "Noua Zeelandă", dial: "+64" },
  { code: "NL", name: "Olanda", dial: "+31" },
  { code: "OM", name: "Oman", dial: "+968" },
  { code: "PK", name: "Pakistan", dial: "+92" },
  { code: "PW", name: "Palau", dial: "+680" },
  { code: "PS", name: "Palestina", dial: "+970" },
  { code: "PA", name: "Panama", dial: "+507" },
  { code: "PG", name: "Papua Noua Guinee", dial: "+675" },
  { code: "PY", name: "Paraguay", dial: "+595" },
  { code: "PE", name: "Peru", dial: "+51" },
  { code: "PL", name: "Polonia", dial: "+48" },
  { code: "PT", name: "Portugalia", dial: "+351" },
  { code: "PR", name: "Puerto Rico", dial: "+1787" },
  { code: "QA", name: "Qatar", dial: "+974" },
  { code: "GB", name: "Regatul Unit", dial: "+44" },
  { code: "CF", name: "Republica Centrafricană", dial: "+236" },
  { code: "RE", name: "Réunion", dial: "+262" },
  { code: "RO", name: "România", dial: "+40" },
  { code: "RU", name: "Rusia", dial: "+7" },
  { code: "RW", name: "Rwanda", dial: "+250" },
  { code: "KN", name: "Saint Kitts și Nevis", dial: "+1869" },
  { code: "LC", name: "Saint Lucia", dial: "+1758" },
  { code: "VC", name: "Saint Vincent și Grenadine", dial: "+1784" },
  { code: "WS", name: "Samoa", dial: "+685" },
  { code: "SM", name: "San Marino", dial: "+378" },
  { code: "ST", name: "São Tomé și Príncipe", dial: "+239" },
  { code: "SN", name: "Senegal", dial: "+221" },
  { code: "RS", name: "Serbia", dial: "+381" },
  { code: "SC", name: "Seychelles", dial: "+248" },
  { code: "SL", name: "Sierra Leone", dial: "+232" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "SY", name: "Siria", dial: "+963" },
  { code: "SK", name: "Slovacia", dial: "+421" },
  { code: "SI", name: "Slovenia", dial: "+386" },
  { code: "SB", name: "Insulele Solomon", dial: "+677" },
  { code: "SO", name: "Somalia", dial: "+252" },
  { code: "ES", name: "Spania", dial: "+34" },
  { code: "LK", name: "Sri Lanka", dial: "+94" },
  { code: "US", name: "Statele Unite", dial: "+1" },
  { code: "SD", name: "Sudan", dial: "+249" },
  { code: "SS", name: "Sudanul de Sud", dial: "+211" },
  { code: "SE", name: "Suedia", dial: "+46" },
  { code: "SR", name: "Surinam", dial: "+597" },
  { code: "SZ", name: "Eswatini", dial: "+268" },
  { code: "TJ", name: "Tadjikistan", dial: "+992" },
  { code: "TH", name: "Thailanda", dial: "+66" },
  { code: "TW", name: "Taiwan", dial: "+886" },
  { code: "TZ", name: "Tanzania", dial: "+255" },
  { code: "TD", name: "Ciad", dial: "+235" },
  { code: "TG", name: "Togo", dial: "+228" },
  { code: "TO", name: "Tonga", dial: "+676" },
  { code: "TT", name: "Trinidad și Tobago", dial: "+1868" },
  { code: "TN", name: "Tunisia", dial: "+216" },
  { code: "TR", name: "Turcia", dial: "+90" },
  { code: "TM", name: "Turkmenistan", dial: "+993" },
  { code: "TV", name: "Tuvalu", dial: "+688" },
  { code: "UA", name: "Ucraina", dial: "+380" },
  { code: "UG", name: "Uganda", dial: "+256" },
  { code: "HU", name: "Ungaria", dial: "+36" },
  { code: "UY", name: "Uruguay", dial: "+598" },
  { code: "UZ", name: "Uzbekistan", dial: "+998" },
  { code: "VU", name: "Vanuatu", dial: "+678" },
  { code: "VA", name: "Vatican", dial: "+379" },
  { code: "VE", name: "Venezuela", dial: "+58" },
  { code: "VN", name: "Vietnam", dial: "+84" },
  { code: "YE", name: "Yemen", dial: "+967" },
  { code: "ZM", name: "Zambia", dial: "+260" },
  { code: "ZW", name: "Zimbabwe", dial: "+263" },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function countryByCode(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  return BY_CODE.get(code.toUpperCase());
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
