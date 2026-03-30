import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      <p>Private, risk-controlled signal generation dashboard.</p>
      <ul>
        <li><Link href="/dashboard/signals">Signals</Link></li>
        <li><Link href="/dashboard/metrics">Metrics</Link></li>
        <li><Link href="/dashboard/risk">Risk Events</Link></li>
        <li><Link href="/dashboard/config">Config</Link></li>
      </ul>
    </div>
  );
}
