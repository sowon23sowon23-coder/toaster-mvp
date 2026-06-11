import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import TemplateCard from "../components/TemplateCard";
import Button from "../components/Button";
import { TEMPLATES, TemplateId } from "../lib/assets";
import { usePhotoboothStore } from "../store/usePhotoboothStore";
import { trackEvent } from "../lib/analytics";

export default function Templates() {
  const navigate = useNavigate();
  const selectedTemplateId = usePhotoboothStore((state) => state.selectedTemplateId);
  const setTemplate = usePhotoboothStore((state) => state.setTemplate);
  const resetPhotos = usePhotoboothStore((state) => state.resetPhotos);
  const resetEdit = usePhotoboothStore((state) => state.resetEdit);

  function handleSelect(id: TemplateId) {
    setTemplate(id);
    trackEvent("template_selected", { templateId: id });
  }

  function handleContinue() {
    resetPhotos();
    resetEdit();
    navigate("/capture");
  }

  return (
    <main className="screen">
      <Header title="Choose Frame" subtitle="Pick a frame for your 4-cut." backTo="/" />

      <section className="template-grid">
        {TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            selected={selectedTemplateId === template.id}
            onSelect={handleSelect}
          />
        ))}
      </section>

      <div className="bottom-cta">
        <Button disabled={!selectedTemplateId} onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </main>
  );
}
