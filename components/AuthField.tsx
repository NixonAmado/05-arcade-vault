"use client";

import { useState } from "react";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  // Mensaje positivo (ej. "Usuario disponible").
  ok?: string | null;
  hint?: string | null;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

// Campo con validación inline: el error aparece al escribir o al salir del campo.
export default function AuthField({
  label,
  value,
  onChange,
  error,
  ok,
  hint,
  type = "text",
  placeholder,
  autoComplete,
  disabled,
  autoFocus,
}: Props) {
  const [touched, setTouched] = useState(false);
  const showError = !!error && (touched || value.length > 0);
  const showOk = !showError && !!ok;
  const id = `f-${label.toLowerCase().replace(/\W+/g, "-")}`;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={showError}
        aria-describedby={`${id}-msg`}
        className={showError ? "invalid" : showOk ? "valid" : ""}
      />
      <div id={`${id}-msg`} className={"msg" + (showError ? " err" : showOk ? " ok" : "")} role={showError ? "alert" : undefined}>
        {showError ? error : showOk ? ok : hint}
      </div>
    </div>
  );
}
