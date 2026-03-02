import Link from "next/link";

export default function Home() {
  return (
    <main className="home-wrap">
      <section className="app-shell">
        <div className="surface home-card stack">
          <div>
            <p className="brand-kicker">SWEET PHOTO EXPERIENCE</p>
            <h1 className="app-title">Toaster Photo Booth</h1>
            <p className="app-subtitle">
              Bright and sweet like Yogurtland. Capture 4 shots, pick a frame, and save your
              final image.
            </p>
          </div>
          <div className="chip-row">
            <span className="chip">4 Shots</span>
            <span className="chip">Frame Pick</span>
            <span className="chip">PNG Download</span>
          </div>
          <div className="home-actions">
            <Link href="/capture" className="btn btn-primary">
              Start Capture
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
