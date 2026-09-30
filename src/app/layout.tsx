import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Konverta - MP4 to MP3 Converter',
  description: 'Fast, secure, and client-side multiple MP4 to MP3 converter.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
