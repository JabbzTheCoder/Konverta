import FileConverter from '@/components/FileConverter';

export default function Home() {
  return (
    <main className="container">
      <h1> Gajie's Konverta</h1>
      <p className="subtitle">Convert MP4 videos to MP3 audio instantly on your device. Secure & fast.</p>

      <div className="glass-card">
        <FileConverter />
      </div>
    </main>
  );
}
