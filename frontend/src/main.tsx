import React, { createContext, useContext, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Toaster, toast } from 'sonner';
import {
  LayoutDashboard, Building2, Users2, FileText, AlertCircle,
  ReceiptText, Landmark, FolderOpen, UserCog, LogOut,
  Plus, Pencil, Trash2, X, Download, Upload, DoorClosed, ArrowLeftRight, Check, Ban, Wallet, Link2, ChevronDown, Stamp,
} from 'lucide-react';
import {
  api, BankTxn, brDate, clearTokens, Debt, DocItem, downloadDocument, Expense, IptuResp, IptuRow, Lease, List, money,
  Property, ReconChargeRow, ReconChargesResp, ReconSummary, RentCharge, setTokens, Tenant, Unit, User,
} from './api/client';
import './styles.css';
import logoLight from './assets/logo-final/pl-logo-light.svg';
import logoPrimary from './assets/logo-final/pl-logo-primary.svg';

// money string normalizer: accepts pt-BR comma, returns dot-decimal string
const num = (v: string) => v.trim().replace(/\./g, '').replace(',', '.');
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const errText = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  try { const j = JSON.parse(m); if (Array.isArray(j?.detail)) return j.detail.map((d: any) => d.msg).join('; '); if (j?.detail) return String(j.detail); } catch { /* not json */ }
  return m || 'Erro inesperado';
};

type AuthCtx = {
  user?: User;
  login(username: string, password: string): Promise<void>;
  logout(): void;
  refreshUser(): Promise<void>;
  canWrite: boolean;
};

const Auth = createContext<AuthCtx>(null as unknown as AuthCtx);
const qc = new QueryClient();

function useAuth() {
  return useContext(Auth);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | undefined>();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me'), retry: false });

  React.useEffect(() => {
    if (me.data) setUser(me.data);
  }, [me.data]);

  async function login(username: string, password: string) {
    const tokens = await api<{ access: string; refresh: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }, false);
    setTokens(tokens.access, tokens.refresh);
    setUser(await api<User>('/auth/me'));
  }

  function logout() {
    clearTokens();
    setUser(undefined);
    qc.clear();
  }

  async function refreshUser() {
    setUser(await api<User>('/auth/me'));
  }

  const value = useMemo(() => ({
    user,
    login,
    logout,
    refreshUser,
    canWrite: user?.role === 'admin' || user?.role === 'manager',
  }), [user]);

  return <Auth.Provider value={value}>{children}</Auth.Provider>;
}

function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <main className="pl-login">
      <section className="pl-login__brand">
        <img className="pl-login__logo" src={logoLight} alt="P&L Holding" />
        <div className="pl-login__copy">
          <p className="pl-eyebrow">Pereira · Lima</p>
          <h1 className="pl-hero__title">Gestão patrimonial <em>da raiz ao fruto</em>.</h1>
          <p>Inventário imobiliário, contratos, cobranças, inadimplência, despesas e relatórios executivos em uma fonte única de verdade.</p>
        </div>
        <p className="pl-mono">Sistema interno · P&L Investimentos</p>
      </section>

      <section className="pl-login__panel">
        <form className="pl-login__form" onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          try {
            await login(username, password);
            toast.success('Login realizado');
          } catch {
            toast.error('Credenciais inválidas ou usuário inativo');
          } finally {
            setLoading(false);
          }
        }}>
          <img src={logoPrimary} alt="P&L Holding" style={{ width: 190, marginBottom: 24 }} />
          <p className="pl-eyebrow">Área administrativa</p>
          <h2 className="pl-h2" style={{ marginTop: 8 }}>Entrar no sistema</h2>
          <label className="pl-field">
            <span className="pl-label">Usuário</span>
            <input className="pl-input" type="text" value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} required />
          </label>
          <label className="pl-field">
            <span className="pl-label">Senha</span>
            <input className="pl-input" type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className="pl-btn pl-btn--primary" style={{ width: '100%', justifyContent: 'center', marginTop: 24 }} disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

type NavKey = 'dashboard' | 'imoveis' | 'inquilinos' | 'contratos' | 'inadimplencia' | 'conciliacao' | 'extrato' | 'despesas' | 'iptu' | 'patrimonio' | 'documentos' | 'usuarios';

const navItems: { key: NavKey; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { key: 'dashboard',     label: 'Dashboard',         icon: <LayoutDashboard size={16} className="pl-nav-icon" /> },
  { key: 'imoveis',       label: 'Imóveis & Unidades', icon: <Building2 size={16} className="pl-nav-icon" /> },
  { key: 'inquilinos',    label: 'Inquilinos',         icon: <Users2 size={16} className="pl-nav-icon" /> },
  { key: 'contratos',     label: 'Contratos',          icon: <FileText size={16} className="pl-nav-icon" /> },
  { key: 'inadimplencia', label: 'Inadimplência',      icon: <AlertCircle size={16} className="pl-nav-icon" /> },
  { key: 'conciliacao',   label: 'Conciliação',        icon: <ArrowLeftRight size={16} className="pl-nav-icon" /> },
  { key: 'extrato',       label: 'Extrato',            icon: <Wallet size={16} className="pl-nav-icon" /> },
  { key: 'despesas',      label: 'Despesas',           icon: <ReceiptText size={16} className="pl-nav-icon" /> },
  { key: 'iptu',          label: 'IPTU',               icon: <Stamp size={16} className="pl-nav-icon" /> },
  { key: 'patrimonio',    label: 'Patrimônio & Dívidas', icon: <Landmark size={16} className="pl-nav-icon" /> },
  { key: 'documentos',    label: 'Documentos',         icon: <FolderOpen size={16} className="pl-nav-icon" /> },
  { key: 'usuarios',      label: 'Usuários',           icon: <UserCog size={16} className="pl-nav-icon" />, adminOnly: true },
];

function AppShell() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<NavKey>('dashboard');
  const [changePw, setChangePw] = useState(false);
  const current = navItems.find((item) => item.key === tab);

  return (
    <div className="pl-admin">
      <aside className="pl-admin__sidebar">
        <div className="pl-admin__brand"><img src={logoLight} alt="P&L Holding" /></div>
        <nav className="pl-admin__nav" aria-label="Navegação principal">
          {navItems
            .filter((item) => !item.adminOnly || user?.role === 'admin')
            .map((item) => (
              <button key={item.key} type="button" aria-current={tab === item.key ? 'page' : undefined} onClick={() => setTab(item.key)}>
                {item.icon}
                {item.label}
              </button>
            ))}
        </nav>
        <div className="pl-sidebar__foot">
          <button type="button" className="pl-sidebar__logout" onClick={logout}>
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </aside>
      <main className="pl-admin__main">
        <header className="pl-admin__topbar">
          <div className="pl-admin__topbar-title">
            <span className="pl-topbar-section">{current?.label ?? 'Dashboard'}</span>
          </div>
          <div className="pl-user-chip">
            <span>{user?.full_name}</span>
            <span className="pl-role-badge">{roleLabel(user?.role)}</span>
            <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => setChangePw(true)}>Trocar senha</button>
          </div>
        </header>
        <div className="pl-admin__content">
          {tab === 'dashboard'     && <Dashboard />}
          {tab === 'imoveis'       && <Inventory />}
          {tab === 'inquilinos'    && <Tenants />}
          {tab === 'contratos'     && <Leases />}
          {tab === 'inadimplencia' && <Delinquency />}
          {tab === 'conciliacao'   && <Conciliacao />}
          {tab === 'extrato'       && <Extrato />}
          {tab === 'despesas'      && <Expenses />}
          {tab === 'iptu'          && <IptuPage />}
          {tab === 'patrimonio'    && <Patrimony />}
          {tab === 'documentos'    && <Documents />}
          {tab === 'usuarios'      && <Users />}
        </div>
      </main>
      {changePw && <Modal title="Trocar senha" onClose={() => setChangePw(false)}><ChangePasswordForm onDone={() => setChangePw(false)} onCancel={() => setChangePw(false)} /></Modal>}
    </div>
  );
}

/* ---------- Shared UI ---------- */

function Page({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="pl-page-head">
        <div>
          <h2 className="pl-h2">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function KpiCard({ label, value, loading }: { label: string; value: React.ReactNode; loading?: boolean }) {
  return (
    <div className="pl-kpi-card">
      <p className="pl-kpi-card__label">{label}</p>
      <div className={`pl-kpi-card__value${loading ? ' pl-kpi-card__value--loading' : ''}`}>
        {loading ? <span className="pl-skeleton pl-skeleton--value" /> : value}
      </div>
    </div>
  );
}

function DataTable({ children }: { children: React.ReactNode }) {
  return <div className="pl-table-wrap"><table className="pl-table">{children}</table></div>;
}

function Empty({ icon, text, detail }: { icon?: React.ReactNode; text?: string; detail?: string }) {
  return (
    <div className="pl-empty">
      {icon && <div className="pl-empty__icon">{icon}</div>}
      <p className="pl-empty__text">{text ?? 'Nenhum registro encontrado.'}</p>
      {detail && <p className="pl-empty__detail">{detail}</p>}
    </div>
  );
}

function QueryError({ message }: { message?: string }) {
  return (
    <div className="pl-query-error">
      <AlertCircle size={18} />
      <span>{message ?? 'Erro ao carregar dados. Tente novamente.'}</span>
    </div>
  );
}

function TableSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <DataTable>
      <thead><tr>{Array.from({ length: cols }).map((_, i) => <th key={i}>&nbsp;</th>)}</tr></thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            {Array.from({ length: cols }).map((_, j) => (
              <td key={j}><span className="pl-skeleton" /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="pl-modal__overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`pl-modal${wide ? ' pl-modal--wide' : ''}`} role="dialog" aria-modal="true">
        <div className="pl-modal__head">
          <h3 className="pl-modal__title">{title}</h3>
          <button className="pl-modal__close" type="button" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="pl-modal__body">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`pl-field${full ? ' pl-field--full' : ''}`}>
      <span className="pl-label">{label}</span>
      {children}
    </label>
  );
}

function FormFoot({ onCancel, pending, submitLabel }: { onCancel: () => void; pending?: boolean; submitLabel?: string }) {
  return (
    <div className="pl-modal__foot">
      <button type="button" className="pl-btn pl-btn--ghost" onClick={onCancel}>Cancelar</button>
      <button type="submit" className="pl-btn pl-btn--primary" disabled={pending}>{pending ? 'Salvando…' : (submitLabel ?? 'Salvar')}</button>
    </div>
  );
}

function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="pl-row-actions">{children}</div>;
}
function EditBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" className="pl-icon-btn" title="Editar" onClick={onClick}><Pencil size={15} /></button>;
}
function DeleteBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" className="pl-icon-btn pl-icon-btn--danger" title="Excluir" onClick={onClick}><Trash2 size={15} /></button>;
}
function NewBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="pl-btn pl-btn--primary" onClick={onClick}><Plus size={16} /> {label}</button>;
}

