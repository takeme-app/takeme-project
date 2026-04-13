import { supabase } from '../lib/supabase';
import type { PagamentoListItem } from '../data/types';

/**
 * Dispara download de um blob CSV no navegador.
 */
export function downloadCsvBlob(csvContent: string, filename: string): void {
  // BOM UTF-8 para compatibilidade com Excel
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formata centavos como string BRL: "R$ 1.234,56"
 */
function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Escapa campo CSV (aspas duplas internas → "")
 */
function csvField(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Busca dados bancários dos workers e gera CSV completo para pagamento manual.
 * Retorna o número de linhas exportadas.
 */
export async function exportPayoutsReport(
  rows: PagamentoListItem[],
  statusFilter: ('Agendado' | 'Em andamento')[] = ['Agendado', 'Em andamento'],
): Promise<number> {
  const filtered = rows.filter((r) => (statusFilter as string[]).includes(r.status));
  if (filtered.length === 0) return 0;

  // Buscar dados bancários dos workers
  const workerIds = [...new Set(filtered.map((r) => r.workerId).filter(Boolean))];
  const bankMap: Record<string, { pixKey: string; bankCode: string; bankAgency: string; bankAccount: string }> = {};
  if (workerIds.length > 0) {
    const { data: workers } = await (supabase as any)
      .from('worker_profiles')
      .select('id, pix_key, bank_code, bank_agency, bank_account')
      .in('id', workerIds);
    for (const w of workers || []) {
      bankMap[w.id] = {
        pixKey: w.pix_key || '',
        bankCode: w.bank_code || '',
        bankAgency: w.bank_agency || '',
        bankAccount: w.bank_account || '',
      };
    }
  }

  // Agrupar por worker para relatório consolidado
  const grouped: Record<string, { name: string; payouts: typeof filtered; total: number }> = {};
  for (const r of filtered) {
    if (!grouped[r.workerId]) {
      grouped[r.workerId] = { name: r.workerName, payouts: [], total: 0 };
    }
    grouped[r.workerId].payouts.push(r);
    grouped[r.workerId].total += r.workerAmountCents;
  }

  // Gerar CSV
  const header = [
    'Nome do Profissional',
    'Chave PIX',
    'Banco',
    'Agência',
    'Conta',
    'Valor Total (R$)',
    'Qtd Pagamentos',
    'Status',
    'IDs dos Payouts',
  ].join(',');

  const lines = Object.entries(grouped).map(([wId, g]) => {
    const bank = bankMap[wId] || { pixKey: '', bankCode: '', bankAgency: '', bankAccount: '' };
    return [
      csvField(g.name),
      csvField(bank.pixKey),
      csvField(bank.bankCode),
      csvField(bank.bankAgency),
      csvField(bank.bankAccount),
      csvField(formatBRL(g.total)),
      String(g.payouts.length),
      csvField(g.payouts[0]?.status || 'Agendado'),
      csvField(g.payouts.map((p) => p.id).join('; ')),
    ].join(',');
  });

  const csv = [header, ...lines].join('\n');
  const date = new Date().toISOString().slice(0, 10);
  downloadCsvBlob(csv, `relatorio-pagamentos-${date}.csv`);

  return lines.length;
}
