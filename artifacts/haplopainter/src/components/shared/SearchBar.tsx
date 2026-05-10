import { Search } from "lucide-react";
import type { ChangeEvent } from "react";

interface SearchBarProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  testId?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search...", testId }: SearchBarProps) {
  return (
    <div className="mb-4 relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        data-testid={testId ?? "input-search"}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
      />
    </div>
  );
}