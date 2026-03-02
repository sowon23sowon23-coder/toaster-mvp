import Link from "next/link";

export default function Home() {
  return (
    <main className="home-wrap">
      <section className="app-shell">
        <div className="surface home-card stack">
          <div>
            <h1 className="app-title">Toaster Photo Booth</h1>
            <p className="app-subtitle">
              Mobile-first photo booth. Capture 4 shots, apply a frame, and save the final
              image.
            </p>
          </div>
          <Link href="/capture" className="btn btn-primary">
            Start Capture
          </Link>
        </div>
      </section>
    </main>
  );
}
