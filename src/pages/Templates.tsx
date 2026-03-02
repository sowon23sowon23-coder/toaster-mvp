import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import TemplateCard from "../components/TemplateCard";
import Button from "../components/Button";
import { TEMPLATES } from "../lib/assets";
import { usePhotoboothStore } from "../store/usePhotoboothStore";
import { trackEvent } from "../lib/analytics";

export default function Templates() {
  const navigate = useNavigate();
  const selectedTemplateId = usePhotoboothStore((state) => state.selectedTemplateId);
  const setTemplate = usePhotoboothStore((state) => state.setTemplate);
  const resetPhotos = usePhotoboothStore((state) => state.resetPhotos);
  const resetEdit = usePhotoboothStore((state) => state.resetEdit);
  const canContinue = useMemo(() => Boolean(selectedTemplateId), [selectedTemplateId]);

  return (
    <main className="screen">
      <Header title="Choose Template" subtitle="Pick one of three campaign layouts." backTo="/" />

      <section className="template-grid">
        {TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            selected={selectedTemplateId === template.id}
            onSelect={(id) => {
              setTemplate(id);
              trackEvent("template_selected", { templateId: id });
            }}
          />
        ))}
      </section>

      <div className="bottom-cta">
        <Button
          disabled={!canContinue}
          onClick={() => {
            resetPhotos();
            resetEdit();
            navigate("/capture");
          }}
        >
          Continue
        </Button>
      </div>
    </main>
  );
}
