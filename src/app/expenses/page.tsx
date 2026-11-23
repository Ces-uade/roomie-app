'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHouse } from '@/context/HouseContext';

interface Split {
  id: string;
  roommate_id: string;
  amount: number;
  roommates?: { name: string; is_active?: boolean } | { name: string; is_active?: boolean }[];
}

interface Expense {
  id: string;
  period_id: string;
  paid_by: string;
  concept: string;
  amount: number;
  date: string;
  category?: string;
  roommates?: { name: string; is_active?: boolean } | { name: string; is_active?: boolean }[];
  expense_splits?: Split[];
}

interface Period {
  id: string;
  month?: number;
  year?: number;
  is_closed?: boolean;
  created_at?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ExpensesPage() {
  const router = useRouter();
  const {
    activeHouse,
    periods: contextPeriods,
    roommates: contextRoommates,
    selectedPeriodId: contextPeriodId,
    setSelectedPeriodId: setContextPeriodId,
  } = useHouse();
  const [activeId, setActiveId] = useState<string | null>(
    () => activeHouse?.id || (typeof window !== 'undefined' ? localStorage.getItem('activeHouseId') : null)
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [houseRoommates, setHouseRoommates] = useState<{ id: string; name: string; is_active?: boolean }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [expandedExpenses, setExpandedExpenses] = useState<Record<string, boolean>>({});
  const [periods, setPeriods] = useState<Period[]>(contextPeriods || []);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(contextPeriodId || '');

  // Estado para modal Editar Gasto
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editConcept, setEditConcept] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCategory, setEditCategory] = useState('Otro');
  const [editParticipants, setEditParticipants] = useState<string[]>([]);
  const [editAvailableRoommates, setEditAvailableRoommates] = useState<{ id: string; name: string; is_active?: boolean }[]>([]);
  const [hasInactiveRoommate, setHasInactiveRoommate] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Estado para modal Eliminar Gasto
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (contextPeriods && contextPeriods.length > 0) {
      setPeriods(contextPeriods);
    }
  }, [contextPeriods]);

  useEffect(() => {
    if (contextPeriodId && contextPeriodId !== selectedPeriodId) {
      setSelectedPeriodId(contextPeriodId);
      loadExpenses(contextPeriodId).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
      });
    }
  }, [contextPeriodId]);

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);
  const isClosed = selectedPeriod?.is_closed === true;

  const loadExpenses = async (pId: string) => {
    const expensesRes = await fetch(`${API}/api/expenses?periodId=${pId}`);
    if (!expensesRes.ok) {
      throw new Error('Error al cargar los gastos');
    }
    const expensesData = await expensesRes.json();
    const loaded = Array.isArray(expensesData) ? expensesData : [];
    setExpenses(
      loaded.map((exp: Expense) => ({
        ...exp,
        category: exp.category || 'Otro',
      }))
    );
    setExpandedExpenses({});
  };

  const handlePeriodChange = async (pId: string) => {
    setSelectedPeriodId(pId);
    setContextPeriodId(pId);
    setError(null);
    try {
      await loadExpenses(pId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
    }
  };

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const houseRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/houses/mine?userId=${userId}`
        );
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
        const list = Array.isArray(data) ? data : data?.house ? [data.house] : data ? [data] : [];
        const houseData = list.find((h: { id: string }) => h.id === activeId);
        if (!houseData || !houseData.id) {
          router.push('/select-house');
          return;
        }

        // Cargar roommates de la casa
        const rmRes = await fetch(`${API}/api/roommates?houseId=${houseData.id}`).catch(() => null);
        if (rmRes && rmRes.ok) {
          const rmData = await rmRes.json().catch(() => null);
          const rList = Array.isArray(rmData) ? rmData : rmData?.roommates || [];
          setHouseRoommates(rList);
        } else if (Array.isArray(houseData.roommates)) {
          setHouseRoommates(houseData.roommates);
        }

        let allPeriods: Period[] = [];
        const periodsRes = await fetch(`${API}/api/periods?houseId=${houseData.id}`).catch(() => null);
        if (periodsRes && periodsRes.ok) {
          const pd = await periodsRes.json().catch(() => null);
          if (Array.isArray(pd)) allPeriods = pd;
        }
        if (allPeriods.length === 0 && Array.isArray(houseData.periods)) {
          allPeriods = houseData.periods;
        }

        allPeriods = [...allPeriods].sort(
          (a, b) =>
            (b.year ?? 0) - (a.year ?? 0) ||
            (b.month ?? 0) - (a.month ?? 0) ||
            (b.created_at ?? '').localeCompare(a.created_at ?? '')
        );
        setPeriods(allPeriods);

        const storedPeriodId = localStorage.getItem('activePeriodId');
        const validStored = storedPeriodId && allPeriods.some((p) => p.id === storedPeriodId);
        const initial =
          (validStored ? allPeriods.find((p) => p.id === storedPeriodId) : undefined) ||
          (contextPeriodId ? allPeriods.find((p) => p.id === contextPeriodId) : undefined) ||
          allPeriods.find((p) => !p.is_closed) ||
          allPeriods[0];

        const periodId = initial?.id || houseData.periodId;
        if (!periodId) {
          setExpenses([]);
          setLoading(false);
          return;
        }
        setSelectedPeriodId(periodId);
        setContextPeriodId(periodId);

        await loadExpenses(periodId);
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

    fetchData();
  }, [router]);

  const toggleExpand = (expenseId: string) => {
    setExpandedExpenses((prev) => ({
      ...prev,
      [expenseId]: !prev[expenseId],
    }));
  };

  const getRoommateName = (roommatesData?: { name: string } | { name: string }[], fallbackId?: string) => {
    if (!roommatesData) return fallbackId || 'Desconocido';
    if (Array.isArray(roommatesData)) {
      return roommatesData[0]?.name || fallbackId || 'Desconocido';
    }
    return roommatesData.name || fallbackId || 'Desconocido';
  };

  // Abrir modal de edición
  const handleOpenEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setEditConcept(expense.concept);
    setEditAmount(String(expense.amount));
    setEditPaidBy(expense.paid_by);
    setEditDate(expense.date ? expense.date.split('T')[0] : '');
    setEditCategory(expense.category || 'Otro');
    setEditError(null);

    // Splits participantes
    const splitParticipantIds = (expense.expense_splits || []).map((s) => s.roommate_id);
    setEditParticipants(splitParticipantIds.length > 0 ? splitParticipantIds : [expense.paid_by]);

    // Detectar convivientes inactivos (Criterio 6)
    const payerInactive = Array.isArray(expense.roommates)
      ? expense.roommates[0]?.is_active === false
      : expense.roommates?.is_active === false;

    const splitsInactive = (expense.expense_splits || []).some((s) =>
      Array.isArray(s.roommates) ? s.roommates[0]?.is_active === false : s.roommates?.is_active === false
    );

    const isInactive = payerInactive || splitsInactive;
    setHasInactiveRoommate(isInactive);

    // Armar lista de convivientes disponibles para el modal: activos + inactivos de este gasto
    const baseList = houseRoommates.length > 0 ? [...houseRoommates] : (contextRoommates ? [...contextRoommates] : []);
    const knownIds = new Set(baseList.map((r) => r.id));

    // Agregar payer si no estaba
    if (!knownIds.has(expense.paid_by)) {
      baseList.push({
        id: expense.paid_by,
        name: getRoommateName(expense.roommates, expense.paid_by),
        is_active: false,
      });
      knownIds.add(expense.paid_by);
    }

    // Agregar participantes de splits si no estaban
    for (const split of expense.expense_splits || []) {
      if (!knownIds.has(split.roommate_id)) {
        baseList.push({
          id: split.roommate_id,
          name: getRoommateName(split.roommates, split.roommate_id),
          is_active: false,
        });
        knownIds.add(split.roommate_id);
      }
    }

    setEditAvailableRoommates(baseList);
  };

  const handleEditParticipantToggle = (id: string) => {
    if (hasInactiveRoommate) return;
    setEditParticipants((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    setEditError(null);

    const trimmedConcept = editConcept.trim();
    if (trimmedConcept.length === 0 || trimmedConcept.length > 100) {
      setEditError('El concepto debe tener entre 1 y 100 caracteres');
      return;
    }

    if (!editDate) {
      setEditError('La fecha es obligatoria');
      return;
    }

    // Validar fecha dentro del período abierto
    if (selectedPeriod?.month && selectedPeriod?.year) {
      const dateParts = editDate.split('-');
      const expenseYear = parseInt(dateParts[0], 10);
      const expenseMonth = parseInt(dateParts[1], 10);
      if (
        isNaN(expenseYear) ||
        isNaN(expenseMonth) ||
        expenseYear !== selectedPeriod.year ||
        expenseMonth !== selectedPeriod.month
      ) {
        setEditError('La fecha del gasto debe pertenecer al período abierto');
        return;
      }
    }

    if (!editCategory || !['Fijo', 'Individual', 'Otro'].includes(editCategory)) {
      setEditError('Debes seleccionar una categoría válida');
      return;
    }

    let parsedAmount = Number(editingExpense.amount);
    let finalPaidBy = editingExpense.paid_by;
    let finalParticipants = (editingExpense.expense_splits || []).map((s) => s.roommate_id);

    if (!hasInactiveRoommate) {
      parsedAmount = parseFloat(editAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setEditError('El monto debe ser mayor a 0');
        return;
      }
      // Validar hasta 2 decimales
      if (!/^\d+(\.\d{1,2})?$/.test(editAmount.trim())) {
        setEditError('El monto puede tener hasta 2 decimales');
        return;
      }

      if (!editPaidBy) {
        setEditError('Debes seleccionar quién pagó el gasto');
        return;
      }
      finalPaidBy = editPaidBy;

      if (editParticipants.length === 0) {
        setEditError('Debes seleccionar al menos un participante');
        return;
      }
      finalParticipants = editParticipants;
    }

    setEditSubmitting(true);
    try {
      const res = await fetch(`${API}/api/expenses/${editingExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: trimmedConcept,
          amount: parsedAmount,
          paidBy: finalPaidBy,
          date: editDate,
          category: editCategory,
          participants: finalParticipants,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setEditError(data?.error || data?.message || 'Error al actualizar el gasto');
        return;
      }

      setEditingExpense(null);
      if (selectedPeriodId) {
        await loadExpenses(selectedPeriodId);
      }
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Abrir modal de eliminación
  const handleOpenDelete = (expense: Expense) => {
    setDeletingExpense(expense);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingExpense) return;
    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`${API}/api/expenses/${deletingExpense.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setDeleteError(data?.error || data?.message || 'Error al eliminar el gasto');
        return;
      }

      setDeletingExpense(null);
      if (selectedPeriodId) {
        await loadExpenses(selectedPeriodId);
      }
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const totalPeriod = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  const filteredExpenses =
    selectedCategory === 'Todas'
      ? expenses
      : expenses.filter((exp) => (exp.category || 'Otro') === selectedCategory);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted">Cargando gastos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Historial de Gastos</h1>
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
            <p className="mt-1 text-sm text-muted">
              Gastos registrados en el período seleccionado
            </p>
          </div>

          {!isClosed && (
            <Link
              href={activeHouse?.id || activeId ? `/expenses/new?houseId=${activeHouse?.id || activeId}` : '/expenses/new'}
              className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
            >
              Nuevo gasto
            </Link>
          )}
        </div>

        {periods.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="periodSelect" className="text-sm font-semibold text-ink-2">
              Período:
            </label>
            <select
              id="periodSelect"
              value={selectedPeriodId}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25"
            >
              {periods.map((p) => {
                const dup =
                  periods.filter((o) => o.month === p.month && o.year === p.year && o.is_closed === p.is_closed).length > 1;
                return (
                  <option key={p.id} value={p.id}>
                    {String(p.month ?? '--').padStart(2, '0')}/{p.year} - {p.is_closed ? 'Cerrado' : 'Abierto'}
                    {dup ? ` (#${p.id.slice(0, 4)})` : ''}
                  </option>
                );
              })}
            </select>
            {isClosed && (
              <span className="rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-2">
                Período cerrado – solo lectura
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-neg/20 bg-neg-soft p-4 text-sm font-medium text-neg">
            {error}
          </div>
        )}

        {/* Resumen del total */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
          <span className="text-sm font-medium text-muted">Total del período</span>
          <p className="font-display text-3xl font-semibold text-ink mt-1">
            ${totalPeriod.toFixed(2)}
          </p>
        </div>

        {/* Filtro por categoría */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-sm font-semibold text-ink-2">Filtrar por categoría:</span>
          <div className="flex flex-wrap items-center gap-2">
            {['Todas', 'Fijo', 'Individual', 'Otro'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-brand ${
                  selectedCategory === cat
                    ? 'bg-brand text-brand-ink'
                    : 'border border-line bg-surface text-ink-2 hover:bg-surface-2'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de gastos */}
        {filteredExpenses.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
            <p className="text-base text-ink-2">
              {expenses.length === 0
                ? 'Todavía no hay gastos registrados en este período'
                : `No hay gastos registrados en la categoría "${selectedCategory}"`}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              Total: $0.00
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredExpenses.map((expense) => {
              const isExpanded = !!expandedExpenses[expense.id];
              const payerName = getRoommateName(expense.roommates, expense.paid_by);
              const expenseCategory = expense.category || 'Otro';

              return (
                <div
                  key={expense.id}
                  className="rounded-2xl border border-line bg-surface p-5 shadow-soft transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-ink">
                          {expense.concept}
                        </span>
                        <span className="rounded-md bg-brand/10 border border-brand/20 px-2 py-0.5 text-xs font-semibold text-brand">
                          {expenseCategory}
                        </span>
                        <span className="text-xs text-muted bg-surface-2 rounded-md px-2 py-0.5">
                          {expense.date}
                        </span>
                      </div>
                      <p className="text-sm text-ink-2">
                        Pagado por: <span className="font-medium text-ink">{payerName}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
                      <span className="font-display text-xl font-semibold text-ink">
                        ${Number(expense.amount).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleExpand(expense.id)}
                        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-surface-2 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
                      >
                        {isExpanded ? 'Ocultar reparto' : 'Ver reparto'}
                      </button>

                      {/* Botones Editar y Eliminar en período abierto (Criterio 1) */}
                      {!isClosed && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(expense)}
                            className="rounded-lg border border-brand/40 bg-surface px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(expense)}
                            className="rounded-lg border border-neg/40 bg-surface px-3 py-1.5 text-xs font-semibold text-neg hover:bg-neg-soft transition-colors"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Reparto desplegable */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-line pt-4">
                      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                        Participantes y cuotas
                      </h4>
                      {expense.expense_splits && expense.expense_splits.length > 0 ? (
                        <div className="space-y-2 rounded-lg bg-surface-2 p-3">
                          {expense.expense_splits.map((split) => {
                            const participantName = getRoommateName(
                              split.roommates,
                              split.roommate_id
                            );

                            return (
                              <div
                                key={split.id}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-ink">{participantName}</span>
                                <span className="font-medium text-ink">
                                  ${Number(split.amount).toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">
                          No hay detalles de reparto disponibles.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Editar Gasto */}
        {editingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-card space-y-4 my-8">
              <h3 className="font-display text-lg font-semibold text-ink">Editar Gasto</h3>

              {hasInactiveRoommate && (
                <div className="rounded-lg border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
                  Este gasto incluye un conviviente eliminado. Solo podés modificar el concepto, la fecha y la categoría.
                </div>
              )}

              {editError && (
                <div className="rounded-lg border border-neg/20 bg-neg-soft p-3 text-sm font-medium text-neg">
                  {editError}
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label htmlFor="editConcept" className="block text-sm font-semibold text-ink-2">
                    Concepto
                  </label>
                  <input
                    id="editConcept"
                    type="text"
                    required
                    value={editConcept}
                    onChange={(e) => setEditConcept(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="editAmount" className="block text-sm font-semibold text-ink-2">
                    Monto
                  </label>
                  <input
                    id="editAmount"
                    type="number"
                    step="0.01"
                    required
                    disabled={hasInactiveRoommate}
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink disabled:opacity-50 disabled:bg-surface-2 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="editPaidBy" className="block text-sm font-semibold text-ink-2">
                    Pagado por
                  </label>
                  <select
                    id="editPaidBy"
                    disabled={hasInactiveRoommate}
                    value={editPaidBy}
                    onChange={(e) => setEditPaidBy(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink disabled:opacity-50 disabled:bg-surface-2 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
                  >
                    {editAvailableRoommates.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} {rm.is_active === false ? '(Eliminado)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="editDate" className="block text-sm font-semibold text-ink-2">
                    Fecha
                  </label>
                  <input
                    id="editDate"
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="editCategory" className="block text-sm font-semibold text-ink-2">
                    Categoría
                  </label>
                  <select
                    id="editCategory"
                    required
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
                  >
                    <option value="Fijo">Fijo</option>
                    <option value="Individual">Individual</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <span className="block text-sm font-semibold text-ink-2 mb-2">
                    Participantes
                  </span>
                  <div className="space-y-2 rounded-lg border border-line bg-bg p-3 max-h-40 overflow-y-auto">
                    {editAvailableRoommates.map((rm) => {
                      const checked = editParticipants.includes(rm.id);
                      return (
                        <label
                          key={rm.id}
                          className={`flex items-center gap-2 text-sm text-ink ${
                            hasInactiveRoommate ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={hasInactiveRoommate}
                            checked={checked}
                            onChange={() => handleEditParticipantToggle(rm.id)}
                            className="rounded border-line text-brand focus:ring-brand"
                          />
                          <span>
                            {rm.name} {rm.is_active === false ? '(Eliminado)' : ''}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setEditingExpense(null)}
                    disabled={editSubmitting}
                    className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition hover:brightness-110 disabled:opacity-50"
                  >
                    {editSubmitting ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Eliminar Gasto */}
        {deletingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card space-y-4">
              <h3 className="font-display text-lg font-semibold text-ink">Eliminar Gasto</h3>

              <p className="text-sm text-ink-2">
                ¿Estás seguro de que deseás eliminar el gasto{' '}
                <strong className="text-ink">&quot;{deletingExpense.concept}&quot;</strong> por un monto de{' '}
                <strong className="text-ink">${Number(deletingExpense.amount).toFixed(2)}</strong>?
              </p>

              {deleteError && (
                <div className="rounded-lg border border-neg/20 bg-neg-soft p-3 text-sm font-medium text-neg">
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setDeletingExpense(null)}
                  disabled={deleteSubmitting}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteSubmitting}
                  className="rounded-lg bg-neg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {deleteSubmitting ? 'Eliminando...' : 'Confirmar eliminación'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}