// ============================================================
// PhoneInput — câmp de telefon internațional modern.
// Aspect unitar [🇷🇴 +40 | număr]; click pe țară deschide un
// selector căutabil (bottom-sheet pe mobil, popover pe desktop)
// cu favorite + folosite recent fixate sus. Valoarea stocată/
// emisă este mereu E.164 ("+40712345678"). Validare cu
// libphonenumber-js, afișată la blur.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AsYouType, isValidPhoneNumber } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";
import {
  COUNTRIES,
  FAVORITE_CODES,
  flagOf,
  countryByCode,
  parsePhone,
  buildPhone,
  searchCountries,
  getRecentCountryCodes,
  pushRecentCountry,
  type Country,
} from "../lib/countries";

export interface PhoneInputTheme {
  border: string; // culoarea border-ului
  inputBg: string; // fundalul câmpurilor
  text: string; // culoarea textului
  focus: string; // culoarea border la focus
}

interface PhoneInputProps {
  value: string | null | undefined; // E.164 sau gol
  onChange: (e164: string) => void;
  defaultCountry?: string; // ISO2, folosit când value nu are prefix
  theme: PhoneInputTheme;
  placeholder?: string;
  disabled?: boolean;
}

const ERROR_COLOR = "#DC2626";
const MUTED = "#8A857C";
const SURFACE = "#FFFFFF";

// Formatează cifrele naționale frumos pentru afișare (ex: 722000000 → "722 000 000").
function formatNational(digits: string, code: string): string {
  if (!digits) return "";
  try {
    return new AsYouType(code as CountryCode).input(digits) || digits;
  } catch {
    return digits;
  }
}

