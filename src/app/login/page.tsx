'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite') || params.get('code');
    if (invite) localStorage.setItem('pendingInviteCode', invite);
    if (localStorage.getItem('pendingInviteCode')) {
      setInfo('Inicia sesión o crea tu cuenta para unirte a la casa.');
    }
  }, []);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || 'Error al iniciar sesión');
      }

      const userId = data?.userId || data?.user?.id || data?.id;
      if (userId) {
        localStorage.setItem('userId', userId);
      }
      const userEmail = data?.email || data?.user?.email || email;
      const userName = data?.name || data?.user?.name || '';
      localStorage.setItem('userEmail', userEmail);
      localStorage.setItem('userName', userName);

      const pending = localStorage.getItem('pendingInviteCode');
      if (pending) {
        router.push(`/select-house?code=${encodeURIComponent(pending)}`);
        return;
      }

      const housesRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/houses/mine?userId=${userId}`
      ).catch(() => null);
      const housesData = housesRes && housesRes.ok ? await housesRes.json().catch(() => null) : null;
      const housesList = Array.isArray(housesData) ? housesData : housesData ? [housesData] : [];
      router.push(housesRes && housesRes.ok && housesList.length === 0 ? '/setup' : '/select-house');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-line bg-surface p-8 shadow-card">
        <div>
          <h2 className="text-center font-display text-3xl font-semibold tracking-tight text-ink">Iniciar sesión</h2>
        </div>
        {info && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-ink-2 text-center">{info}</p>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-ink-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink transition-colors focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-ink-2">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink transition-colors focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-neg-soft px-3 py-2 text-sm font-medium text-neg text-center">{error}</p>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-lg border border-transparent bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>

          <div className="text-center text-sm text-muted">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="font-semibold text-brand underline-offset-4 hover:underline">
              Regístrate
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}