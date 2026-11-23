'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useHouse, Roommate } from '@/context/HouseContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RoommatesPage() {
  const router = useRouter();
  const { activeHouse: house, roommates: contextRoommates, setRoommates: setContextRoommates, addRoommate } = useHouse();
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [newRoommateName, setNewRoommateName] = useState('');
  const [roommateError, setRoommateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [invite, setInvite] = useState<{ code: string; link: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

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
                roommates.map((rm) => (
                  <div key={rm.id} className="flex items-center justify-between p-3">
                    <span className="font-medium text-ink">{rm.name}</span>
                    <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                      Activo
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