function confirmDelete(msg: string) { return window.confirm(msg); }

/* ---------- Dashboard ---------- */

function Dashboard() {
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api<any>('/reports/dashboard') });
  const fluxo = useQuery({ queryKey: ['fluxo'], queryFn: () => api<{ items: any[] }>(`/reports/fluxo-alugueis?from=${thisMonth().slice(0,4)}-01&to=${thisMonth().slice(0,4)}-12`) });
  const loading = dash.isLoading;

  return (
    <Page title="Dashboard executivo" subtitle="Receita realizada vs. esperada, inadimplência, patrimônio líquido e ocupação.">
      {dash.isError && <QueryError />}
      <div className="pl-dashboard-grid">
        <KpiCard label="Receita do mês"       value={money(dash.data?.receita_mes)}                    loading={loading} />
        <KpiCard label="Inadimplência"         value={money(dash.data?.inadimplencia_total)}            loading={loading} />
        <KpiCard label="Patrimônio líquido"    value={money(dash.data?.patrimonio_liquido)}             loading={loading} />
        <KpiCard label="Contratos vencendo"    value={dash.data?.contratos_vencendo_30_dias?.length ?? 0} loading={loading} />
      </div>
      <div className="pl-panel">
        <h3 className="pl-h3">Fluxo de aluguéis</h3>
        <p style={{ color: 'var(--pl-text-muted)', marginTop: 4, marginBottom: 20 }}>Comparativo mensal entre valores esperados e recebidos.</p>
        {fluxo.isLoading ? (
          <div className="pl-chart-skeleton" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={fluxo.data?.items ?? []} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pl-border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'var(--pl-stone-500)' }} />
              <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: 'var(--pl-stone-500)' }} width={56} />
              <Tooltip
                formatter={(v) => money(v as number)}
                labelStyle={{ color: 'var(--pl-graphite)', fontWeight: 600 }}
                contentStyle={{ border: '1px solid var(--pl-border)', borderRadius: 4, fontSize: 13 }}
              />
              <Bar dataKey="esperado" name="Esperado" fill="var(--pl-stone-300)" radius={[2,2,0,0]} />
              <Bar dataKey="recebido" name="Recebido" fill="var(--pl-gold-500)" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Page>
  );
}

/* ---------- Imóveis & Unidades ---------- */

