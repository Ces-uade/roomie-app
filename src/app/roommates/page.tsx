'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useHouse, Roommate } from '@/context/HouseContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RoommatesPage() {
  const router = useRouter();
  const {
    activeHouse: house,
    roommates: contextRoommates,
    selectedPeriod,
    setRoommates: setContextRoommates,
    addRoommate,
    refreshHouseData,
  } = useHouse();
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [newRoommateName, setNewRoommateName] = useState('');
  const [roommateError, setRoommateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [invite, setInvite] = useState<{ code: string; link: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  // Estados de eliminación
  const [targetRoommate, setTargetRoommate] = useState<Roommate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
  const isHouseOwner = Boolean(
    house?.owner_id && currentUserId && house.owner_id === currentUserId
  );
  const isOpenPeriod = Boolean(selectedPeriod && !selectedPeriod.is_closed);

  const handleShareInvite = async () => {
    if (!house?.id) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      const res = await fetch(`${API}/api/houses/${house.id}/invite`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.code) {
        throw new Error(data?.message || data?.error || 'No se pudo generar la invitación');
      }
      setInvite({ code: data.code, link: `${window.location.origin}/join?code=${data.code}` });
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setInviteLoading(false);
    }
  };

  const copyText = async (text: string, kind: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setInviteError('No se pudo copiar al portapapeles');
    }
  };

  const fetchRoommates = async (houseId: string) => {
    try {
      const res = await fetch(`${API}/api/roommates?houseId=${houseId}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.roommates || [];
        setRoommates(list);
        setContextRoommates(list);
      }
    } catch {
      // ignore
    }
  };

  const houseId = house?.id;

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    const storedHouseId = localStorage.getItem('activeHouseId');
    if (!houseId && !storedHouseId) {
      router.push('/select-house');
      return;
    }

    const targetId = houseId || storedHouseId;
    if (targetId) {
      fetchRoommates(targetId).finally(() => setLoading(false));
    }
  }, [houseId, router]);

  useEffect(() => {
    if (contextRoommates && contextRoommates.length > 0) {
      setRoommates(contextRoommates);
    }
  }, [contextRoommates]);

  const handleAddRoommate = async (e: FormEvent) => {
    e.preventDefault();
    setRoommateError(null);

    const trimmedName = newRoommateName.trim();
    if (!trimmedName) {
      setRoommateError('El nombre no puede estar vacío');
      return;
    }

    const normalizedInputName = trimmedName.toLowerCase();
    const isDuplicate = roommates.some(
      (rm) => rm.name && rm.name.trim().toLowerCase() === normalizedInputName
    );

    if (isDuplicate) {
      setRoommateError('Ya existe un conviviente con ese nombre o alias');
      return;
    }

    if (!house?.id) return;

    setSubmitting(true);

    try {
      const res = await fetch(`${API}/api/roommates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ houseId: house.id, house_id: house.id, name: trimmedName }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = data?.message || data?.error;
        if (
          res.status === 400 &&
          (errorMsg === 'Ya existe un conviviente con ese nombre o alias' ||
            /duplicad|ya existe/i.test(errorMsg || ''))
        ) {
          throw new Error('Ya existe un conviviente con ese nombre o alias');
        }
        throw new Error(errorMsg || 'Error al agregar el conviviente');
      }

      if (data && data.id) {
        addRoommate({ id: data.id, name: trimmedName, house_id: house.id });
      }

      setNewRoommateName('');
      await fetchRoommates(house.id);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (/ya existe un conviviente|duplicad/i.test(err.message)) {
          setRoommateError('Ya existe un conviviente con ese nombre o alias');
        } else {
          setRoommateError(err.message);
        }
      } else {
        setRoommateError('Ocurrió un error inesperado');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (rm: Roommate) => {
    setTargetRoommate(rm);
    setDeleteError(null);
  };

  const handleCloseDeleteModal = () => {
    if (deleting) return;
    setTargetRoommate(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!targetRoommate || !currentUserId) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(
        `${API}/api/roommates/${targetRoommate.id}?userId=${encodeURIComponent(currentUserId)}`,
        {
          method: 'DELETE',
          headers: {
            'x-user-id': currentUserId,
          },
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error || data?.message || 'Error al eliminar el conviviente';
        setDeleteError(msg);
        return;
      }

      const deletedName = targetRoommate.name;
      setTargetRoommate(null);
      setDeleteSuccess(`Se eliminó a ${deletedName} de la casa`);
      setTimeout(() => setDeleteSuccess(null), 4000);

      await refreshHouseData();
      if (house?.id) {
        await fetchRoommates(house.id);
      }
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted">Cargando convivientes...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="border-b border-line pb-5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
            Convivientes
          </h1>
          <p className="mt-1 text-sm text-muted">
            Gestioná los miembros de la casa y compartí invitaciones.
          </p>
        </div>

        {deleteSuccess && (
          <div className="rounded-lg border border-brand/20 bg-brand-soft p-4 text-sm font-medium text-brand">
            {deleteSuccess}
          </div>
        )}

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
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-ink">
                Convivientes ({roommates.length})
              </h2>
              <button
                type="button"
                onClick={handleShareInvite}
                disabled={inviteLoading}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                {inviteLoading ? 'Generando...' : 'Compartir invitación'}
              </button>
            </div>
            {inviteError && <p className="mt-3 text-sm font-medium text-neg">{inviteError}</p>}
            {invite && (
              <div className="mt-4 space-y-3 rounded-lg border border-line bg-bg p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="break-all text-ink-2">
                    Código: <strong className="text-ink">{invite.code}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(invite.code, 'code')}
                    className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-brand-ink hover:brightness-110"
                  >
                    {copied === 'code' ? 'Copiado' : 'Copiar código'}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-ink-2">Link: {invite.link}</span>
                  <button
                    type="button"
                    onClick={() => copyText(invite.link, 'link')}
                    className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-brand-ink hover:brightness-110"
                  >
                    {copied === 'link' ? 'Copiado' : 'Copiar link'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-bg">
              {roommates.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted">
                  No hay convivientes registrados aún.
                </p>
              ) : (
                roommates.map((rm) => {
                  const canDelete =
                    isHouseOwner &&
                    isOpenPeriod &&
                    !rm.is_owner &&
                    rm.user_id !== house?.owner_id;

                  return (
                    <div key={rm.id} className="flex items-center justify-between p-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-ink truncate">{rm.name}</span>
                        {rm.is_owner ? (
                          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                            Creador
                          </span>
                        ) : (
                          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink-2">
                            Activo
                          </span>
                        )}
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(rm)}
                          className="rounded-lg border border-neg/30 px-2.5 py-1 text-xs font-semibold text-neg transition hover:bg-neg-soft"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal de confirmación de eliminación */}
        {targetRoommate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card">
              <h3 className="font-display text-lg font-semibold text-ink">
                ¿Eliminar a {targetRoommate.name} de la casa?
              </h3>
              {deleteError && (
                <p className="mt-2 text-sm font-medium text-neg">{deleteError}</p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseDeleteModal}
                  disabled={deleting}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="rounded-lg bg-neg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {deleting ? 'Eliminando...' : 'Confirmar eliminación'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

