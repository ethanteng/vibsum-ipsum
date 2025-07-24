import { SessionProvider, useSession } from 'next-auth/react';
import '../styles/globals.css';
import { useEffect } from 'react';

function IngestionOnLogin() {
  const { data: session, status } = useSession();
  useEffect(() => {
    if (status === 'authenticated') {
      // Fire and forget, do not block UI
      fetch('/api/admin/ingest', { method: 'POST' });
    }
  }, [status]);
  return null;
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <IngestionOnLogin />
      <Component {...pageProps} />
    </SessionProvider>
  );
}