function Inventory() {
  const { canWrite } = useAuth();
  const props = useQuery({ queryKey: ['properties'], queryFn: () => api<List<Property>>('/properties') });
  const [editing, setEditing] = useState<Property | null | undefined>(undefined); // undefined=closed, null=new
  const [unitsOf, setUnitsOf] = useState<Property | null>(null);
  const [occupancyOf, setOccupancyOf] = useState<Property | null>(null);

  const del = useMutation({
    mutationFn: (id: number) => api<void>(`/properties/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); toast.success('Imóvel excluído'); },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <Page
      title="Imóveis & Unidades"
      subtitle="Condomínios e demais imóveis do patrimônio. Cada imóvel tem uma ou mais unidades locáveis."
      action={canWrite && <NewBtn label="Novo imóvel" onClick={() => setEditing(null)} />}
    >
      {props.isError && <QueryError />}
      {props.isLoading && <TableSkeleton cols={6} />}
      {!props.isLoading && !props.data?.items?.length && (
        <Empty icon={<Building2 size={32} />} text="Nenhum imóvel cadastrado." detail="Adicione o primeiro imóvel para começar o inventário." />
      )}
      {!props.isLoading && !!props.data?.items?.length && (
        <DataTable>
          <thead>
            <tr><th>Nome</th><th>Tipo</th><th>Matrícula</th><th>Valor de mercado</th><th>Ocupação</th>{canWrite && <th></th>}</tr>
          </thead>
          <tbody>
            {props.data!.items.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td>{kindLabel(p.kind)}</td>
                <td className="pl-mono">{p.matricula ?? '—'}</td>
                <td>{money(p.market_value)}</td>
                <td>{p.units?.length
                  ? <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => setOccupancyOf(p)}>{p.units.filter((u) => u.status === 'occupied').length}/{p.units.length} ocupadas</button>
                  : '—'}</td>
                {canWrite && (
                  <td>
                    <RowActions>
                      <button type="button" className="pl-icon-btn" title="Unidades" onClick={() => setUnitsOf(p)}><DoorClosed size={15} /></button>
                      <EditBtn onClick={() => setEditing(p)} />
                      <DeleteBtn onClick={() => { if (confirmDelete(`Excluir o imóvel "${p.name}"?`)) del.mutate(p.id); }} />
                    </RowActions>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      {editing !== undefined && <PropertyForm property={editing} onClose={() => setEditing(undefined)} />}
      {unitsOf && <UnitsManager property={unitsOf} onClose={() => setUnitsOf(null)} />}
      {occupancyOf && <OccupancyModal property={occupancyOf} onClose={() => setOccupancyOf(null)} />}
    </Page>
  );
}

function OccupancyModal({ property, onClose }: { property: Property; onClose: () => void }) {
  const units = useQuery({ queryKey: ['units', property.id], queryFn: () => api<List<Unit>>(`/units?property_id=${property.id}`) });
  const leases = useQuery({ queryKey: ['leases'], queryFn: () => api<List<Lease>>('/leases?limit=500') });
  const tenantFor = (unitId: number) => {
    const active = leases.data?.items.find((l) => l.unit_id === unitId && l.status === 'active');
    return active?.tenants?.map((t) => t.tenant?.full_name).filter(Boolean).join(', ') || '—';
  };
  const rows = units.data?.items ?? [];
  const occ = rows.filter((u) => u.status === 'occupied').length;
  return (
    <Modal title={`Ocupação — ${property.name}`} onClose={onClose} wide>
      {units.isLoading ? <TableSkeleton cols={3} /> : !rows.length ? <Empty icon={<DoorClosed size={28} />} text="Nenhuma unidade." /> : (
        <>
          <p style={{ marginTop: 0, color: 'var(--pl-text-muted)' }}>{occ} de {rows.length} unidades ocupadas.</p>
          <DataTable>
            <thead><tr><th>Unidade</th><th>Status</th><th>Inquilino atual</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td><Status value={u.status} /></td>
                  <td>{u.status === 'occupied' ? tenantFor(u.id) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      )}
    </Modal>
  );
}

function PropertyForm({ property, onClose }: { property: Property | null; onClose: () => void }) {
  const p = property;
  const [f, setF] = useState({
    name: p?.name ?? '', kind: p?.kind ?? 'condominio', rental_mode: p?.rental_mode ?? 'by_unit',
    matricula: p?.matricula ?? '', sequencial: p?.sequencial ?? '', inscricao: p?.inscricao ?? '',
    address_line: p?.address_line ?? '', city: p?.city ?? '', state: p?.state ?? '', cep: p?.cep ?? '',
    market_value: p?.market_value ?? '', notes: p?.notes ?? '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name, kind: f.kind, rental_mode: f.rental_mode,
        matricula: f.matricula || null, sequencial: f.sequencial || null, inscricao: f.inscricao || null,
        address_line: f.address_line || null, city: f.city || null, state: f.state || null, cep: f.cep || null,
        market_value: f.market_value ? num(f.market_value) : null, notes: f.notes || null,
      };
      return p
        ? api<Property>(`/properties/${p.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api<Property>('/properties', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); toast.success(p ? 'Imóvel atualizado' : 'Imóvel criado'); onClose(); },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <Modal title={p ? 'Editar imóvel' : 'Novo imóvel'} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="pl-form-grid">
          <Field label="Nome" full><input className="pl-input" value={f.name} onChange={set('name')} required /></Field>
          <Field label="Tipo">
            <select className="pl-input" value={f.kind} onChange={set('kind')}>
              {['condominio','casa','fazenda','clinica','comercial','outro'].map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
            </select>
          </Field>
          <Field label="Modo de aluguel">
            <select className="pl-input" value={f.rental_mode} onChange={set('rental_mode')}>
              <option value="by_unit">Por unidade</option>
              <option value="whole">Inteiro</option>
            </select>
          </Field>
          <Field label="Matrícula"><input className="pl-input" value={f.matricula} onChange={set('matricula')} /></Field>
          <Field label="Sequencial"><input className="pl-input" value={f.sequencial} onChange={set('sequencial')} /></Field>
          <Field label="Inscrição"><input className="pl-input" value={f.inscricao} onChange={set('inscricao')} /></Field>
          <Field label="Valor de mercado (R$)"><input className="pl-input" value={f.market_value} onChange={set('market_value')} placeholder="0,00" /></Field>
          <Field label="Endereço" full><input className="pl-input" value={f.address_line} onChange={set('address_line')} /></Field>
          <Field label="Cidade"><input className="pl-input" value={f.city} onChange={set('city')} /></Field>
          <Field label="UF"><input className="pl-input" value={f.state} onChange={set('state')} maxLength={2} /></Field>
          <Field label="CEP"><input className="pl-input" value={f.cep} onChange={set('cep')} /></Field>
          <Field label="Observações" full><textarea className="pl-input" value={f.notes} onChange={set('notes')} /></Field>
        </div>
        <FormFoot onCancel={onClose} pending={save.isPending} />
      </form>
    </Modal>
  );
}

function UnitsManager({ property, onClose }: { property: Property; onClose: () => void }) {
  const units = useQuery({ queryKey: ['units', property.id], queryFn: () => api<List<Unit>>(`/units?property_id=${property.id}`) });
  const [form, setForm] = useState<{ id?: number; name: string; base_rent: string; notes: string } | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body = { name: form!.name, base_rent: num(form!.base_rent || '0'), notes: form!.notes || null };
      return form!.id
        ? api<Unit>(`/units/${form!.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api<Unit>(`/properties/${property.id}/units`, { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units', property.id] }); qc.invalidateQueries({ queryKey: ['properties'] }); toast.success('Unidade salva'); setForm(null); },
    onError: (e) => toast.error(errText(e)),
  });
  const del = useMutation({
    mutationFn: (id: number) => api<void>(`/units/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units', property.id] }); qc.invalidateQueries({ queryKey: ['properties'] }); toast.success('Unidade excluída'); },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <Modal title={`Unidades — ${property.name}`} onClose={onClose} wide>
      {units.isLoading && <TableSkeleton cols={3} />}
      {!units.isLoading && !units.data?.items?.length && <Empty icon={<DoorClosed size={28} />} text="Nenhuma unidade." />}
      {!units.isLoading && !!units.data?.items?.length && (
        <DataTable>
          <thead><tr><th>Nome</th><th>Aluguel base</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {units.data!.items.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td>{money(u.base_rent)}</td>
                <td><Status value={u.status} /></td>
                <td><RowActions>
                  <EditBtn onClick={() => setForm({ id: u.id, name: u.name, base_rent: u.base_rent, notes: u.notes ?? '' })} />
                  <DeleteBtn onClick={() => { if (confirmDelete(`Excluir a unidade "${u.name}"?`)) del.mutate(u.id); }} />
                </RowActions></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      {form === null ? (
        <div style={{ marginTop: 20 }}>
          <button className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => setForm({ name: '', base_rent: '', notes: '' })}><Plus size={15} /> Adicionar unidade</button>
        </div>
      ) : (
        <form className="pl-subsection" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="pl-form-grid">
            <Field label="Nome da unidade"><input className="pl-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Aluguel base (R$)"><input className="pl-input" value={form.base_rent} onChange={(e) => setForm({ ...form, base_rent: e.target.value })} placeholder="0,00" /></Field>
            <Field label="Observações" full><input className="pl-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <FormFoot onCancel={() => setForm(null)} pending={save.isPending} />
        </form>
      )}
    </Modal>
  );
}

/* ---------- Inquilinos ---------- */

function Tenants() {
  const { canWrite } = useAuth();
  const tenants = useQuery({ queryKey: ['tenants'], queryFn: () => api<List<Tenant>>('/tenants') });
  const [editing, setEditing] = useState<Tenant | null | undefined>(undefined);
  const del = useMutation({
    mutationFn: (id: number) => api<void>(`/tenants/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); toast.success('Inquilino excluído'); },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <Page title="Inquilinos" subtitle="Cadastro simplificado de locatários: nome, CPF e contato."
      action={canWrite && <NewBtn label="Novo inquilino" onClick={() => setEditing(null)} />}>
      {tenants.isError && <QueryError />}
      {tenants.isLoading && <TableSkeleton cols={4} />}
      {!tenants.isLoading && !tenants.data?.items?.length && (
        <Empty icon={<Users2 size={32} />} text="Nenhum inquilino cadastrado." />
      )}
      {!tenants.isLoading && !!tenants.data?.items?.length && (
        <DataTable>
          <thead><tr><th>Nome</th><th>CPF</th><th>Email</th><th>Telefone</th>{canWrite && <th></th>}</tr></thead>
          <tbody>
            {tenants.data!.items.map((t) => (
              <tr key={t.id}>
                <td style={{ fontWeight: 500 }}>{t.full_name}</td>
                <td>{t.cpf ?? '—'}</td>
                <td>{t.email ?? '—'}</td>
                <td>{t.phone ?? '—'}</td>
                {canWrite && <td><RowActions>
                  <EditBtn onClick={() => setEditing(t)} />
                  <DeleteBtn onClick={() => { if (confirmDelete(`Excluir "${t.full_name}"?`)) del.mutate(t.id); }} />
                </RowActions></td>}
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      {editing !== undefined && <TenantForm tenant={editing} onClose={() => setEditing(undefined)} />}
    </Page>
  );
}

function TenantForm({ tenant, onClose }: { tenant: Tenant | null; onClose: () => void }) {
  const t = tenant;
  const [f, setF] = useState({ full_name: t?.full_name ?? '', cpf: t?.cpf ?? '', phone: t?.phone ?? '', email: t?.email ?? '', notes: t?.notes ?? '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => {
      const body = { full_name: f.full_name, cpf: f.cpf || null, phone: f.phone || null, email: f.email || null, notes: f.notes || null };
      return t ? api<Tenant>(`/tenants/${t.id}`, { method: 'PATCH', body: JSON.stringify(body) })
               : api<Tenant>('/tenants', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); toast.success(t ? 'Inquilino atualizado' : 'Inquilino criado'); onClose(); },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <Modal title={t ? 'Editar inquilino' : 'Novo inquilino'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="pl-form-grid">
          <Field label="Nome completo" full><input className="pl-input" value={f.full_name} onChange={set('full_name')} required /></Field>
          <Field label="CPF"><input className="pl-input" value={f.cpf} onChange={set('cpf')} /></Field>
          <Field label="Telefone"><input className="pl-input" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Email" full><input className="pl-input" type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Observações" full><textarea className="pl-input" value={f.notes} onChange={set('notes')} /></Field>
        </div>
        <FormFoot onCancel={onClose} pending={save.isPending} />
      </form>
    </Modal>
  );
}

/* ---------- Contratos ---------- */

function Accordion({ title, count, defaultOpen, children }: { title: React.ReactNode; count?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="pl-accordion">
      <button type="button" className="pl-accordion__head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ChevronDown size={16} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
        <span>{title}</span>
        {count != null && <span className="pl-accordion__count">{count}</span>}
      </button>
      {open && <div className="pl-accordion__body">{children}</div>}
    </div>
  );
}

function LeaseTable({ leases, unitName, propName, showProperty, canWrite, onEdit, onAction }: {
  leases: Lease[]; unitName: (id: number) => string; propName?: (lease: Lease) => string; showProperty?: boolean; canWrite: boolean;
  onEdit: (l: Lease) => void; onAction: (l: Lease, kind: 'end' | 'cancel') => void;
}) {
  return (
    <DataTable>
      <thead><tr>{showProperty && <th>Imóvel</th>}<th>Unidade</th><th>Inquilinos</th><th>Início</th><th>Fim</th><th>Aluguel</th><th>Status</th>{canWrite && <th></th>}</tr></thead>
      <tbody>
        {leases.map((lease) => (
          <tr key={lease.id}>
            {showProperty && <td>{propName?.(lease) ?? '—'}</td>}
            <td>{unitName(lease.unit_id)}</td>
            <td>{lease.tenants?.map((x) => x.tenant?.full_name).filter(Boolean).join(', ') || '—'}</td>
            <td>{brDate(lease.start_date)}</td>
            <td>{brDate(lease.end_date)}</td>
            <td style={{ fontWeight: 500 }}>{money(lease.monthly_rent)}</td>
            <td><Status value={lease.status} /></td>
            {canWrite && <td><RowActions>
              <EditBtn onClick={() => onEdit(lease)} />
              {lease.status !== 'ended' && lease.status !== 'cancelled' && (
                <>
                  <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => { if (confirmDelete('Encerrar este contrato hoje?')) onAction(lease, 'end'); }}>Encerrar</button>
                  <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => { if (confirmDelete('Cancelar este contrato?')) onAction(lease, 'cancel'); }}>Cancelar</button>
                </>
              )}
            </RowActions></td>}
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

function Leases() {
  const { canWrite } = useAuth();
  const leases = useQuery({ queryKey: ['leases'], queryFn: () => api<List<Lease>>('/leases') });
  const units = useQuery({ queryKey: ['units-all'], queryFn: () => api<List<Unit>>('/units?limit=500') });
  const props = useQuery({ queryKey: ['properties'], queryFn: () => api<List<Property>>('/properties') });
  const [editing, setEditing] = useState<Lease | null | undefined>(undefined);

  const unitById = useMemo(() => new Map((units.data?.items ?? []).map((u) => [u.id, u])), [units.data]);
  const propById = useMemo(() => new Map((props.data?.items ?? []).map((p) => [p.id, p])), [props.data]);
  const unitName = (id: number) => unitById.get(id)?.name ?? `#${id}`;
  const propForLease = (l: Lease) => { const u = unitById.get(l.unit_id); return u ? propById.get(u.property_id) : undefined; };

  const action = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: 'end' | 'cancel' }) => api<Lease>(`/leases/${id}/${kind}`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leases'] }); qc.invalidateQueries({ queryKey: ['properties'] }); toast.success('Contrato atualizado'); },
    onError: (e) => toast.error(errText(e)),
  });
  const gen = useMutation({
    mutationFn: () => api<any>('/rent-charges/generate', { method: 'POST' }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['inadimplencia'] }); toast.success(`${r.count} cobrança(s) gerada(s)`); },
    onError: (e) => toast.error(errText(e)),
  });

  const { condos, others } = useMemo(() => {
    const condos = new Map<number, { prop: Property; leases: Lease[] }>();
    const others: Lease[] = [];
    for (const l of leases.data?.items ?? []) {
      const p = propForLease(l);
      // condomínios multi-unidade (by_unit) viram acordeão; os demais (inteiros) vêm sozinhos
      if (p && p.rental_mode === 'by_unit') {
        const g = condos.get(p.id) ?? { prop: p, leases: [] };
        g.leases.push(l); condos.set(p.id, g);
      } else { others.push(l); }
    }
    return { condos: [...condos.values()].sort((a, b) => a.prop.name.localeCompare(b.prop.name)), others };
  }, [leases.data, unitById, propById]);

  const onEdit = (l: Lease) => setEditing(l);
  const onAction = (l: Lease, kind: 'end' | 'cancel') => action.mutate({ id: l.id, kind });

  return (
    <Page title="Contratos" subtitle="Contratos de locação unidade ↔ inquilino, agrupados por condomínio."
      action={canWrite && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="pl-btn pl-btn--ghost" onClick={() => gen.mutate()} disabled={gen.isPending}>Gerar cobranças</button>
          <NewBtn label="Novo contrato" onClick={() => setEditing(null)} />
        </div>
      )}>
      {leases.isError && <QueryError />}
      {leases.isLoading && <TableSkeleton cols={7} />}
      {!leases.isLoading && !leases.data?.items?.length && (
        <Empty icon={<FileText size={32} />} text="Nenhum contrato encontrado." detail="Associe uma unidade a um inquilino para gerar cobranças mensais." />
      )}
      {!leases.isLoading && !!leases.data?.items?.length && (
        <>
          {condos.map((g) => {
            const ativos = g.leases.filter((l) => l.status === 'active').length;
            return (
              <Accordion key={g.prop.id} title={g.prop.name} count={`${ativos} ativo(s) · ${g.leases.length} contrato(s)`}>
                <LeaseTable leases={g.leases} unitName={unitName} canWrite={canWrite} onEdit={onEdit} onAction={onAction} />
              </Accordion>
            );
          })}
          {!!others.length && (
            <div style={{ marginTop: condos.length ? 24 : 0 }}>
              <h3 className="pl-h3" style={{ margin: '0 0 12px' }}>Outros imóveis</h3>
              <LeaseTable leases={others} unitName={unitName} showProperty propName={(l) => propForLease(l)?.name ?? '—'} canWrite={canWrite} onEdit={onEdit} onAction={onAction} />
            </div>
          )}
        </>
      )}
      {editing !== undefined && <LeaseForm lease={editing} onClose={() => setEditing(undefined)} />}
    </Page>
  );
}

function LeaseForm({ lease, onClose }: { lease: Lease | null; onClose: () => void }) {
  const l = lease;
  const units = useQuery({ queryKey: ['units-all'], queryFn: () => api<List<Unit>>('/units?limit=500') });
  const props = useQuery({ queryKey: ['properties'], queryFn: () => api<List<Property>>('/properties') });
  const tenants = useQuery({ queryKey: ['tenants'], queryFn: () => api<List<Tenant>>('/tenants') });
  const propName = (pid: number) => props.data?.items.find((p) => p.id === pid)?.name ?? '';

  const [f, setF] = useState({
    unit_id: l?.unit_id ? String(l.unit_id) : '',
    start_date: l?.start_date ?? today(),
    end_date: l?.end_date ?? '',
    monthly_rent: l?.monthly_rent ?? '',
    due_day: l?.due_day ? String(l.due_day) : '',
    deposit: l?.deposit ?? '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  const [primary, setPrimary] = useState<number | null>(l?.tenants?.find((t) => t.is_primary)?.tenant_id ?? l?.tenants?.[0]?.tenant_id ?? null);
  const [extra, setExtra] = useState<number[]>(l?.tenants?.filter((t) => !t.is_primary).map((t) => t.tenant_id) ?? []);

  const save = useMutation({
    mutationFn: () => {
      if (!primary) throw new Error('Selecione o inquilino principal');
      const tenantList = [{ tenant_id: primary, is_primary: true }, ...extra.filter((id) => id !== primary).map((id) => ({ tenant_id: id, is_primary: false }))];
      const body: any = {
        unit_id: Number(f.unit_id), start_date: f.start_date, end_date: f.end_date,
        monthly_rent: num(f.monthly_rent), due_day: f.due_day ? Number(f.due_day) : null,
        deposit: f.deposit ? num(f.deposit) : null, tenants: tenantList,
      };
      return l ? api<Lease>(`/leases/${l.id}`, { method: 'PATCH', body: JSON.stringify(body) })
               : api<Lease>('/leases', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leases'] }); qc.invalidateQueries({ queryKey: ['properties'] }); toast.success(l ? 'Contrato atualizado' : 'Contrato criado'); onClose(); },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <Modal title={l ? 'Editar contrato' : 'Novo contrato'} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="pl-form-grid">
          <Field label="Unidade" full>
            <select className="pl-input" value={f.unit_id} onChange={set('unit_id')} required>
              <option value="">Selecione…</option>
              {units.data?.items.map((u) => <option key={u.id} value={u.id}>{propName(u.property_id)} — {u.name}</option>)}
            </select>
          </Field>
          <Field label="Início"><input className="pl-input" type="date" value={f.start_date} onChange={set('start_date')} required /></Field>
          <Field label="Fim"><input className="pl-input" type="date" value={f.end_date} onChange={set('end_date')} required /></Field>
          <Field label="Valor do aluguel (R$)"><input className="pl-input" value={f.monthly_rent} onChange={set('monthly_rent')} placeholder="0,00" required /></Field>
          <Field label="Dia de vencimento (1–28)"><input className="pl-input" type="number" min={1} max={28} value={f.due_day} onChange={set('due_day')} placeholder="dia do início" /></Field>
          <Field label="Caução (R$)"><input className="pl-input" value={f.deposit} onChange={set('deposit')} placeholder="opcional" /></Field>
          <Field label="Inquilino principal" full>
            <select className="pl-input" value={primary ?? ''} onChange={(e) => setPrimary(e.target.value ? Number(e.target.value) : null)} required>
              <option value="">Selecione…</option>
              {tenants.data?.items.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </Field>
        </div>
        {!!tenants.data?.items.length && (
          <div className="pl-subsection">
            <span className="pl-label">Co-locatários (opcional)</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              {tenants.data.items.filter((t) => t.id !== primary).map((t) => (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <input type="checkbox" checked={extra.includes(t.id)} onChange={(e) => setExtra(e.target.checked ? [...extra, t.id] : extra.filter((id) => id !== t.id))} />
                  {t.full_name}
                </label>
              ))}
            </div>
          </div>
        )}
        <FormFoot onCancel={onClose} pending={save.isPending} />
      </form>
    </Modal>
  );
}

/* ---------- Inadimplência ---------- */

function Delinquency() {
  const query = useQuery({ queryKey: ['inadimplencia'], queryFn: () => api<any>('/inadimplencia') });
  const loading = query.isLoading;

  return (
    <Page title="Inadimplência" subtitle="Cobranças vencidas ou pagas parcialmente, agrupadas por contrato e inquilino.">
      {query.isError && <QueryError />}
      <div className="pl-dashboard-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <KpiCard label="Total em atraso"   value={money(query.data?.total_em_atraso)} loading={loading} />
        <KpiCard label="Cobranças críticas" value={query.data?.items?.length ?? 0}    loading={loading} />
      </div>
      {loading && <TableSkeleton cols={4} />}
      {!loading && !query.data?.items?.length && (
        <Empty icon={<AlertCircle size={32} />} text="Nenhuma inadimplência registrada." detail="Ótimo sinal: todas as cobranças estão em dia." />
      )}
      {!loading && !!query.data?.items?.length && (
        <DataTable>
          <thead><tr><th>Contrato</th><th>Inquilinos</th><th>Valor em atraso</th><th>Dias</th></tr></thead>
          <tbody>
            {query.data.items.map((item: any) => (
              <tr key={item.charge.id}>
                <td className="pl-mono" style={{ color: 'var(--pl-stone-500)' }}>{item.lease_id}</td>
                <td>{item.tenants.join(', ')}</td>
                <td style={{ fontWeight: 500, color: 'var(--pl-danger)' }}>{money(item.total_em_atraso)}</td>
                <td><span className="pl-status pl-status--overdue">{item.dias_atraso}d</span></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Page>
  );
}

/* ---------- Despesas ---------- */

function Expenses() {
  const { canWrite } = useAuth();
  const expenses = useQuery({ queryKey: ['expenses'], queryFn: () => api<List<Expense>>('/expenses') });
  const props = useQuery({ queryKey: ['properties'], queryFn: () => api<List<Property>>('/properties') });
  const [editing, setEditing] = useState<Expense | null | undefined>(undefined);
  const propName = (pid?: number | null) => pid ? (props.data?.items.find((p) => p.id === pid)?.name ?? `#${pid}`) : '—';

  const pay = useMutation({
    mutationFn: (id: number) => api<Expense>(`/expenses/${id}/payment?paid_date=${today()}`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Pagamento registrado'); },
    onError: (e) => toast.error(errText(e)),
  });
  const del = useMutation({
    mutationFn: (id: number) => api<void>(`/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Despesa excluída'); },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <Page title="Despesas" subtitle="IPTU, energia, água, parcelas de empréstimo e outras despesas por imóvel."
      action={canWrite && <NewBtn label="Nova despesa" onClick={() => setEditing(null)} />}>
      {expenses.isError && <QueryError />}
      {expenses.isLoading && <TableSkeleton cols={6} />}
      {!expenses.isLoading && !expenses.data?.items?.length && (
        <Empty icon={<ReceiptText size={32} />} text="Nenhuma despesa cadastrada." />
      )}
      {!expenses.isLoading && !!expenses.data?.items?.length && (
        <DataTable>
          <thead><tr><th>Imóvel</th><th>Categoria</th><th>Competência</th><th>Valor</th><th>Status</th>{canWrite && <th></th>}</tr></thead>
          <tbody>
            {expenses.data!.items.map((expense) => (
              <tr key={expense.id}>
                <td>{expense.debt_id ? <span className="pl-status pl-status--neutral">empréstimo</span> : propName(expense.property_id)}</td>
                <td>{categoryLabel(expense.category)}</td>
                <td>{brDate(expense.reference_period)}</td>
                <td style={{ fontWeight: 500 }}>{money(expense.amount)}</td>
                <td><Status value={expense.status} /></td>
                {canWrite && <td><RowActions>
                  {expense.status !== 'paid' && <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => pay.mutate(expense.id)}>Pagar</button>}
                  <EditBtn onClick={() => setEditing(expense)} />
                  <DeleteBtn onClick={() => { if (confirmDelete('Excluir esta despesa?')) del.mutate(expense.id); }} />
                </RowActions></td>}
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      {editing !== undefined && <ExpenseForm expense={editing} onClose={() => setEditing(undefined)} />}
    </Page>
  );
}

function ExpenseForm({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const ex = expense;
  const props = useQuery({ queryKey: ['properties'], queryFn: () => api<List<Property>>('/properties') });
  const [f, setF] = useState({
    property_id: ex?.property_id ? String(ex.property_id) : '',
    category: ex?.category ?? 'iptu',
    reference_period: (ex?.reference_period ?? today()).slice(0, 7),
    amount: ex?.amount ?? '',
    due_date: ex?.due_date ?? '',
    notes: ex?.notes ?? '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        category: f.category, reference_period: `${f.reference_period}-01`, amount: num(f.amount),
        due_date: f.due_date || null, notes: f.notes || null,
      };
      if (ex) return api<Expense>(`/expenses/${ex.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      if (!f.property_id) throw new Error('Selecione o imóvel');
      return api<Expense>(`/properties/${f.property_id}/expenses`, { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success(ex ? 'Despesa atualizada' : 'Despesa criada'); onClose(); },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <Modal title={ex ? 'Editar despesa' : 'Nova despesa'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="pl-form-grid">
          {!ex && (
            <Field label="Imóvel" full>
              <select className="pl-input" value={f.property_id} onChange={set('property_id')} required>
                <option value="">Selecione…</option>
                {props.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Categoria">
            <select className="pl-input" value={f.category} onChange={set('category')}>
              {['iptu','energia','agua','emprestimo','outros'].map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
            </select>
          </Field>
          <Field label="Competência"><input className="pl-input" type="month" value={f.reference_period} onChange={set('reference_period')} required /></Field>
          <Field label="Valor (R$)"><input className="pl-input" value={f.amount} onChange={set('amount')} placeholder="0,00" required /></Field>
          <Field label="Vencimento"><input className="pl-input" type="date" value={f.due_date} onChange={set('due_date')} /></Field>
          <Field label="Observações" full><textarea className="pl-input" value={f.notes} onChange={set('notes')} /></Field>
        </div>
        <FormFoot onCancel={onClose} pending={save.isPending} />
      </form>
    </Modal>
  );
}

/* ---------- Patrimônio & Dívidas ---------- */

function Patrimony() {
  const { canWrite } = useAuth();
  const pat   = useQuery({ queryKey: ['patrimonio'], queryFn: () => api<any>('/reports/patrimonio') });
  const debts = useQuery({ queryKey: ['debts'],      queryFn: () => api<List<Debt>>('/debts') });
  const [editing, setEditing] = useState<Debt | null | undefined>(undefined);
  const loading = pat.isLoading;

  const del = useMutation({
    mutationFn: (id: number) => api<void>(`/debts/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); qc.invalidateQueries({ queryKey: ['patrimonio'] }); toast.success('Dívida excluída'); },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <Page title="Patrimônio & Dívidas" subtitle="Patrimônio bruto, saldo devedor e patrimônio líquido. Empréstimos geram parcelas em Despesas."
      action={canWrite && <NewBtn label="Nova dívida / empréstimo" onClick={() => setEditing(null)} />}>
      {(pat.isError || debts.isError) && <QueryError />}
      <div className="pl-dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <KpiCard label="Patrimônio"         value={money(pat.data?.patrimonio_total)}  loading={loading} />
        <KpiCard label="Dívidas"            value={money(pat.data?.dividas_total)}     loading={loading} />
        <KpiCard label="Patrimônio líquido" value={money(pat.data?.patrimonio_liquido)} loading={loading} />
      </div>
      <h3 className="pl-h3" style={{ margin: '0 0 16px' }}>Dívidas e empréstimos</h3>
      {debts.isLoading && <TableSkeleton cols={5} />}
      {!debts.isLoading && !debts.data?.items?.length && (
        <Empty icon={<Landmark size={32} />} text="Nenhuma dívida cadastrada." detail="Financiamentos e consignados aparecem aqui quando cadastrados." />
      )}
      {!debts.isLoading && !!debts.data?.items?.length && (
        <DataTable>
          <thead><tr><th>Nome</th><th>Tipo</th><th>Parcela</th><th>Parcelas</th><th>Saldo devedor</th>{canWrite && <th></th>}</tr></thead>
          <tbody>
            {debts.data!.items.map((debt) => (
              <tr key={debt.id}>
                <td style={{ fontWeight: 500 }}>{debt.name}</td>
                <td>{debtKindLabel(debt.kind)}</td>
                <td>{debt.installment_amount ? money(debt.installment_amount) : '—'}</td>
                <td>{debt.installments_count ?? '—'}</td>
                <td style={{ fontWeight: 500, color: 'var(--pl-danger)' }}>{money(debt.outstanding_balance)}</td>
                {canWrite && <td><RowActions>
                  <EditBtn onClick={() => setEditing(debt)} />
                  <DeleteBtn onClick={() => { if (confirmDelete(`Excluir "${debt.name}"?`)) del.mutate(debt.id); }} />
                </RowActions></td>}
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      {editing !== undefined && <DebtForm debt={editing} onClose={() => setEditing(undefined)} />}
    </Page>
  );
}

function DebtForm({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const d = debt;
  const props = useQuery({ queryKey: ['properties'], queryFn: () => api<List<Property>>('/properties') });
  const [f, setF] = useState({
    name: d?.name ?? '', kind: d?.kind ?? 'financiamento',
    principal_amount: d?.principal_amount ?? '', outstanding_balance: d?.outstanding_balance ?? '',
    installment_amount: d?.installment_amount ?? '', installments_count: d?.installments_count ? String(d.installments_count) : '',
    first_due_date: d?.first_due_date ?? '', property_id: d?.property_id ? String(d.property_id) : '', notes: d?.notes ?? '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => {
      const body: any = {
        name: f.name, kind: f.kind, principal_amount: num(f.principal_amount || '0'),
        outstanding_balance: num(f.outstanding_balance || '0'),
        installment_amount: f.installment_amount ? num(f.installment_amount) : null,
        installments_count: f.installments_count ? Number(f.installments_count) : null,
        first_due_date: f.first_due_date || null,
        property_id: f.property_id ? Number(f.property_id) : null, notes: f.notes || null,
      };
      return d ? api<Debt>(`/debts/${d.id}`, { method: 'PATCH', body: JSON.stringify(body) })
               : api<Debt>('/debts', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); qc.invalidateQueries({ queryKey: ['patrimonio'] }); qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success(d ? 'Dívida atualizada' : 'Dívida criada'); onClose(); },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <Modal title={d ? 'Editar dívida' : 'Nova dívida / empréstimo'} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="pl-form-grid">
          <Field label="Nome" full><input className="pl-input" value={f.name} onChange={set('name')} required /></Field>
          <Field label="Tipo">
            <select className="pl-input" value={f.kind} onChange={set('kind')}>
              {['financiamento','consignado','outro'].map((k) => <option key={k} value={k}>{debtKindLabel(k)}</option>)}
            </select>
          </Field>
          <Field label="Imóvel vinculado">
            <select className="pl-input" value={f.property_id} onChange={set('property_id')}>
              <option value="">Nenhum</option>
              {props.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Valor contratado (R$)"><input className="pl-input" value={f.principal_amount} onChange={set('principal_amount')} placeholder="0,00" required /></Field>
          <Field label="Saldo devedor (R$)"><input className="pl-input" value={f.outstanding_balance} onChange={set('outstanding_balance')} placeholder="0,00" required /></Field>
        </div>
        <div className="pl-subsection">
          <span className="pl-label">Parcelas (geram despesas automaticamente)</span>
          <div className="pl-form-grid" style={{ marginTop: 4 }}>
            <Field label="Valor da parcela (R$)"><input className="pl-input" value={f.installment_amount} onChange={set('installment_amount')} placeholder="0,00" /></Field>
            <Field label="Nº de parcelas"><input className="pl-input" type="number" min={1} value={f.installments_count} onChange={set('installments_count')} /></Field>
            <Field label="1º vencimento" full><input className="pl-input" type="date" value={f.first_due_date} onChange={set('first_due_date')} /></Field>
          </div>
          {!d && <p style={{ color: 'var(--pl-text-muted)', fontSize: 13, marginTop: 4 }}>Preencha os três campos para gerar as despesas-parcela ao salvar.</p>}
        </div>
        <Field label="Observações" full><textarea className="pl-input" value={f.notes} onChange={set('notes')} /></Field>
        <FormFoot onCancel={onClose} pending={save.isPending} />
      </form>
    </Modal>
  );
}

/* ---------- Documentos ---------- */

const ownerTypes = [
  { v: 'rent_charge', label: 'Cobrança' },
  { v: 'expense', label: 'Despesa' },
  { v: 'lease', label: 'Contrato' },
  { v: 'property', label: 'Imóvel' },
  { v: 'debt', label: 'Dívida' },
];
const docTypes = [
  { v: 'comprovante_pagamento', label: 'Comprovante de pagamento' },
  { v: 'comprovante_imposto', label: 'Comprovante de imposto' },
  { v: 'contrato', label: 'Contrato' },
  { v: 'outro', label: 'Outro' },
];

function Documents() {
  const { canWrite } = useAuth();
  const [ownerType, setOwnerType] = useState('property');
  const [ownerId, setOwnerId] = useState('');
  const [docType, setDocType] = useState('outro');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const enabled = !!ownerId;
  const list = useQuery({
    queryKey: ['documents', ownerType, ownerId],
    queryFn: () => api<{ items: DocItem[] }>(`/documents?owner_entity_type=${ownerType}&owner_entity_id=${ownerId}`),
    enabled,
  });

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('document_type', docType);
      fd.append('owner_entity_type', ownerType);
      fd.append('owner_entity_id', ownerId);
      fd.append('file', file!);
      return api<DocItem>('/documents', { method: 'POST', body: fd });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents', ownerType, ownerId] }); toast.success('Documento enviado'); setFile(null); if (fileRef.current) fileRef.current.value = ''; },
    onError: (e) => toast.error(errText(e)),
  });
  const del = useMutation({
    mutationFn: (id: number) => api<void>(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents', ownerType, ownerId] }); toast.success('Documento excluído'); },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <Page title="Documentos" subtitle="Comprovantes, contratos e arquivos anexados às entidades do sistema.">
      <div className="pl-panel">
        <div className="pl-form-grid">
          <Field label="Anexar a">
            <select className="pl-input" value={ownerType} onChange={(e) => setOwnerType(e.target.value)}>
              {ownerTypes.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="ID do registro"><input className="pl-input" type="number" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="ex.: 1" /></Field>
          {canWrite && <>
            <Field label="Tipo de documento">
              <select className="pl-input" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {docTypes.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="Arquivo"><input ref={fileRef} className="pl-input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ paddingTop: 10 }} /></Field>
          </>}
        </div>
        {canWrite && (
          <div style={{ marginTop: 16 }}>
            <button className="pl-btn pl-btn--primary" disabled={!enabled || !file || upload.isPending} onClick={() => upload.mutate()}>
              <Upload size={16} /> {upload.isPending ? 'Enviando…' : 'Enviar documento'}
            </button>
          </div>
        )}
      </div>

      {!enabled && <Empty icon={<FolderOpen size={32} />} text="Informe o tipo e o ID do registro." detail="Os documentos anexados aparecem aqui." />}
      {enabled && list.isLoading && <TableSkeleton cols={4} />}
      {enabled && !list.isLoading && !list.data?.items?.length && <Empty icon={<FolderOpen size={32} />} text="Nenhum documento para este registro." />}
      {enabled && !list.isLoading && !!list.data?.items?.length && (
        <DataTable>
          <thead><tr><th>Arquivo</th><th>Tipo</th><th>Tamanho</th><th></th></tr></thead>
          <tbody>
            {list.data!.items.map((doc) => (
              <tr key={doc.id}>
                <td style={{ fontWeight: 500 }}>{doc.original_filename}</td>
                <td>{docTypes.find((d) => d.v === doc.document_type)?.label ?? doc.document_type}</td>
                <td>{(doc.size_bytes / 1024).toFixed(0)} KB</td>
                <td><RowActions>
                  <button type="button" className="pl-icon-btn" title="Baixar" onClick={() => downloadDocument(doc.id, doc.original_filename).catch((e) => toast.error(errText(e)))}><Download size={15} /></button>
                  {canWrite && <DeleteBtn onClick={() => { if (confirmDelete('Excluir este documento?')) del.mutate(doc.id); }} />}
                </RowActions></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Page>
  );
}

/* ---------- Usuários ---------- */

function Users() {
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<List<User>>('/users') });
  const [creating, setCreating] = useState(false);
  const deactivate = useMutation({
    mutationFn: (id: number) => api<User>(`/users/${id}/deactivate`, { method: 'PATCH' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Usuário desativado'); },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <Page title="Usuários" subtitle="Controle de acesso por papel. Apenas administradores criam usuários."
      action={<NewBtn label="Novo usuário" onClick={() => setCreating(true)} />}>
      {users.isError && <QueryError />}
      {users.isLoading && <TableSkeleton cols={5} />}
      {!users.isLoading && !users.data?.items?.length && (
        <Empty icon={<UserCog size={32} />} text="Nenhum usuário cadastrado." />
      )}
      {!users.isLoading && !!users.data?.items?.length && (
        <DataTable>
          <thead><tr><th>Usuário</th><th>Nome</th><th>Papel</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.data!.items.map((user) => (
              <tr key={user.id}>
                <td className="pl-mono">{user.username}</td>
                <td style={{ fontWeight: 500 }}>{user.full_name}</td>
                <td>{roleLabel(user.role)}</td>
                <td><Status value={user.is_active ? 'active' : 'cancelled'} label={user.is_active ? 'Ativo' : 'Inativo'} /></td>
                <td><RowActions>
                  {user.is_active && <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => { if (confirmDelete(`Desativar "${user.username}"?`)) deactivate.mutate(user.id); }}>Desativar</button>}
                </RowActions></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      {creating && <UserForm onClose={() => setCreating(false)} />}
    </Page>
  );
}

function UserForm({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ username: '', full_name: '', password: '', role: 'viewer', email: '' });
  const [mustChange, setMustChange] = useState(true);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => api<User>('/users', { method: 'POST', body: JSON.stringify({ username: f.username, full_name: f.full_name, password: f.password, role: f.role, email: f.email || null, must_change_password: mustChange }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Usuário criado'); onClose(); },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <Modal title="Novo usuário" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="pl-form-grid">
          <Field label="Usuário"><input className="pl-input" value={f.username} onChange={set('username')} required minLength={3} autoComplete="off" /></Field>
          <Field label="Papel">
            <select className="pl-input" value={f.role} onChange={set('role')}>
              <option value="admin">Administrador</option>
              <option value="manager">Gestor</option>
              <option value="viewer">Leitor</option>
            </select>
          </Field>
          <Field label="Nome completo" full><input className="pl-input" value={f.full_name} onChange={set('full_name')} required /></Field>
          <Field label="Email (opcional)" full><input className="pl-input" type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Senha" full><input className="pl-input" type="password" value={f.password} onChange={set('password')} required minLength={6} autoComplete="new-password" /></Field>
          <label className="pl-field pl-field--full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
            <span>Exigir troca de senha no primeiro acesso</span>
          </label>
        </div>
        <FormFoot onCancel={onClose} pending={save.isPending} submitLabel="Criar usuário" />
      </form>
    </Modal>
  );
}

/* ---------- Conciliação (por aluguel) ---------- */

const MIN_MONTH = '2026-04';

function Conciliacao() {
  const { canWrite } = useAuth();
  const [month, setMonth] = useState(MIN_MONTH);
  const data = useQuery({ queryKey: ['recon-charges', month], queryFn: () => api<ReconChargesResp>(`/reconciliation/charges?month=${month}`) });
  const [pickFor, setPickFor] = useState<ReconChargeRow | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['recon-charges', month] });
    qc.invalidateQueries({ queryKey: ['bank-txns', month] });
    qc.invalidateQueries({ queryKey: ['inadimplencia'] });
  };
  const act = useMutation({
    mutationFn: ({ txnId, path, payload }: { txnId: number; path: string; payload?: any }) => api<any>(`/bank/transactions/${txnId}/${path}`, { method: 'POST', body: payload ? JSON.stringify(payload) : undefined }),
    onSuccess: () => { refresh(); },
    onError: (e) => toast.error(errText(e)),
  });
  const ligar = (chargeId: number, txnId: number) => act.mutate({ txnId, path: 'match', payload: { rent_charge_id: chargeId } });

  const rows = data.data?.items ?? [];
  return (
    <Page title="Conciliação de aluguéis" subtitle="Cada aluguel previsto do mês e a ligação com o lançamento recebido no extrato.">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span className="pl-label">Mês</span>
        <input className="pl-input" type="month" min={MIN_MONTH} value={month} onChange={(e) => setMonth(e.target.value < MIN_MONTH ? MIN_MONTH : e.target.value)} style={{ width: 180 }} />
      </div>
      <div className="pl-dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <KpiCard label="Esperado" value={money(data.data?.esperado)} loading={data.isLoading} />
        <KpiCard label="Recebido (conciliado)" value={money(data.data?.recebido)} loading={data.isLoading} />
        <KpiCard label="Em aberto" value={money(data.data?.em_aberto)} loading={data.isLoading} />
      </div>
      {data.isLoading ? <TableSkeleton cols={6} /> : !rows.length ? <Empty icon={<ArrowLeftRight size={32} />} text="Nenhum aluguel previsto neste mês." detail="Gere as cobranças em Contratos." /> : (
        <DataTable>
          <thead><tr><th>Contrato</th><th>Vencimento</th><th>Esperado</th><th>Status</th><th>Extrato</th>{canWrite && <th></th>}</tr></thead>
          <tbody>
            {rows.map((r) => {
              const lk = r.linked_txn; const sg = r.suggested_txn;
              return (
                <tr key={r.charge.id}>
                  <td><div style={{ fontWeight: 500 }}>{r.property} · {r.unit}</div><div style={{ fontSize: 12, color: 'var(--pl-stone-500)' }}>{r.tenants || '—'}</div></td>
                  <td>{brDate(r.charge.due_date)}</td>
                  <td style={{ fontWeight: 500 }}>{money(r.charge.amount_due)}</td>
                  <td><Status value={r.charge.status} /></td>
                  <td>
                    {lk
                      ? <span>{brDate(lk.posted_date)} · {money(lk.amount)} · {lk.counterparty_name ?? lk.memo}</span>
                      : sg
                        ? <span>→ {sg.counterparty_name ?? sg.memo} · {money(sg.amount)}{r.confidence && <span className="pl-status pl-status--neutral" style={{ marginLeft: 6 }}>{r.confidence}</span>}</span>
                        : <span style={{ color: 'var(--pl-stone-500)' }}>sem sugestão</span>}
                  </td>
                  {canWrite && <td><RowActions>
                    {lk && <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => act.mutate({ txnId: lk.id, path: 'unmatch' })}>Desligar</button>}
                    {!lk && sg && <button type="button" className="pl-btn pl-btn--primary pl-btn--sm" onClick={() => ligar(r.charge.id, sg.id)}><Link2 size={14} /> Ligar</button>}
                    {!lk && <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => setPickFor(r)}>Escolher…</button>}
                  </RowActions></td>}
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
      {pickFor && <TxnPicker charge={pickFor} month={month} onClose={() => setPickFor(null)} onPick={(txnId) => { ligar(pickFor.charge.id, txnId); setPickFor(null); }} />}
    </Page>
  );
}

function TxnPicker({ charge, month, onClose, onPick }: { charge: ReconChargeRow; month: string; onClose: () => void; onPick: (txnId: number) => void }) {
  const txns = useQuery({ queryKey: ['bank-credits-pending', month], queryFn: () => api<List<BankTxn>>(`/bank/transactions?month=${month}&kind=credit&status=pending`) });
  const rows = txns.data?.items ?? [];
  return (
    <Modal title={`Ligar aluguel de ${money(charge.charge.amount_due)} — ${charge.tenants}`} onClose={onClose} wide>
      {txns.isLoading ? <TableSkeleton cols={4} /> : !rows.length ? <Empty text="Nenhum crédito pendente neste mês." /> : (
        <DataTable>
          <thead><tr><th>Data</th><th>Pagador</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{brDate(t.posted_date)}</td>
                <td><div style={{ fontWeight: 500 }}>{t.counterparty_name ?? t.memo}</div>{t.counterparty_doc && <div className="pl-mono" style={{ fontSize: 12, color: 'var(--pl-stone-500)' }}>{t.counterparty_doc}</div>}</td>
                <td style={{ fontWeight: 500 }}>{money(t.amount)}</td>
                <td><button type="button" className="pl-btn pl-btn--primary pl-btn--sm" onClick={() => onPick(t.id)}>Ligar</button></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Modal>
  );
}

/* ---------- Extrato (visão do extrato bancário) ---------- */

function Extrato() {
  const { canWrite } = useAuth();
  const [month, setMonth] = useState(MIN_MONTH);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const summary = useQuery({ queryKey: ['recon-summary', month], queryFn: () => api<ReconSummary>(`/reconciliation/summary?month=${month}`) });
  const txns = useQuery({ queryKey: ['bank-txns', month], queryFn: () => api<List<BankTxn>>(`/bank/transactions?month=${month}`) });
  const [expenseFor, setExpenseFor] = useState<BankTxn | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['recon-summary', month] });
    qc.invalidateQueries({ queryKey: ['bank-txns', month] });
    qc.invalidateQueries({ queryKey: ['recon-charges', month] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
  };
  const upload = useMutation({
    mutationFn: (files: FileList) => { const fd = new FormData(); Array.from(files).forEach((f) => fd.append('files', f)); return api<any>('/bank/import', { method: 'POST', body: fd }); },
    onSuccess: (r) => { refresh(); toast.success(`Importado: ${r.created} novo(s), ${r.duplicated} já existiam`); if (fileRef.current) fileRef.current.value = ''; },
    onError: (e) => toast.error(errText(e)),
  });
  const act = useMutation({
    mutationFn: ({ id, path, body }: { id: number; path: string; body?: any }) => api<any>(`/bank/transactions/${id}/${path}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => { refresh(); },
    onError: (e) => toast.error(errText(e)),
  });

  const items = txns.data?.items ?? [];
  const credits = items.filter((t) => t.kind === 'credit');
  const debits = items.filter((t) => t.kind === 'debit');

  return (
    <Page title="Extrato bancário" subtitle="Lançamentos importados do extrato (PIX). A ligação de aluguéis fica em Conciliação."
      action={canWrite && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input ref={fileRef} type="file" accept=".pdf,.ofx,.ofc,.txt" multiple style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.length) upload.mutate(e.target.files); }} />
          <button className="pl-btn pl-btn--primary" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> {upload.isPending ? 'Importando…' : 'Importar extrato'}
          </button>
        </div>
      )}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span className="pl-label">Mês</span>
        <input className="pl-input" type="month" min={MIN_MONTH} value={month} onChange={(e) => setMonth(e.target.value < MIN_MONTH ? MIN_MONTH : e.target.value)} style={{ width: 180 }} />
      </div>
      <div className="pl-dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <KpiCard label="Recebido" value={money(summary.data?.recebido)} loading={summary.isLoading} />
        <KpiCard label="Conciliado" value={money(summary.data?.conciliado)} loading={summary.isLoading} />
        <KpiCard label="Não conciliado" value={money(summary.data?.nao_conciliado)} loading={summary.isLoading} />
      </div>

      <h3 className="pl-h3" style={{ margin: '8px 0 12px' }}>Créditos (aluguéis recebidos)</h3>
      <ExtratoTable rows={credits} kind="credit" loading={txns.isLoading} canWrite={canWrite}
        onConfirm={() => {}} onIgnore={(t) => act.mutate({ id: t.id, path: 'ignore' })}
        onUndo={(t) => act.mutate({ id: t.id, path: 'unmatch' })} onCreateExpense={() => {}} />

      <h3 className="pl-h3" style={{ margin: '24px 0 12px' }}>Débitos (despesas)</h3>
      <ExtratoTable rows={debits} kind="debit" loading={txns.isLoading} canWrite={canWrite}
        onConfirm={(t) => act.mutate({ id: t.id, path: 'match', body: { expense_id: t.suggestion?.expense?.id } })}
        onIgnore={(t) => act.mutate({ id: t.id, path: 'ignore' })}
        onUndo={(t) => act.mutate({ id: t.id, path: 'unmatch' })} onCreateExpense={(t) => setExpenseFor(t)} />

      {expenseFor && <CreateExpenseModal txn={expenseFor} onClose={() => setExpenseFor(null)} onCreate={(body) => { act.mutate({ id: expenseFor.id, path: 'create-expense', body }); setExpenseFor(null); }} />}
    </Page>
  );
}

function reconStatusLabel(s: string) { return s === 'reconciled' ? 'Conciliado' : s === 'ignored' ? 'Ignorado' : 'Pendente'; }

function ExtratoTable({ rows, kind, loading, canWrite, onConfirm, onIgnore, onUndo, onCreateExpense }: {
  rows: BankTxn[]; kind: 'credit' | 'debit'; loading: boolean; canWrite: boolean;
  onConfirm: (t: BankTxn) => void; onIgnore: (t: BankTxn) => void; onUndo: (t: BankTxn) => void; onCreateExpense: (t: BankTxn) => void;
}) {
  if (loading) return <TableSkeleton cols={5} />;
  if (!rows.length) return <Empty text="Nenhum lançamento neste mês." detail="Importe o extrato (PDF/OFX) para ver os lançamentos." />;
  return (
    <DataTable>
      <thead><tr><th>Data</th><th>Contraparte</th><th>Valor</th><th>Status</th>{kind === 'debit' && <th>Despesa</th>}{canWrite && <th></th>}</tr></thead>
      <tbody>
        {rows.map((t) => {
          const s = t.suggestion;
          return (
            <tr key={t.id}>
              <td>{brDate(t.posted_date)}</td>
              <td><div style={{ fontWeight: 500 }}>{t.counterparty_name ?? t.memo ?? '—'}</div>{t.counterparty_doc && <div className="pl-mono" style={{ fontSize: 12, color: 'var(--pl-stone-500)' }}>{t.counterparty_doc}</div>}</td>
              <td style={{ fontWeight: 500, color: kind === 'debit' ? 'var(--pl-danger)' : undefined }}>{money(t.amount)}</td>
              <td><span className={`pl-status pl-status--${t.status === 'reconciled' ? 'paid' : t.status === 'ignored' ? 'cancelled' : 'pending'}`}>{reconStatusLabel(t.status)}</span></td>
              {kind === 'debit' && <td>{t.status === 'pending' ? (s?.expense ? `→ despesa ${money(s.expense.amount)}` : 'criar despesa') : '—'}</td>}
              {canWrite && <td><RowActions>
                {t.status === 'pending' && kind === 'debit' && s?.expense && <button type="button" className="pl-btn pl-btn--primary pl-btn--sm" onClick={() => onConfirm(t)}><Check size={14} /> Confirmar</button>}
                {t.status === 'pending' && kind === 'debit' && <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => onCreateExpense(t)}>Criar despesa</button>}
                {t.status === 'pending' && <button type="button" className="pl-icon-btn" title="Ignorar" onClick={() => onIgnore(t)}><Ban size={15} /></button>}
                {t.status !== 'pending' && <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => onUndo(t)}>Desfazer</button>}
              </RowActions></td>}
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}

function CreateExpenseModal({ txn, onClose, onCreate }: { txn: BankTxn; onClose: () => void; onCreate: (body: any) => void }) {
  const props = useQuery({ queryKey: ['properties'], queryFn: () => api<List<Property>>('/properties') });
  const guess = /LUZ/i.test(txn.memo ?? '') ? 'energia' : 'outros';
  const [category, setCategory] = useState(txn.suggestion?.suggested_category ?? guess);
  const [propertyId, setPropertyId] = useState('');
  return (
    <Modal title={`Criar despesa de ${money(txn.amount)}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onCreate({ category, property_id: propertyId ? Number(propertyId) : null }); }}>
        <p style={{ color: 'var(--pl-text-muted)', marginTop: 0 }}>{txn.counterparty_name ?? txn.memo} · {brDate(txn.posted_date)}</p>
        <div className="pl-form-grid">
          <Field label="Categoria">
            <select className="pl-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {['iptu', 'energia', 'agua', 'emprestimo', 'outros'].map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
            </select>
          </Field>
          <Field label="Imóvel (opcional)">
            <select className="pl-input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              <option value="">Nenhum</option>
              {props.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <FormFoot onCancel={onClose} submitLabel="Criar e conciliar" />
      </form>
    </Modal>
  );
}

/* ---------- IPTU ---------- */

const IPTU_YEAR = 2026;

function IptuPage() {
  const { canWrite } = useAuth();
  const data = useQuery({ queryKey: ['iptu', IPTU_YEAR], queryFn: () => api<IptuResp>(`/iptu?year=${IPTU_YEAR}`) });
  const [linkFor, setLinkFor] = useState<IptuRow | null>(null);
  const save = useMutation({
    mutationFn: ({ pid, body }: { pid: number; body: any }) => api<IptuRow>(`/iptu/${pid}/${IPTU_YEAR}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['iptu', IPTU_YEAR] }); },
    onError: (e) => toast.error(errText(e)),
  });
  const rows = data.data?.items ?? [];
  const pagos = rows.filter((r) => r.paid).length;

  return (
    <Page title="IPTU" subtitle={`Controle de pagamento do IPTU por imóvel — ${IPTU_YEAR}.`}>
      {data.isError && <QueryError />}
      <div className="pl-dashboard-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        <KpiCard label={`Pagos em ${IPTU_YEAR}`} value={`${pagos}/${rows.length}`} loading={data.isLoading} />
        <KpiCard label="Pendentes" value={rows.length - pagos} loading={data.isLoading} />
      </div>
      {data.isLoading ? <TableSkeleton cols={4} /> : !rows.length ? <Empty icon={<Stamp size={32} />} text="Nenhum imóvel cadastrado." /> : (
        <DataTable>
          <thead><tr><th>Imóvel</th><th>Sequencial</th><th>Inscrição</th><th>{IPTU_YEAR} — IPTU pago?</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.property_id}>
                <td style={{ fontWeight: 500 }}>{r.property}</td>
                <td className="pl-mono">{r.sequencial ?? '—'}</td>
                <td className="pl-mono">{r.inscricao ?? '—'}</td>
                <td>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: canWrite ? 'pointer' : 'default' }}>
                    <input type="checkbox" checked={r.paid} disabled={!canWrite || save.isPending} onChange={(e) => save.mutate({ pid: r.property_id, body: { paid: e.target.checked } })} />
                    <span>{r.paid ? 'Pago' : 'Não pago'}</span>
                  </label>
                  <div style={{ marginTop: 4 }}>
                    {r.bank_txn
                      ? <span style={{ fontSize: 12, color: 'var(--pl-stone-500)' }}>
                          <Link2 size={12} style={{ verticalAlign: 'middle' }} /> {money(r.bank_txn.amount)} · {brDate(r.bank_txn.posted_date)} · {r.bank_txn.counterparty_name ?? r.bank_txn.memo}
                          {canWrite && <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" style={{ marginLeft: 8 }} onClick={() => save.mutate({ pid: r.property_id, body: { bank_txn_id: null } })}>desvincular</button>}
                        </span>
                      : canWrite && <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => setLinkFor(r)}>vincular extrato</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      {linkFor && <DebitoPicker iptu={linkFor} onClose={() => setLinkFor(null)} onPick={(txnId) => { save.mutate({ pid: linkFor.property_id, body: { bank_txn_id: txnId } }); setLinkFor(null); }} />}
    </Page>
  );
}

function DebitoPicker({ iptu, onClose, onPick }: { iptu: IptuRow; onClose: () => void; onPick: (txnId: number) => void }) {
  const txns = useQuery({ queryKey: ['bank-debits'], queryFn: () => api<List<BankTxn>>('/bank/transactions?kind=debit') });
  const rows = txns.data?.items ?? [];
  return (
    <Modal title={`Vincular IPTU ${iptu.year} — ${iptu.property}`} onClose={onClose} wide>
      {txns.isLoading ? <TableSkeleton cols={4} /> : !rows.length ? <Empty text="Nenhum débito no extrato." detail="Importe o extrato em Extrato." /> : (
        <DataTable>
          <thead><tr><th>Data</th><th>Contraparte / histórico</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{brDate(t.posted_date)}</td>
                <td>{t.counterparty_name ?? t.memo ?? '—'}</td>
                <td style={{ fontWeight: 500, color: 'var(--pl-danger)' }}>{money(t.amount)}</td>
                <td><button type="button" className="pl-btn pl-btn--primary pl-btn--sm" onClick={() => onPick(t.id)}>Vincular</button></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Modal>
  );
}

/* ---------- Labels ---------- */

function Status({ value, label }: { value: string; label?: string }) {
  return <span className={`pl-status pl-status--${value}`}>{label ?? statusLabel(value)}</span>;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    active: 'Ativo', ended: 'Encerrado', cancelled: 'Cancelado', upcoming: 'Futuro',
    paid: 'Pago', pending: 'Pendente', partial: 'Parcial', overdue: 'Vencido',
    occupied: 'Ocupado', vacant: 'Vago',
  };
  return labels[value] ?? value;
}

function roleLabel(role?: string) {
  return role === 'admin' ? 'Administrador' : role === 'manager' ? 'Gestor' : role === 'viewer' ? 'Leitor' : '—';
}

function kindLabel(kind: string) {
  const labels: Record<string, string> = {
    condominio: 'Condomínio', casa: 'Casa', fazenda: 'Fazenda',
    clinica: 'Clínica', comercial: 'Comercial', outro: 'Outro',
  };
  return labels[kind] ?? kind;
}

function categoryLabel(cat: string) {
  const labels: Record<string, string> = {
    iptu: 'IPTU', energia: 'Energia', agua: 'Água', emprestimo: 'Empréstimo', outros: 'Outros',
  };
  return labels[cat] ?? cat;
}

function debtKindLabel(kind: string) {
  const labels: Record<string, string> = {
    consignado: 'Consignado', financiamento: 'Financiamento', outro: 'Outro',
  };
  return labels[kind] ?? kind;
}

function ChangePasswordForm({ forced, onDone, onCancel }: { forced?: boolean; onDone: () => void; onCancel?: () => void }) {
  const { refreshUser } = useAuth();
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [confirm, setConfirm] = useState('');
  const save = useMutation({
    mutationFn: () => {
      if (nw !== confirm) throw new Error('A confirmação não confere');
      if (nw.length < 6) throw new Error('A nova senha precisa de ao menos 6 caracteres');
      return api<User>('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: cur, new_password: nw }) });
    },
    onSuccess: async () => { await refreshUser(); toast.success('Senha alterada'); onDone(); },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <label className="pl-field"><span className="pl-label">Senha atual</span><input className="pl-input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required /></label>
      <label className="pl-field"><span className="pl-label">Nova senha</span><input className="pl-input" type="password" value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" minLength={6} required /></label>
      <label className="pl-field"><span className="pl-label">Confirmar nova senha</span><input className="pl-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></label>
      <div className="pl-modal__foot">
        {!forced && onCancel && <button type="button" className="pl-btn pl-btn--ghost" onClick={onCancel}>Cancelar</button>}
        <button type="submit" className="pl-btn pl-btn--primary" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Alterar senha'}</button>
      </div>
    </form>
  );
}

function ForcePasswordChange() {
  const { user, logout } = useAuth();
  return (
    <main className="pl-login">
      <section className="pl-login__brand">
        <img className="pl-login__logo" src={logoLight} alt="P&L Holding" />
        <div className="pl-login__copy">
          <p className="pl-eyebrow">Primeiro acesso</p>
          <h1 className="pl-hero__title">Defina uma <em>nova senha</em>.</h1>
          <p>Por segurança, no primeiro acesso você precisa trocar a senha provisória antes de usar o sistema.</p>
        </div>
        <p className="pl-mono">Sistema interno · P&L Investimentos</p>
      </section>
      <section className="pl-login__panel">
        <div className="pl-login__form">
          <img src={logoPrimary} alt="P&L Holding" style={{ width: 190, marginBottom: 24 }} />
          <p className="pl-eyebrow">Olá, {user?.full_name}</p>
          <h2 className="pl-h2" style={{ marginTop: 8, marginBottom: 8 }}>Trocar senha</h2>
          <ChangePasswordForm forced onDone={() => { /* refreshUser já atualiza */ }} />
          <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" style={{ marginTop: 16 }} onClick={logout}>Sair</button>
        </div>
      </section>
    </main>
  );
}

function Root() {
  const { user } = useAuth();
  if (!user) return <Login />;
  if (user.must_change_password) return <ForcePasswordChange />;
  return <AppShell />;
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <AuthProvider>
      <Root />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  </QueryClientProvider>,
);
