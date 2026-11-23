'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface BalanceItem {
  id: string;
  name: string;
  balance: number;
}

interface DebtItem {
  deudor_id: string;
  deudor: string;
  acreedor_id: string;
  acreedor: string;
  monto: number;
}

interface PaymentItem {
  id: string;
  amount: number;
  created_at: string;
  paid_by: { id: string; name: string };
  paid_to: { id: string; name: string };
}

interface Period {
  id: string;
  month?: number;
  year?: number;
  is_closed?: boolean;
  created_at?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function BalancesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [houseId, setHouseId] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);
  const isClosed = selectedPeriod?.is_closed === true;

  const loadPeriodData = async (hId: string, pId: string) => {
    try {
      const [balancesRes, paymentsRes] = await Promise.all([
        fetch(`${API}/api/balances?periodId=${pId}&houseId=${hId}`),
        fetch(`${API}/api/payments?periodId=${pId}`),
      ]);

      if (balancesRes.ok) {
        const bData = await balancesRes.json();
        setBalances(Array.isArray(bData?.balances) ? bData.balances : []);
        setDebts(Array.isArray(bData?.debts) ? bData.debts : []);
      } else {
        setBalances([]);
        setDebts([]);
      }

      if (paymentsRes.ok) {
        const pData = await paymentsRes.json();
        setPayments(Array.isArray(pData) ? pData : []);
      } else {
        setPayments([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
    }
  };

  const handlePeriodChange = async (pId: string) => {
    setSelectedPeriodId(pId);
    if (houseId) await loadPeriodData(houseId, pId);
  };

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
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
        const list = Array.isArray(data) ? data : data?.house ? [data.house] : data ? [data] : [];
        const houseData = list.find((h: { id: string }) => h.id === activeId);
        if (!houseData || !houseData.id) {
          router.push('/select-house');
          return;
        }

        const hId: string = houseData.id;
        setHouseId(hId);

        let allPeriods: Period[] = [];
        const periodsRes = await fetch(`${API}/api/periods?houseId=${hId}`).catch(() => null);
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
        if (!initial) {
          setLoading(false);
          return;
        }
        setSelectedPeriodId(initial.id);
        await loadPeriodData(hId, initial.id);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted">Cargando saldos y deudas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Saldos y Deudas</h1>
            <Link href="/dashboard" className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
              ← Dashboard
            </Link>
            <Link href="/select-house" className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
              Cambiar de casa
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted">Estado financiero del período seleccionado</p>
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
          <div className="rounded-lg border border-neg/20 bg-neg-soft p-4 text-sm font-medium text-neg">{error}</div>
        )}

        {/* Saldos por conviviente */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink">Saldos por conviviente</h2>
          {balances.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
              No hay saldos disponibles.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {balances.map((item) => {
                const bal = Number(item.balance);
                let label: string;
                let badgeCls: string;
                let amtCls: string;

                if (bal > 0) {
                  label = 'A favor';
                  badgeCls = 'bg-pos/10 text-pos border-pos/30';
                  amtCls = 'text-pos';
                } else if (bal < 0) {
                  label = 'A pagar';
                  badgeCls = 'bg-neg-soft text-neg border-neg/30';
                  amtCls = 'text-neg';
                } else {
                  label = 'Saldado';
                  badgeCls = 'bg-surface-2 text-ink-2 border-line-strong';
                  amtCls = 'text-ink-2';
                }

                return (
                  <div key={item.id} className="rounded-2xl border border-line bg-surface p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-ink">{item.name}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeCls}`}>
                        {label}
                      </span>
                    </div>
                    <p className={`mt-3 font-display text-2xl font-semibold ${amtCls}`}>${Math.abs(bal).toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Deudas pendientes */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink">Deudas pendientes</h2>
          {debts.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
              No hay deudas pendientes en este período
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface divide-y divide-line">
              {debts.map((d, i) => (
                <div key={i} className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink">
                  <span>
                    <strong>{d.deudor}</strong> le debe a <strong>{d.acreedor}</strong>:{' '}
                    <span className="font-semibold text-neg">${Number(d.monto).toFixed(2)}</span>
                    {isClosed && (
                      <span className="ml-3 rounded-full border border-neg/30 bg-neg-soft px-2.5 py-0.5 text-xs font-semibold text-neg">
                        Pendientes al momento del cierre
                      </span>
                    )}
                  </span>
                  {!isClosed && (
                    <Link
                      className="ml-4 font-semibold text-brand hover:underline"
                      href={`/payments/new?debtorId=${d.deudor_id}&debtorName=${d.deudor}&creditorId=${d.acreedor_id}&creditorName=${d.acreedor}&amount=${d.monto}`}
                    >
                      Registrar pago
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Historial de Pagos */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink">Historial de Pagos</h2>
          {payments.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
              No hay pagos registrados
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface divide-y divide-line">
              {payments.map((p) => {
                const pagador = typeof p.paid_by === 'object' ? p.paid_by.name : String(p.paid_by);
                const receptor = typeof p.paid_to === 'object' ? p.paid_to.name : String(p.paid_to);
                const fecha = p.created_at ? p.created_at.split('T')[0] : '';

                return (
                  <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                    <div>
                      {fecha && (
                        <span className="mr-3 text-xs text-muted bg-surface-2 rounded-md px-2 py-0.5">{fecha}</span>
                      )}
                      <strong>{pagador}</strong> le pagó a <strong>{receptor}</strong>
                    </div>
                    <span className="font-semibold text-pos">${Number(p.amount).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}