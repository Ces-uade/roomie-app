'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHouse } from '@/context/HouseContext';

interface Split {
  id: string;
  roommate_id: string;
  amount: number;
  roommates?: { name: string } | { name: string }[];
}

interface Expense {
  id: string;
  period_id: string;
  paid_by: string;
  concept: string;
  amount: number;
  date: string;
  category?: string;
  roommates?: { name: string } | { name: string }[];
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
  const { activeHouse } = useHouse();
  const [activeId, setActiveId] = useState<string | null>(() => activeHouse?.id || (typeof window !== 'undefined' ? localStorage.getItem('activeHouseId') : null));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [expandedExpenses, setExpandedExpenses] = useState<Record<string, boolean>>({});
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

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
        const houseRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/houses/mine?userId=${userId}`);
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

        const initial = allPeriods.find((p) => !p.is_closed) ?? allPeriods[0];
        const periodId = initial?.id || houseData.periodId;
        if (!periodId) {
          setExpenses([]);
          setLoading(false);
          return;
        }
        setSelectedPeriodId(periodId);

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

                    <div className="flex items-center justify-between sm:justify-end gap-4">
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
      </div>
    </div>
  );
}