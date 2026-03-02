type TabOption<T extends string> = {
  id: T;
  label: string;
};

type TabsProps<T extends string> = {
  value: T;
  options: TabOption<T>[];
  onChange: (tab: T) => void;
};

export default function Tabs<T extends string>({ value, options, onChange }: TabsProps<T>) {
  return (
    <div className="tabs" role="tablist">
      {options.map((tab) => (
        <button
          type="button"
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          className={`tab-btn${value === tab.id ? " active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
