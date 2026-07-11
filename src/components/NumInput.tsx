import { useState } from "react";
import { fmtK } from "../utils/format";

interface Props {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

/**
 * Numeric input that formats with dots as thousand separators on every keystroke.
 * Syncs automatically when `value` changes externally (e.g. form reset).
 */
const NumInput: React.FC<Props> = ({ value, onChange, placeholder, style, disabled }) => {
  const [display, setDisplay] = useState(() => value > 0 ? fmtK(value) : "");
  const [lastValue, setLastValue] = useState(value);

  // Derived-state sync: if parent changed value externally, update display without useEffect
  if (value !== lastValue) {
    setLastValue(value);
    setDisplay(value > 0 ? fmtK(value) : "");
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const n = raw ? (parseInt(raw) || 0) : 0;
    const formatted = n > 0 ? fmtK(n) : "";
    setDisplay(formatted);
    setLastValue(n);
    onChange(n);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder ?? "0"}
      style={style}
      disabled={disabled}
    />
  );
};

export default NumInput;
