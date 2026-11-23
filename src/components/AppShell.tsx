'use client';

import { useEffect, useState, FormEvent, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHouse } from '@/context/HouseContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PUBLIC_ROUTES = ['/', '/login', '/register', '/join', '/setup', '/select-house'];

const NAV_ITEMS = [
  { label: 'Inicio', href: '/dashboard', match: ['/dashboard'] },
  { label: 'Convivientes', href: '/roommates', match: ['/roommates'] },
  { label: 'Gastos', href: '/expenses', match: ['/expenses'] },
  { label: 'Saldos y pagos', href: '/balances', match: ['/balances', '/payments'] },
  { label: 'Tareas', href: '/tasks', match: ['/tasks'] },
];

const isActive = (pathname: string, match: string[]) =>
  match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    activeHouse,
    selectedPeriod,
    refreshHouseData,
    clearSession,
    houseMissing,
    setHouseMissing,
  } = useHouse();

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const [authorized, setAuthorized] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [newMonth, setNewMonth] = useState('1');
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isPublic) {
      setAuthorized(false);
      return;
    }
    if (houseMissing) {
      setAuthorized(false);
      setHouseMissing(false);
      sessionStorage.setItem('houseRemovedNotice', 'Esta casa ya no existe');
      router.replace('/select-house');
      return;
    }
    if (!localStorage.getItem('userId')) {
      setAuthorized(false);
      router.replace('/login');
      return;
    }
    if (!localStorage.getItem('activeHouseId')) {
      setAuthorized(false);
      router.replace('/select-house');
      return;
    }
    setAuthorized(true);
  }, [pathname, isPublic, router, houseMissing, setHouseMissing]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (isPublic) return <>{children}</>;
  if (!authorized) return null;

  const periodLabel = selectedPeriod
    ? `${String(selectedPeriod.month ?? '--').padStart(2, '0')}/${selectedPeriod.year} · ${
        selectedPeriod.is_closed ? 'Cerrado' : 'Abierto'
      }`
    : 'Sin período';
  const canClose = !!selectedPeriod && !selectedPeriod.is_closed;

  const openCloseModal = () => {
    if (!canClose || !selectedPeriod) return;
    if (selectedPeriod.month && selectedPeriod.year) {
      const m = selectedPeriod.month;
      setNewMonth((m === 12 ? 1 : m + 1).toString());
      setNewYear((m === 12 ? selectedPeriod.year + 1 : selectedPeriod.year).toString());
    }
    setCloseError(null);
    setDrawerOpen(false);
    setShowCloseModal(true);
  };

  const handleClosePeriod = async (e: FormEvent) => {
    e.preventDefault();
    if (!canClose || !selectedPeriod || !activeHouse?.id) return;
    setClosing(true);
    setCloseError(null);
    try {
      const res = await fetch(`${API}/api/periods/${selectedPeriod.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          houseId: activeHouse.id,
          newMonth: parseInt(newMonth, 10),
          newYear: parseInt(newYear, 10),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Error al cerrar el período');
      }
      await refreshHouseData(true);
      setShowCloseModal(false);
    } catch (err) {
      setCloseError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
    } finally {
      setClosing(false);
    }
  };

  const handleLogout = () => {
    ['userId', 'userEmail', 'userName', 'activeHouseId', 'activePeriodId'].forEach((k) =>
      localStorage.removeItem(k)
    );
    clearSession();
    router.replace('/login');
  };

  const itemBase =
    'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors';

  const menu = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.match);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setDrawerOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`${itemBase} ${
              active ? 'bg-brand text-brand-ink' : 'text-ink-2 hover:bg-surface-2'
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={openCloseModal}
        disabled={!canClose}
        title={canClose ? undefined : 'Solo disponible en el período abierto'}
        className={`${itemBase} ${
          canClose ? 'text-neg hover:bg-neg-soft' : 'cursor-not-allowed text-muted opacity-50'
        }`}
      >
        Cerrar mes
      </button>

      <div className="mt-auto space-y-1 border-t border-line pt-3">
        <Link
          href="/select-house"
          onClick={() => setDrawerOpen(false)}
          className={`${itemBase} text-ink-2 hover:bg-surface-2`}
        >
          Cambiar de casa
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className={`${itemBase} text-ink-2 hover:bg-surface-2`}
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  );

  const header = (
    <div className="mb-4 border-b border-line pb-4">
      <p className="font-display text-lg font-semibold text-ink">{activeHouse?.name || 'Casa'}</p>
      <p className="mt-0.5 text-xs font-medium text-muted">{periodLabel}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg md:flex">
      {/* Barra lateral (md+) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface p-4 md:flex">
        {header}
        {menu}
      </aside>

      {/* Barra superior (móvil) */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-ink">
            {activeHouse?.name || 'Casa'}
          </p>
          <p className="text-xs font-medium text-muted">{periodLabel}</p>
        </div>
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg border border-line p-2 text-ink hover:bg-surface-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </header>

      {/* Cajón (móvil) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface p-4 shadow-card">
            {header}
            {menu}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 pt-16 md:ml-64 md:pt-0">{children}</main>

      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card">
            <h3 className="font-display text-lg font-semibold text-ink">Cerrar mes</h3>
            <p className="mt-1 text-sm text-muted">
              Seleccioná el mes y año del próximo período a abrir.
            </p>
            {closeError && <p className="mt-2 text-sm font-medium text-neg">{closeError}</p>}
            <form onSubmit={handleClosePeriod} className="mt-4 space-y-4">
              <div>
                <label htmlFor="shellCloseMonth" className="block text-sm font-semibold text-ink-2">
                  Mes
                </label>
                <select
                  id="shellCloseMonth"
                  value={newMonth}
                  onChange={(e) => setNewMonth(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="shellCloseYear" className="block text-sm font-semibold text-ink-2">
                  Año
                </label>
                <input
                  id="shellCloseYear"
                  type="number"
                  required
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  disabled={closing}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={closing}
                  className="rounded-lg bg-neg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {closing ? 'Cerrando...' : 'Cerrar mes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
