import Link from "next/link";

export default function NotFound() {
  return (
    <main className="standalone">
      <h1>This page isn’t here.</h1>
      <p>Your leads are in your workspace.</p>
      <Link className="button primary" href="/">
        Back to LeadFlow
      </Link>
    </main>
  );
}