export default function PhoneInput({
  value,
  onChange,
  defaultCountry = "RO",
  theme,
  placeholder = "712 345 678",
  disabled = false,
}: PhoneInputProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "ro").startsWith("ro") ? "ro" : "en";
  const nameOf = (c: Country) => (lang === "ro" ? c.name : c.nameEn);

  const initial = useMemo(
    () => parsePhone(value, defaultCountry),
    // doar la montare; sincronizarea ulterioară e gestionată mai jos
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [country, setCountry] = useState<string>(initial.code);
  const [national, setNational] = useState<string>(
    formatNational(initial.national, initial.code),
  );
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);

  // Sincronizează din prop `value` când se schimbă extern (reset, alt contact),
  // fără să suprascrie tastarea curentă.
  useEffect(() => {
    const built = buildPhone(country, national.replace(/\D/g, ""));
    if ((value || "") !== built) {
      const p = parsePhone(value, defaultCountry);
      setCountry(p.code);
      setNational(formatNational(p.national, p.code));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const selected = countryByCode(country) ?? COUNTRIES[0];

  const invalid = useMemo(() => {
    if (!touched) return false;
    const digits = national.replace(/\D/g, "");
    if (!digits) return false; // gol e permis (telefon opțional)
    try {
      return !isValidPhoneNumber(buildPhone(country, digits));
    } catch {
      return false;
    }
  }, [touched, national, country]);

  const emit = (code: string, displayValue: string) => {
    const digits = displayValue.replace(/\D/g, "");
    onChange(buildPhone(code, digits));
  };

  const handleInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const formatted = formatNational(digits, country);
    setNational(formatted);
    emit(country, formatted);
  };

  const pickCountry = (code: string) => {
    setCountry(code);
    pushRecentCountry(code);
    const formatted = formatNational(national.replace(/\D/g, ""), code);
    setNational(formatted);
    emit(code, formatted);
    setOpen(false);
  };

  const borderColor = invalid ? ERROR_COLOR : focused ? theme.focus : theme.border;

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          border: `1px solid ${borderColor}`,
          borderRadius: 10,
          background: theme.inputBg,
          overflow: "hidden",
          transition: "border-color 0.15s",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 10px 10px 12px",
            border: "none",
            borderRight: `1px solid ${theme.border}`,
            background: "transparent",
            color: theme.text,
            fontSize: 14,
            fontFamily: "inherit",
            cursor: disabled ? "default" : "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          aria-label={t("common.phone.selectCountry")}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{flagOf(selected.code)}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{selected.dial}</span>
          <i
            className="ti ti-chevron-down"
            style={{ fontSize: 13, color: MUTED, marginLeft: -1 }}
          />
        </button>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={national}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setTouched(true);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            color: theme.text,
            fontSize: 14,
            fontFamily: "inherit",
            padding: "10px 12px",
          }}
        />
      </div>
      {invalid && (
        <div style={{ fontSize: 12, color: ERROR_COLOR, marginTop: 5 }}>
          {t("common.phone.invalid")}
        </div>
      )}
      {open && (
        <CountryPicker
          selectedCode={country}
          nameOf={nameOf}
          onPick={pickCountry}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Selectorul de țară (bottom-sheet pe mobil / popover pe desktop)
// ------------------------------------------------------------
function CountryPicker({
  selectedCode,
  nameOf,
  onPick,
  onClose,
}: {
  selectedCode: string;
  nameOf: (c: Country) => string;
  onPick: (code: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const h = () => setMobile(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Focus automat pe căutare la deschidere.
  useEffect(() => {
    const id = setTimeout(() => searchRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, []);

  // Închide la click în afară (doar pe desktop / popover).
  useEffect(() => {
    if (mobile) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [mobile, onClose]);

  // Grupuri afișate.
  const groups = useMemo(() => {
    const q = search.trim();
    if (q) {
      return [{ label: null as string | null, items: searchCountries(q) }];
    }
    const recent = getRecentCountryCodes()
      .map(countryByCode)
      .filter((c): c is Country => !!c);
    const favs = FAVORITE_CODES.map(countryByCode).filter((c): c is Country => !!c);
    const out: { label: string | null; items: Country[] }[] = [];
    if (recent.length) out.push({ label: t("common.phone.recent"), items: recent });
    out.push({ label: t("common.phone.favorites"), items: favs });
    out.push({ label: t("common.phone.all"), items: COUNTRIES });
    return out;
  }, [search, t]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    setHighlight(0);
  }, [search]);

  // Ține elementul evidențiat în vizor.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = flat[highlight];
      if (c) onPick(c.code);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Index global continuu peste grupuri, ca să se potrivească cu `flat`.
  let runningIdx = -1;

  const rows = (
    <div
      ref={listRef}
      style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}
    >
      {flat.length === 0 && (
        <div style={{ padding: "24px 16px", textAlign: "center", color: MUTED, fontSize: 14 }}>
          {t("common.phone.noResults")}
        </div>
      )}
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label && (
            <div
              style={{
                padding: "8px 16px 4px",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: MUTED,
                position: "sticky",
                top: 0,
                background: SURFACE,
              }}
            >
              {g.label}
            </div>
          )}
          {g.items.map((c) => {
            runningIdx += 1;
            const idx = runningIdx;
            const isSel = c.code === selectedCode;
            const isHi = idx === highlight;
            return (
              <button
                key={`${gi}-${c.code}`}
                type="button"
                data-idx={idx}
                onClick={() => onPick(c.code)}
                onMouseEnter={() => setHighlight(idx)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "11px 16px",
                  border: "none",
                  background: isHi ? "#F3F0EA" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "#3A352E",
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
                  {flagOf(c.code)}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nameOf(c)}
                </span>
                <span style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {c.dial}
                </span>
                {isSel && (
                  <i className="ti ti-check" style={{ fontSize: 15, color: "#7A8B6F" }} />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  const header = (
    <div style={{ padding: "14px 16px 10px", flexShrink: 0 }}>
      {mobile && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, color: "#3A352E" }}>
            {t("common.phone.selectCountry")}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              color: MUTED,
              cursor: "pointer",
              lineHeight: 1,
              padding: 2,
            }}
          >
            <i className="ti ti-x" />
          </button>
        </div>
      )}
      <div style={{ position: "relative" }}>
        <i
          className="ti ti-search"
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 15,
            color: MUTED,
          }}
        />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("common.phone.searchPlaceholder")}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px 10px 34px",
            fontSize: 14,
            fontFamily: "inherit",
            color: "#3A352E",
            border: "1px solid #E5DFD6",
            borderRadius: 9,
            outline: "none",
            background: "#FAF8F4",
          }}
        />
      </div>
    </div>
  );

  if (mobile) {
    return (
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 1000,
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <div
          ref={rootRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxHeight: "80vh",
            background: SURFACE,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 -8px 30px rgba(0,0,0,0.18)",
          }}
        >
          <div
            style={{
              width: 38,
              height: 4,
              borderRadius: 2,
              background: "#E0DAD0",
              margin: "8px auto 0",
              flexShrink: 0,
            }}
          />
          {header}
          {rows}
        </div>
      </div>
    );
  }

  // Desktop: popover ancorat sub câmp.
  return (
    <div
      ref={rootRef}
      style={{
        position: "absolute",
        zIndex: 1000,
        marginTop: 6,
        width: "min(340px, 90vw)",
        maxHeight: 360,
        background: SURFACE,
        border: "1px solid #E5DFD6",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {header}
      {rows}
    </div>
  );
}
