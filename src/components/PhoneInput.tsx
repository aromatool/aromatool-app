// ============================================================
// PhoneInput — selector de prefix de țară + număr național.
// Valoarea stocată/emisă este E.164 ("+40712345678"). Pe load
// se desparte cu parsePhone; pe schimbare se recompune cu
// buildPhone, deci formatele inconsistente sunt normalizate.
// ============================================================

import { useMemo } from "react";
import { COUNTRIES, flagOf, parsePhone, buildPhone } from "../lib/countries";

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

export default function PhoneInput({
  value,
  onChange,
  defaultCountry = "RO",
  theme,
  placeholder = "712 345 678",
  disabled = false,
}: PhoneInputProps) {
  const parsed = useMemo(
    () => parsePhone(value, defaultCountry),
    [value, defaultCountry],
  );

  const baseField: React.CSSProperties = {
    border: `1px solid ${theme.border}`,
    background: theme.inputBg,
    color: theme.text,
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.15s",
  };

  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = theme.focus;
  };
  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = theme.border;
  };

  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <select
        value={parsed.code}
        disabled={disabled}
        onChange={(e) => onChange(buildPhone(e.target.value, parsed.national))}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{
          ...baseField,
          borderRadius: "10px",
          padding: "10px 8px",
          maxWidth: "130px",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {flagOf(c.code)} {c.dial}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="tel"
        value={parsed.national}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(buildPhone(parsed.code, e.target.value))}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{
          ...baseField,
          borderRadius: "10px",
          padding: "10px 12px",
          flex: 1,
          minWidth: 0,
        }}
      />
    </div>
  );
}
