import Link from "next/link";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>
          Yogurtland Photo
        </h1>
        <p style={{ opacity: 0.7, marginBottom: 18 }}>
          Press the button below to start shooting.
        </p>

        <Link
          href="/capture"
          style={{
            display: "inline-block",
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            textDecoration: "none",
          }}
        >
          Go to shooting →
        </Link>
      </div>
    </main>
  );
}
