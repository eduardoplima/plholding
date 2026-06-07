export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export type Role = 'admin' | 'manager' | 'viewer';
export type User = { id: number; username: string; email?: string | null; full_name: string; role: Role; is_active: boolean };
export type List<T> = { items: T[]; total: number; limit?: number; offset?: number };
export type Property = { id:number; name:string; kind:string; rental_mode:string; address_line?:string|null; city?:string|null; state?:string|null; cep?:string|null; matricula?:string|null; sequencial?:string|null; inscricao?:string|null; market_value?: string | null; notes?:string|null; units?: Unit[] };
export type Unit = { id:number; property_id:number; name:string; base_rent:string; status:string; notes?:string|null };
export type Tenant = { id:number; full_name:string; cpf?: string; email?: string; phone?: string; notes?:string|null };
export type LeaseTenantLink = { tenant_id:number; is_primary:boolean; tenant: Tenant };
export type Lease = { id:number; unit_id:number; start_date:string; end_date:string; monthly_rent:string; due_day:number; deposit?:string|null; status:string; notes?:string|null; tenants: LeaseTenantLink[] };
export type RentCharge = { id:number; lease_id:number; reference_month:string; due_date:string; amount_due:string; amount_paid:string; status:string };
export type Expense = { id:number; property_id?:number|null; debt_id?:number|null; category:string; reference_period:string; amount:string; due_date?:string|null; paid_date?:string|null; status:string; notes?:string|null };
export type Debt = { id:number; name:string; kind:string; principal_amount:string; installment_amount?:string|null; installments_count?:number|null; first_due_date?:string|null; outstanding_balance:string; property_id?: number|null; start_date?:string|null; notes?:string|null };
export type DocItem = { id:number; original_filename:string; content_type:string; size_bytes:number; document_type:string; owner_entity_type:string; owner_entity_id:number };
export type ReconSuggestion = {
  kind: 'rent_charge' | 'expense' | 'none';
  confidence?: 'alta' | 'media';
  tenant?: Tenant;
  rent_charge?: RentCharge | null;
  expense?: Expense | null;
  suggested_category?: string;
};
export type BankTxn = {
  id:number; account_id:string; fitid:string; posted_date:string; kind:'credit'|'debit';
  amount:string; counterparty_name?:string|null; counterparty_doc?:string|null; memo?:string|null;
  status:'pending'|'reconciled'|'ignored'; rent_charge_id?:number|null; expense_id?:number|null;
  tenant_id?:number|null; suggestion?: ReconSuggestion | null;
};
export type ReconSummary = { month:string; recebido:string; esperado:string; conciliado:string; nao_conciliado:string; em_aberto:string };
export type ReconChargeRow = {
  charge: RentCharge & { due_date?: string };
  property: string; unit: string; tenants: string;
  linked_txn?: BankTxn | null; suggested_txn?: BankTxn | null; confidence?: 'alta' | 'media' | null;
};
export type ReconChargesResp = { month:string; esperado:string; recebido:string; em_aberto:string; items: ReconChargeRow[] };

let accessToken = localStorage.getItem('plh_access') ?? '';
let refreshToken = localStorage.getItem('plh_refresh') ?? '';
export function setTokens(access: string, refresh: string) { accessToken = access; refreshToken = refresh; localStorage.setItem('plh_access', access); localStorage.setItem('plh_refresh', refresh); }
export function clearTokens() { accessToken = ''; refreshToken = ''; localStorage.removeItem('plh_access'); localStorage.removeItem('plh_refresh'); }

async function refreshOnce() {
  if (!refreshToken) throw new Error('Sem refresh token');
  const res = await fetch(`${API_URL}/auth/refresh`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({refresh: refreshToken}) });
  if (!res.ok) throw new Error('Sessão expirada');
  const data = await res.json(); setTokens(data.access, data.refresh);
}
export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(`${API_URL}${path}`, {...init, headers});
  if (res.status === 401 && retry && refreshToken) { await refreshOnce(); return api<T>(path, init, false); }
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json();
}
export async function downloadDocument(id: number, filename: string) {
  let res = await fetch(`${API_URL}/documents/${id}/file`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  if (res.status === 401 && refreshToken) { await refreshOnce(); res = await fetch(`${API_URL}/documents/${id}/file`, { headers: { Authorization: `Bearer ${accessToken}` } }); }
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export const money = (v: string | number | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
export const brDate = (iso?: string | null) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '-';
