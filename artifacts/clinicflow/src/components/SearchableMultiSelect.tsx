import { useState, useMemo } from "react";
import { Search, Check } from "lucide-react";

export function SearchableMultiSelect({
  options,
  value,
  onChange,
  disabled,
  placeholder = "Select...",
  isLoading = false,
}: {
  options: { value: string; label: string; hidden?: boolean }[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
}) {
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const toggle = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  return (
    <div className="searchable-multi-select" style={{ border: "1px solid var(--color-input)", borderRadius: "var(--radius)", padding: "4px", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px" }}>
      <div style={{ position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--color-muted-foreground)" }} />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
          style={{ width: "100%", padding: "4px 8px 4px 28px", border: "none", outline: "none", background: "transparent", fontSize: "13px" }}
        />
      </div>
      <div style={{ overflowY: "auto", flex: 1, borderTop: "1px solid var(--color-input)", paddingTop: "4px" }}>
        {isLoading ? (
          <div style={{ padding: "4px 8px", fontSize: "13px", color: "var(--color-muted-foreground)" }}>Loading...</div>
        ) : filteredOptions.length === 0 ? (
          <div style={{ padding: "4px 8px", fontSize: "13px", color: "var(--color-muted-foreground)" }}>No matches</div>
        ) : (
          filteredOptions.map((opt) => {
            const isSelected = value.includes(opt.value);
            return (
              <label
                key={opt.value}
                style={{
                  display: opt.hidden && !isSelected ? "none" : "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 8px",
                  fontSize: "13px",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                  background: isSelected ? "var(--color-input)" : "transparent",
                  borderRadius: "4px",
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(opt.value)}
                  disabled={disabled}
                  style={{ margin: 0 }}
                />
                {opt.label}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
