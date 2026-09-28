'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHouse } from '@/context/HouseContext';

interface Roommate {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { activeHouse: house } = useHouse();
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [newRoommateName, setNewRoommateName] = useState('');
  const [roommateError, setRoommateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [newMonth, setNewMonth] = useState('1');
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const fetchRoommates = async (houseId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/roommates?houseId=${houseId}`
      );
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.roommates || [];
        setRoommates(list);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    if (!house) {
      router.push('/select-house');
      return;
    }

    fetchRoommates(house.id).finally(() => setLoading(false));
  }, [house, router]);

  const handleAddRoommate = async (e: FormEvent) => {
    e.preventDefault();
    setRoommateError(null);

    const trimmedName = newRoommateName.trim();
    if (!trimmedName) {
      setRoommateError('El nombre no puede estar vacío');
      return;
    }

    if (!house?.id) return;

    setSubmitting(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/roommates`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ houseId: house.id, house_id: house.id, name: trimmedName }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Error al agregar el conviviente');
      }

      setNewRoommateName('');
      await fetchRoommates(house.id);
    } catch (err: unknown) {
      setRoommateError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  const openCloseModal = () => {
    if (house?.periods?.[0]?.month && house?.periods?.[0]?.year) {
      const curM = house.periods[0].month!;
      const curY = house.periods[0].year!;
      setNewMonth((curM === 12 ? 1 : curM + 1).toString());
      setNewYear((curM === 12 ? curY + 1 : curY).toString());
    }
    setCloseError(null);
    setShowCloseModal(true);
  };

  const handleClosePeriod = async (e: FormEvent) => {
    e.preventDefault();
    setCloseError(null);

    const periodId = house?.periods?.[0]?.id;
    if (!periodId || !house?.id) {
      setCloseError('No se encontró el período activo');
      return;
    }

    setClosing(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/periods/${periodId}/close`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            houseId: house.id,
            newMonth: parseInt(newMonth, 10),
            newYear: parseInt(newYear, 10),
          }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Error al cerrar el período');
      }

      window.location.reload();
    } catch (err: unknown) {
      setCloseError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted">Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line pb-5 gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              {house?.name}
            </h1>
            <p className="mt-1 text-sm text-muted">Panel principal y gestión de convivientes</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/select-house"
              className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
            >
              Cambiar casa
            </Link>
            <Link
              href="/balances"
              className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
            >
              Ver Saldos y Deudas
            </Link>
            <Link
              href="/expenses"
              className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
            >
              Ver Historial de Gastos
            </Link>
            <Link
              href="/expenses/new"
              className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
            >
              Nuevo Gasto
            </Link>
            <button
              type="button"
              onClick={openCloseModal}
              className="inline-flex items-center justify-center rounded-lg bg-neg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-neg focus:ring-offset-2 focus:ring-offset-bg"
            >
              Cerrar mes actual
            </button>
          </div>
        </div>

        {roommates.length < 2 && (
          <div className="rounded-lg border border-warn/20 bg-warn-soft p-4 text-sm font-medium text-warn">
            Debes registrar al menos 2 convivientes para habilitar los gastos
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Formulario Agregar conviviente */}
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
            <h2 className="font-display text-xl font-semibold text-ink">Agregar conviviente</h2>
            <form className="mt-4 space-y-4" onSubmit={handleAddRoommate}>
              <div>
                <label htmlFor="roommateName" className="block text-sm font-semibold text-ink-2">
                  Nombre o alias
                </label>
                <input
                  id="roommateName"
                  name="roommateName"
                  type="text"
                  required
                  value={newRoommateName}
                  onChange={(e) => setNewRoommateName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink transition-colors focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
                  placeholder="Ej. Juan Pérez"
                />
                {roommateError && (
                  <p className="mt-2 text-sm font-medium text-neg">{roommateError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full justify-center rounded-lg border border-transparent bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : 'Agregar conviviente'}
              </button>
            </form>
          </div>

          {/* Lista de convivientes */}
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
            <h2 className="font-display text-xl font-semibold text-ink">
              Convivientes ({roommates.length})
            </h2>
            <div className="mt-4">
              {roommates.length === 0 ? (
                <p className="text-sm text-muted">No hay convivientes registrados aún.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {roommates.map((roommate) => (
                    <li key={roommate.id} className="py-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">{roommate.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {showCloseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card">
              <h3 className="font-display text-lg font-semibold text-ink">Cerrar Período</h3>
              <p className="mt-1 text-sm text-muted">
                Selecciona el mes y año para el próximo período a abrir.
              </p>

              {closeError && (
                <p className="mt-2 text-sm font-medium text-neg">{closeError}</p>
              )}

              <form onSubmit={handleClosePeriod} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="closeMonth" className="block text-sm font-semibold text-ink-2">
                    Mes
                  </label>
                  <select
                    id="closeMonth"
                    value={newMonth}
                    onChange={(e) => setNewMonth(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink transition-colors focus:border-neg focus:outline-hidden focus:ring-2 focus:ring-neg/25 sm:text-sm"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="closeYear" className="block text-sm font-semibold text-ink-2">
                    Año
                  </label>
                  <input
                    id="closeYear"
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink transition-colors focus:border-neg focus:outline-hidden focus:ring-2 focus:ring-neg/25 sm:text-sm"
                    required
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCloseModal(false)}
                    disabled={closing}
                    className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 focus:outline-hidden focus:ring-2 focus:ring-line-strong focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={closing}
                    className="rounded-lg bg-neg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-neg focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50"
                  >
                    {closing ? 'Cerrando...' : 'Confirmar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}