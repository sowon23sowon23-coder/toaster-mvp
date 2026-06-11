import { TemplateConfig } from "../lib/assets";

type TemplateCardProps = {
  template: TemplateConfig;
  selected: boolean;
  onSelect: (id: TemplateConfig["id"]) => void;
};

export default function TemplateCard({ template, selected, onSelect }: TemplateCardProps) {
  return (
    <button
      type="button"
      className={`template-card${selected ? " selected" : ""}`}
      onClick={() => onSelect(template.id)}
    >
      <div className="template-preview">
        <img src={template.frameSrc} alt={template.name} />
        {selected && (
          <div className="template-check-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>
      <span className="template-name">{template.name}</span>
    </button>
  );
}
