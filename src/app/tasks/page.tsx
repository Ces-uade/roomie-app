'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { House, Roommate } from '@/context/HouseContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Task {
  id: string;
  house_id: string;
  name: string;
  frequency: 'diaria' | 'semanal' | 'quincenal' | 'mensual';
  roommate_ids: string[];
  current_index: number;
  current_assignee: { id: string; name: string } | null;
  next_due_date: string;
  is_overdue: boolean;
}

const FREQUENCY_OPTIONS = [
  { value: 'diaria', label: 'Diaria' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
];

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return dateStr;
};

const getTodayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function TasksPage() {
  const router = useRouter();
  const [house, setHouse] = useState<House | null>(null);
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Acciones en tareas
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Modal nueva tarea
  const [showModal, setShowModal] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [frequency, setFrequency] = useState('semanal');
  const [selectedRoommateIds, setSelectedRoommateIds] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchTasks = useCallback(async (houseId: string) => {
    try {
      const res = await fetch(`${API}/api/tasks?houseId=${houseId}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    const init = async () => {
      try {
        const houseRes = await fetch(`${API}/api/houses/mine?userId=${userId}`);
        if (!houseRes.ok) {
          router.push('/select-house');
          return;
        }

        const activeId = localStorage.getItem('activeHouseId');
        if (!activeId) {
          router.push('/select-house');
          return;
        }

        const data = await houseRes.json().catch(() => null);
        const list: House[] = Array.isArray(data) ? data : data?.house ? [data.house] : data ? [data] : [];
        const houseData = list.find((h) => h.id === activeId);
        if (!houseData || !houseData.id) {
          router.push('/select-house');
          return;
        }

        setHouse(houseData);

        // Fetch Roommates
        const rmRes = await fetch(`${API}/api/roommates?houseId=${houseData.id}`).catch(() => null);
        let rmList: Roommate[] = [];
        if (rmRes && rmRes.ok) {
          const rmData = await rmRes.json().catch(() => null);
          rmList = Array.isArray(rmData) ? rmData : rmData?.roommates || [];
        } else if (Array.isArray(houseData.roommates)) {
          rmList = houseData.roommates;
        }
        setRoommates(rmList);

        // Fetch Tasks
        await fetchTasks(houseData.id);
      } catch {
        router.push('/select-house');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router, fetchTasks]);

  const handleOpenModal = () => {
    if (roommates.length < 2) {
      setPageError('Se necesitan al menos 2 convivientes en la casa para crear tareas.');
      return;
    }
    setPageError(null);
    setTaskName('');
    setFrequency('semanal');
    setSelectedRoommateIds(roommates.map((r) => r.id));
    setModalError(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setTaskName('');
    setFrequency('semanal');
    setSelectedRoommateIds([]);
    setModalError(null);
  };

  const toggleRoommate = (id: string) => {
    setSelectedRoommateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!house?.id) return;

    const trimmed = taskName.trim();
    if (trimmed.length < 1 || trimmed.length > 60) {
      setModalError('El nombre de la tarea debe tener entre 1 y 60 caracteres.');
      return;
    }

    if (!frequency) {
      setModalError('Debes seleccionar una frecuencia.');
      return;
    }

    if (selectedRoommateIds.length < 2) {
      setModalError('Debes seleccionar al menos dos convivientes para la rotación.');
      return;
    }

    setCreating(true);
    setModalError(null);

    try {
      const res = await fetch(`${API}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          houseId: house.id,
          name: trimmed,
          frequency,
          roommateIds: selectedRoommateIds,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Error al crear la tarea');
      }

      setTasks((prev) => [...prev, data]);
      handleCloseModal();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error al crear la tarea');
    } finally {
      setCreating(false);
    }
  };

  const handleComplete = async (task: Task) => {
    if (completingId) return;
    setCompletingId(task.id);
    try {
      const res = await fetch(`${API}/api/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedIndex: task.current_index }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      }
    } catch {
      // ignore
    } finally {
      setCompletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted">Cargando tareas...</p>
      </div>
    );
  }

  const today = getTodayStr();

  return (
    <div className="min-h-screen bg-bg py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
                {house?.name || 'Tareas'}
              </h1>
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
              >
                ← Volver al Dashboard
              </Link>
              <Link
                href="/select-house"
                className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
              >
                Cambiar de casa
              </Link>
            </div>
            <p className="mt-1 text-sm text-muted">Gestión y rotación de tareas del hogar</p>
          </div>

          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
          >
            + Nueva tarea
          </button>
        </div>

        {/* Aviso de error o falta de convivientes */}
        {pageError && (
          <div className="rounded-lg border border-warn/20 bg-warn-soft p-4 text-sm font-medium text-warn">
            {pageError}
          </div>
        )}

        {roommates.length < 2 && !pageError && (
          <div className="rounded-lg border border-warn/20 bg-warn-soft p-4 text-sm font-medium text-warn">
            Se necesitan al menos 2 convivientes en la casa para organizar y crear tareas.
          </div>
        )}

        {/* Listado de tareas */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h2 className="font-display text-xl font-semibold text-ink">Tareas del hogar</h2>

          {tasks.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No hay tareas creadas aún en esta casa.</p>
          ) : (
            <div className="mt-4 divide-y divide-line">
              {tasks.map((task) => {
                const isOverdue = task.is_overdue || (!!task.next_due_date && task.next_due_date < today);
                const isCompleting = completingId === task.id;

                return (
                  <div
                    key={task.id}
                    className={`py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors ${
                      isOverdue ? 'rounded-xl border border-neg/30 bg-neg-soft/30 px-4 my-2' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink text-base">{task.name}</span>
                        {isOverdue && (
                          <span className="rounded-full bg-neg-soft px-2.5 py-0.5 text-xs font-semibold text-neg border border-neg/20">
                            Vencida
                          </span>
                        )}
                        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted capitalize">
                          {task.frequency}
                        </span>
                      </div>

                      <div className="text-sm text-ink-2">
                        <span>A cargo:{' '}</span>
                        <strong className="text-ink">
                          {task.current_assignee?.name || 'Sin asignar'}
                        </strong>
                      </div>

                      <div className="text-xs text-muted">
                        Próxima fecha: {formatDate(task.next_due_date)}
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => handleComplete(task)}
                        disabled={isCompleting}
                        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition hover:brightness-110 disabled:opacity-50"
                      >
                        {isCompleting ? 'Guardando...' : 'Marcar como hecha'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Nueva Tarea */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card space-y-5">
            <h2 className="font-display text-xl font-semibold text-ink">Nueva tarea</h2>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label htmlFor="taskName" className="block text-sm font-semibold text-ink-2">
                  Nombre de la tarea
                </label>
                <input
                  id="taskName"
                  type="text"
                  required
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="Ej. Sacar la basura"
                  maxLength={60}
                  className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="frequency" className="block text-sm font-semibold text-ink-2">
                  Frecuencia
                </label>
                <select
                  id="frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-sm font-semibold text-ink-2">
                  Convivientes incluidos en la rotación (mínimo 2)
                </span>
                <div className="mt-2 max-h-40 overflow-y-auto space-y-2 rounded-lg border border-line bg-bg p-3">
                  {roommates.map((rm) => (
                    <label
                      key={rm.id}
                      className="flex items-center gap-2 cursor-pointer text-sm text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoommateIds.includes(rm.id)}
                        onChange={() => toggleRoommate(rm.id)}
                        className="rounded border-line text-brand focus:ring-brand"
                      />
                      <span>{rm.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {modalError && (
                <p className="rounded-lg bg-neg-soft px-3 py-2 text-sm font-medium text-neg text-center">
                  {modalError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={creating}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition hover:brightness-110 disabled:opacity-50"
                >
                  {creating ? 'Guardando...' : 'Crear tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
