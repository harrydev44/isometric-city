import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IsoCoaster - Co-op',
  description: 'Build a theme park together with friends in real-time co-op multiplayer.',
};

export default function CoopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
