import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { trackEvent } from "../lib/analytics";
import { usePhotoboothStore } from "../store/usePhotoboothStore";

export default function Landing() {
  const navigate = useNavigate();
  const resetPhotos = usePhotoboothStore((state) => state.resetPhotos);
  const resetEdit = usePhotoboothStore((state) => state.resetEdit);

  return (
    <main className="screen">
      <section className="panel landing-panel">
        <img className="brand-logo" src="/brand/logo_placeholder.png" alt="Yogurtland campaign logo" />
        <h1>Sweet Moment Photo Booth</h1>
        <p>Create your Yogurtland 4-cut and share it on Instagram.</p>
      </section>

      <div className="bottom-cta">
        <Button
          onClick={() => {
            trackEvent("start_clicked");
            resetPhotos();
            resetEdit();
            navigate("/capture");
          }}
        >
          Start Campaign
        </Button>
      </div>
    </main>
  );
}
