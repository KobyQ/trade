import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      <p>Phase 1 MVP: deterministic signal generation and risk-gated latest signal monitoring.</p>
      <ul>
        <li><Link href="/dashboard/signals">Signals</Link></li>
      </ul>
    </div>
  );
}
