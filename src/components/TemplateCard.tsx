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
      </div>
      <h3>{template.name}</h3>
      <p>{template.description}</p>
    </button>
  );
}
