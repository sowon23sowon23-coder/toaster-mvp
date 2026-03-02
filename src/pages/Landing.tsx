import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { trackEvent } from "../lib/analytics";

export default function Landing() {
  const navigate = useNavigate();

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
            navigate("/templates");
          }}
        >
          Start Campaign
        </Button>
      </div>
    </main>
  );
}
