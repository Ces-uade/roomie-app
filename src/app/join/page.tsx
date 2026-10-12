'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('invite');
    if (code) localStorage.setItem('pendingInviteCode', code);

    if (!localStorage.getItem('userId')) {
      router.replace('/login');
      return;
    }
    router.replace(code ? `/select-house?code=${encodeURIComponent(code)}` : '/select-house');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <p className="text-muted">Procesando invitación...</p>
    </div>
  );
}
