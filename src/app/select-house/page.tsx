'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHouse, House } from '@/context/HouseContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function extractCode(raw: string): string {
  const value = raw.trim();
  try {
    const url = new URL(value);
    return url.searchParams.get('code') || url.searchParams.get('invite') || value;
  } catch {
    const m = value.match(/[?&](?:code|invite)=([^&\s]+)/);
    return m ? decodeURIComponent(m[1]) : value;
  }
}

export default function SelectHousePage() {
  const router = useRouter();
  const { setActiveHouse, clearSession } = useHouse();
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [removedNotice, setRemovedNotice] = useState<string | null>(null);

  // Unirse
  const [showJoin, setShowJoin] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Modal Eliminar casa
  const [deleteHouseTarget, setDeleteHouseTarget] = useState<House | null>(null);
  const [deleteInfoLoading, setDeleteInfoLoading] = useState(false);
  const [hasPendingDebts, setHasPendingDebts] = useState(false);
  const [confirmHouseName, setConfirmHouseName] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modal Salir de la casa
  const [leaveHouseTarget, setLeaveHouseTarget] = useState<House | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;

  const fetchHouses = useCallback(async (userId: string): Promise<House[] | null> => {
    try {
      const res = await fetch(`${API}/api/houses/mine?userId=${userId}`);
      if (!res.ok) {
        setError('Error al cargar las casas');
        return null;
      }
      const data = await res.json().catch(() => null);
      const list: House[] = Array.isArray(data) ? data : data ? [data] : [];
      setHouses(list);
      return list;
    } catch {
      setError('Error de conexión');
      return null;
    }
  }, []);

  const joinWithCode = useCallback(
    async (rawCode: string) => {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        router.push('/login');
        return;
      }
      const code = extractCode(rawCode);
      if (!code) {
        setJoinError('Ingresá un código o enlace de invitación.');
        return;
      }
      setJoining(true);
      setJoinError(null);
      setSuccess(null);
      try {
        const res = await fetch(`${API}/api/houses/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            userId,
            userName: localStorage.getItem('userName') || '',
            userEmail: localStorage.getItem('userEmail') || '',
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setJoinError(
            data?.message || data?.error || 'El código o enlace de invitación es inválido o ha expirado'
          );
          setShowJoin(true);
          return;
        }
        localStorage.removeItem('pendingInviteCode');
        await fetchHouses(userId);
        const joinedName = data?.house?.name || data?.name;
        setSuccess(
          joinedName
            ? `Te uniste a la casa "${joinedName}" correctamente.`
            : 'Te uniste a la casa correctamente.'
        );
        setShowJoin(false);
        setJoinInput('');
      } catch {
        setJoinError('Error de conexión');
        setShowJoin(true);
      } finally {
        setJoining(false);
      }
    },
    [fetchHouses, router]
  );

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    // Criterio 9: Leer aviso de casa eliminada si existe
    const notice = sessionStorage.getItem('houseRemovedNotice');
    if (notice) {
      setRemovedNotice(notice);
      sessionStorage.removeItem('houseRemovedNotice');
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('invite') || localStorage.getItem('pendingInviteCode');

    const init = async () => {
      const list = await fetchHouses(userId);
      if (code) {
        await joinWithCode(code);
        window.history.replaceState(null, '', '/select-house');
      } else if (list && list.length === 0 && !notice) {
        router.push('/setup');
        return;
      }
      setLoading(false);
    };

    init();
  }, [router, fetchHouses, joinWithCode]);

  const handleSelectHouse = (house: House) => {
    localStorage.setItem('activeHouseId', house.id);
    setActiveHouse(house);
    router.push('/dashboard');
  };

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    joinWithCode(joinInput);
  };

  // Abrir modal Eliminar casa
  const openDeleteModal = async (e: React.MouseEvent, house: House) => {
    e.stopPropagation();
    setDeleteHouseTarget(house);
    setConfirmHouseName('');
    setDeleteError(null);
    setHasPendingDebts(false);
    setDeleteInfoLoading(true);

    try {
      const res = await fetch(
        `${API}/api/houses/${house.id}/delete-info?userId=${encodeURIComponent(currentUserId || '')}`
      );
      if (res.ok) {
        const info = await res.json().catch(() => null);
        if (info?.hasPendingDebts) {
          setHasPendingDebts(true);
        }
      }
    } catch {
      // ignore
    } finally {
      setDeleteInfoLoading(false);
    }
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteHouseTarget(null);
    setConfirmHouseName('');
    setDeleteError(null);
  };

  const handleConfirmDeleteHouse = async () => {
    if (!deleteHouseTarget || !currentUserId) return;
    if (confirmHouseName.trim() !== deleteHouseTarget.name.trim()) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(
        `${API}/api/houses/${deleteHouseTarget.id}?userId=${encodeURIComponent(currentUserId)}`,
        {
          method: 'DELETE',
          headers: {
            'x-user-id': currentUserId,
          },
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setDeleteError(data?.error || data?.message || 'Error al eliminar la casa');
        return;
      }

      // Criterio 15: Limpiar de localStorage si era la activa
      if (localStorage.getItem('activeHouseId') === deleteHouseTarget.id) {
        localStorage.removeItem('activeHouseId');
        localStorage.removeItem('activePeriodId');
        setActiveHouse(null);
      }

      const updatedList = houses.filter((h) => h.id !== deleteHouseTarget.id);
      setHouses(updatedList);
      setDeleteHouseTarget(null);

      // Criterio 7: Si queda vacía, redirigir a /setup
      if (updatedList.length === 0) {
        router.push('/setup');
      }
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
    } finally {
      setDeleting(false);
    }
  };

  // Abrir modal Salir de la casa
  const openLeaveModal = (e: React.MouseEvent, house: House) => {
    e.stopPropagation();
    setLeaveHouseTarget(house);
    setLeaveError(null);
  };

  const closeLeaveModal = () => {
    if (leaving) return;
    setLeaveHouseTarget(null);
    setLeaveError(null);
  };

  const handleConfirmLeaveHouse = async () => {
    if (!leaveHouseTarget || !currentUserId) return;

    setLeaving(true);
    setLeaveError(null);

    try {
      const res = await fetch(`${API}/api/houses/${leaveHouseTarget.id}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({ userId: currentUserId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setLeaveError(data?.error || data?.message || 'Error al salir de la casa');
        return;
      }

      // Criterio 15: Limpiar si era la activa
      if (localStorage.getItem('activeHouseId') === leaveHouseTarget.id) {
        localStorage.removeItem('activeHouseId');
        localStorage.removeItem('activePeriodId');
        setActiveHouse(null);
      }

      const updatedList = houses.filter((h) => h.id !== leaveHouseTarget.id);
      setHouses(updatedList);
      setLeaveHouseTarget(null);

      // Criterio 7: Redirigir a /setup si no quedan casas
      if (updatedList.length === 0) {
        router.push('/setup');
      }
    } catch (err: unknown) {
      setLeaveError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
    } finally {
      setLeaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted">Cargando casas...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8">
        <div>
          <h1 className="text-center font-display text-3xl font-semibold tracking-tight text-ink">
            Mis casas
          </h1>
          <p className="mt-2 text-center text-sm text-muted">
            Elegí una casa para continuar, creá una nueva o unite con un código
          </p>
        </div>

        {removedNotice && (
          <div className="rounded-xl border border-warn/30 bg-warn-soft p-4 text-center text-sm font-medium text-warn">
            {removedNotice}
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-neg-soft px-3 py-2 text-sm font-medium text-neg text-center">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-ink-2 text-center">
            {success}
          </p>
        )}

        {houses.length === 0 && !error ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-card space-y-4">
            <p className="text-sm text-muted">No tenés casas registradas todavía.</p>
            <div className="flex flex-col gap-2">
              <Link
                href="/setup"
                className="flex w-full justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:brightness-110"
              >
                Crear una casa
              </Link>
              <button
                type="button"
                onClick={() => setShowJoin(true)}
                className="flex w-full justify-center rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-2"
              >
                Unirme a una casa
              </button>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {houses.map((house) => {
              const period = house.periods?.find((p) => !p.is_closed) || house.periods?.[0];
              const isOwner = Boolean(
                house.owner_id && currentUserId && house.owner_id === currentUserId
              );

              return (
                <li
                  key={house.id}
                  onClick={() => handleSelectHouse(house)}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card cursor-pointer transition hover:border-brand/40"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-semibold text-ink truncate">
                      {house.name}
                    </span>
                    {period?.month && period?.year && (
                      <span className="mt-1 block text-sm text-muted">
                        Período abierto: {String(period.month).padStart(2, '0')}/{period.year}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOwner ? (
                      <button
                        type="button"
                        onClick={(e) => openDeleteModal(e, house)}
                        className="rounded-lg border border-neg/30 px-3 py-1.5 text-xs font-semibold text-neg transition hover:bg-neg-soft"
                      >
                        Eliminar casa
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => openLeaveModal(e, house)}
                        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 transition hover:bg-surface-2"
                      >
                        Salir de la casa
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectHouse(house);
                      }}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
                    >
                      Ingresar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-3 pt-2">
          <Link
            href="/setup"
            className="flex w-full justify-center rounded-lg border border-transparent bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
          >
            Crear nueva casa
          </Link>
          <button
            type="button"
            onClick={() => setShowJoin((v) => !v)}
            className="flex w-full justify-center rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-2"
          >
            Unirme a una casa
          </button>
        </div>

        {showJoin && (
          <form
            onSubmit={handleJoinSubmit}
            className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-card"
          >
            <label htmlFor="inviteCode" className="block text-sm font-semibold text-ink-2">
              Código o enlace de invitación
            </label>
            <input
              id="inviteCode"
              type="text"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="Pegá el código o el enlace completo"
              className="block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink transition-colors focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
            />
            {joinError && (
              <p className="rounded-lg bg-neg-soft px-3 py-2 text-sm font-medium text-neg text-center">
                {joinError}
              </p>
            )}
            <button
              type="submit"
              disabled={joining}
              className="flex w-full justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:brightness-110 disabled:opacity-50"
            >
              {joining ? 'Uniéndome...' : 'Unirme'}
            </button>
          </form>
        )}

        {/* Modal Eliminar Casa */}
        {deleteHouseTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card space-y-4">
              <h3 className="font-display text-lg font-semibold text-ink">
                Eliminar casa &quot;{deleteHouseTarget.name}&quot;
              </h3>

              <div className="rounded-lg border border-neg/20 bg-neg-soft p-3 text-sm text-neg">
                Esta acción es irreversible y se perderán todos los datos de la casa (convivientes,
                períodos, gastos, pagos y tareas).
              </div>

              {hasPendingDebts && (
                <div className="rounded-lg border border-warn/30 bg-warn-soft p-3 text-sm font-medium text-warn">
                  Aviso: esta casa tiene deudas pendientes.
                </div>
              )}

              {deleteError && (
                <p className="text-sm font-medium text-neg">{deleteError}</p>
              )}

              <div>
                <label
                  htmlFor="confirmHouseNameInput"
                  className="block text-sm font-semibold text-ink-2 mb-1"
                >
                  Escribí el nombre de la casa para confirmar:
                </label>
                <input
                  id="confirmHouseNameInput"
                  type="text"
                  value={confirmHouseName}
                  onChange={(e) => setConfirmHouseName(e.target.value)}
                  placeholder={deleteHouseTarget.name}
                  className="block w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink transition-colors focus:border-neg focus:outline-hidden focus:ring-2 focus:ring-neg/25 sm:text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={deleting}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteHouse}
                  disabled={
                    deleting ||
                    deleteInfoLoading ||
                    confirmHouseName.trim() !== deleteHouseTarget.name.trim()
                  }
                  className="rounded-lg bg-neg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Salir de la Casa */}
        {leaveHouseTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card space-y-4">
              <h3 className="font-display text-lg font-semibold text-ink">
                Salir de &quot;{leaveHouseTarget.name}&quot;
              </h3>

              <p className="text-sm text-ink-2">
                ¿Estás seguro de que querés salir de la casa &quot;{leaveHouseTarget.name}&quot;?
              </p>

              {leaveError && (
                <div className="rounded-lg border border-neg/20 bg-neg-soft p-3 text-sm font-medium text-neg">
                  {leaveError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeLeaveModal}
                  disabled={leaving}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLeaveHouse}
                  disabled={leaving}
                  className="rounded-lg bg-neg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {leaving ? 'Saliendo...' : 'Confirmar salida'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

