from decimal import Decimal
import os
from pathlib import Path

os.environ['DATABASE_URL'] = 'sqlite:///./test.db'
Path('test.db').unlink(missing_ok=True)

from fastapi.testclient import TestClient

from app.main import app


def test_health_and_auth_flow():
    client = TestClient(app)
    assert client.get('/health').status_code == 200
    token = client.post('/auth/login', json={'username':'eduardo','password':'eduardo123'}).json()
    assert token['token_type'] == 'bearer'
    me = client.get('/auth/me', headers={'Authorization': f"Bearer {token['access']}"})
    assert me.status_code == 200
    assert me.json()['role'] == 'admin'


def auth_headers(client):
    token = client.post('/auth/login', json={'username':'eduardo','password':'eduardo123'}).json()
    return {'Authorization': f"Bearer {token['access']}"}


def test_inventory_charges_expenses_and_reports_flow():
    client = TestClient(app)
    h = auth_headers(client)
    prop = client.post('/properties', json={'name':'Condomínio 1','kind':'condominio','rental_mode':'by_unit','market_value':'1000000.00'}, headers=h)
    assert prop.status_code == 201, prop.text
    pid = prop.json()['id']
    unit = client.post(f'/properties/{pid}/units', json={'name':'Casa 01','base_rent':'1200.00'}, headers=h)
    assert unit.status_code == 201, unit.text
    uid = unit.json()['id']
    import time
    cpf = str(int(time.time() * 1000000))[-11:]
    tenant = client.post('/tenants', json={'full_name':'João Silva','cpf':cpf,'email':'joao@example.com'}, headers=h)
    assert tenant.status_code == 201, tenant.text
    tid = tenant.json()['id']
    lease = client.post('/leases', json={'unit_id': uid, 'start_date':'2026-01-01','end_date':'2026-12-31','monthly_rent':'1200.00','due_day':10,'tenants':[{'tenant_id':tid,'is_primary':True}]}, headers=h)
    assert lease.status_code == 201, lease.text
    lid = lease.json()['id']
    gen = client.post('/rent-charges/generate?up_to_month=2026-03', headers=h)
    assert gen.status_code == 200, gen.text
    charges = client.get(f'/rent-charges?lease_id={lid}', headers=h).json()['items']
    assert len(charges) == 3
    charge_id = charges[0]['id']
    pay = client.post(f'/rent-charges/{charge_id}/payment', json={'amount_paid':'600.00','paid_date':'2026-01-15'}, headers=h)
    assert pay.status_code == 200, pay.text
    assert pay.json()['status'] == 'partial'
    exp = client.post(f'/properties/{pid}/expenses', json={'category':'iptu','reference_period':'2026-01-01','amount':'300.00','due_date':'2026-01-20'}, headers=h)
    assert exp.status_code == 201, exp.text
    debt = client.post('/debts', json={'name':'Financiamento','kind':'financiamento','principal_amount':'500000.00','outstanding_balance':'250000.00','property_id':pid}, headers=h)
    assert debt.status_code == 201, debt.text
    resultado = client.get('/reports/resultado?from=2026-01&to=2026-03', headers=h)
    assert resultado.status_code == 200
    assert Decimal(str(resultado.json()['receita_esperada'])) == Decimal('3600.00')
    patrimonio = client.get('/reports/patrimonio', headers=h).json()
    assert Decimal(str(patrimonio['patrimonio_liquido'])) == Decimal('750000.00')


def test_loan_generates_installment_expenses():
    client = TestClient(app)
    h = auth_headers(client)
    debt = client.post('/debts', json={'name':'Consignado A','kind':'consignado','principal_amount':'12000.00','installment_amount':'1000.00','installments_count':12,'first_due_date':'2026-02-05','outstanding_balance':'12000.00'}, headers=h)
    assert debt.status_code == 201, debt.text
    did = debt.json()['id']
    exps = client.get(f'/expenses?debt_id={did}', headers=h).json()['items']
    assert len(exps) == 12
    assert all(e['category'] == 'emprestimo' and e['debt_id'] == did for e in exps)
    again = client.post(f'/debts/{did}/generate-installments', headers=h).json()
    assert again['created'] == 0


OFX_SAMPLE = (
    '<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>'
    '<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260410120000</DTPOSTED>'
    '<TRNAMT>1234.00</TRNAMT><FITID>TST-RECON-1</FITID><MEMO>CRE PIX CH</MEMO></STMTTRN>'
    '</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>'
)


def test_reconciliation_name_match_and_payment():
    client = TestClient(app)
    h = auth_headers(client)
    import time
    cpf = '70097969478'
    pid = client.post('/properties', json={'name': f'Cond Recon {time.time()}', 'kind': 'condominio', 'rental_mode': 'by_unit'}, headers=h).json()['id']
    uid = client.post(f'/properties/{pid}/units', json={'name': 'Unidade 01', 'base_rent': '1234.00'}, headers=h).json()['id']
    tid = client.post('/tenants', json={'full_name': 'João Vitor de Oliveira Alves', 'cpf': cpf}, headers=h).json()['id']
    client.post('/leases', json={'unit_id': uid, 'start_date': '2026-01-01', 'end_date': '2026-12-31', 'monthly_rent': '1234.00', 'due_day': 10, 'tenants': [{'tenant_id': tid, 'is_primary': True}]}, headers=h)
    client.post('/rent-charges/generate?up_to_month=2026-04', headers=h)

    # casamento por nome + CPF mascarado
    from app.main import SessionLocal, match_tenant
    db = SessionLocal()
    try:
        t, conf = match_tenant(db, 'JOAO VITOR DE OLIVEIRA ALVES', '***.979.694-**')
        assert t is not None and t.id == tid and conf == 'alta'
    finally:
        db.close()

    # import idempotente
    r = client.post('/bank/import', files=[('files', ('abril.ofx', OFX_SAMPLE, 'application/octet-stream'))], headers=h)
    assert r.status_code == 200 and r.json()['created'] >= 1, r.text
    again = client.post('/bank/import', files=[('files', ('abril.ofx', OFX_SAMPLE, 'application/octet-stream'))], headers=h)
    assert again.json()['created'] == 0 and again.json()['duplicated'] >= 1

    txn = [t for t in client.get('/bank/transactions?month=2026-04&kind=credit', headers=h).json()['items'] if t['fitid'] == 'TST-RECON-1'][0]
    charge = client.get(f'/rent-charges?lease_id={client.get("/leases", headers=h).json()["items"][-1]["id"]}', headers=h).json()['items'][0]
    m = client.post(f"/bank/transactions/{txn['id']}/match", json={'rent_charge_id': charge['id']}, headers=h)
    assert m.status_code == 200 and m.json()['status'] == 'reconciled', m.text
    assert client.get(f"/rent-charges/{charge['id']}", headers=h).json()['status'] == 'paid'

    # desfazer reverte o pagamento
    client.post(f"/bank/transactions/{txn['id']}/unmatch", headers=h)
    assert client.get(f"/rent-charges/{charge['id']}", headers=h).json()['status'] in ('pending', 'overdue')


def test_reconciliation_charges_view():
    client = TestClient(app)
    h = auth_headers(client)
    import time
    pname = f'Cond Charges {time.time()}'
    pid = client.post('/properties', json={'name': pname, 'kind': 'condominio', 'rental_mode': 'by_unit'}, headers=h).json()['id']
    uid = client.post(f'/properties/{pid}/units', json={'name': 'Unidade 01', 'base_rent': '1100.00'}, headers=h).json()['id']
    tid = client.post('/tenants', json={'full_name': 'Joaquim Vitorino Teste', 'cpf': '11122233344'}, headers=h).json()['id']
    client.post('/leases', json={'unit_id': uid, 'start_date': '2026-01-01', 'end_date': '2026-12-31', 'monthly_rent': '1100.00', 'due_day': 10, 'tenants': [{'tenant_id': tid, 'is_primary': True}]}, headers=h)
    client.post('/rent-charges/generate?up_to_month=2026-04', headers=h)

    # insere um crédito do extrato com o NOME do pagador (como vem do PDF)
    from datetime import date as _date
    from decimal import Decimal as _D
    from app.main import BankTransaction, SessionLocal, TxnKind
    db = SessionLocal()
    try:
        db.add(BankTransaction(account_id='caixa', fitid='CHG-VIEW-1', posted_date=_date(2026, 4, 6), kind=TxnKind.credit, amount=_D('1262.00'), counterparty_name='JOAQUIM VITORINO TESTE', counterparty_doc='***.222.333-**', memo='CRE PIX CH'))
        db.commit()
    finally:
        db.close()

    data = client.get('/reconciliation/charges?month=2026-04', headers=h).json()
    row = [r for r in data['items'] if r['property'] == pname][0]
    assert row['suggested_txn'] and row['suggested_txn']['fitid'] == 'CHG-VIEW-1'
    assert row['confidence'] in ('alta', 'media')

    # ligar (match) a partir da visão de cobrança
    m = client.post(f"/bank/transactions/{row['suggested_txn']['id']}/match", json={'rent_charge_id': row['charge']['id']}, headers=h)
    assert m.status_code == 200 and m.json()['status'] == 'reconciled', m.text
    after = client.get('/reconciliation/charges?month=2026-04', headers=h).json()
    row2 = [r for r in after['items'] if r['charge']['id'] == row['charge']['id']][0]
    assert row2['charge']['status'] == 'paid' and row2['linked_txn'] and row2['suggested_txn'] is None


def test_iptu_grid_toggle_and_link():
    client = TestClient(app)
    h = auth_headers(client)
    import time
    pname = f'Imovel IPTU {time.time()}'
    pid = client.post('/properties', json={'name': pname, 'kind': 'casa', 'rental_mode': 'whole', 'sequencial': 'SEQ-1', 'inscricao': 'INSC-1'}, headers=h).json()['id']

    def myrow():
        return [r for r in client.get('/iptu?year=2026', headers=h).json()['items'] if r['property_id'] == pid][0]

    r0 = myrow()
    assert r0['paid'] is False and r0['sequencial'] == 'SEQ-1' and r0['inscricao'] == 'INSC-1'

    # marcar pago
    client.put(f'/iptu/{pid}/2026', json={'paid': True}, headers=h)
    assert myrow()['paid'] is True

    # vincular um débito do extrato -> mantém pago + vínculo
    from datetime import date as _date
    from decimal import Decimal as _D
    from app.main import BankTransaction, SessionLocal, TxnKind
    db = SessionLocal()
    try:
        db.add(BankTransaction(account_id='caixa', fitid='IPTU-DEB-1', posted_date=_date(2026, 3, 1), kind=TxnKind.debit, amount=_D('500.00'), memo='PG ORG GOV'))
        db.commit()
        bid = db.query(BankTransaction).filter_by(fitid='IPTU-DEB-1').first().id
    finally:
        db.close()
    linked = client.put(f'/iptu/{pid}/2026', json={'bank_txn_id': bid}, headers=h).json()
    assert linked['paid'] is True and linked['bank_txn'] and linked['bank_txn']['id'] == bid

    # desmarcar limpa o vínculo
    client.put(f'/iptu/{pid}/2026', json={'paid': False}, headers=h)
    final = myrow()
    assert final['paid'] is False and final['bank_txn'] is None


def test_must_change_password_flow():
    client = TestClient(app)
    h = auth_headers(client)
    import time
    uname = f'novo{int(time.time())}'
    created = client.post('/users', json={'username': uname, 'full_name': 'Novo Usuario', 'password': 'senha123', 'role': 'manager', 'must_change_password': True}, headers=h)
    assert created.status_code == 201 and created.json()['must_change_password'] is True

    # login do novo usuário: /auth/me indica troca obrigatória
    tok = client.post('/auth/login', json={'username': uname, 'password': 'senha123'}).json()['access']
    uh = {'Authorization': f'Bearer {tok}'}
    assert client.get('/auth/me', headers=uh).json()['must_change_password'] is True

    # senha atual errada -> 400
    assert client.post('/auth/change-password', json={'current_password': 'errada', 'new_password': 'novaSenha1'}, headers=uh).status_code == 400
    # troca correta -> flag limpa
    ok = client.post('/auth/change-password', json={'current_password': 'senha123', 'new_password': 'novaSenha1'}, headers=uh)
    assert ok.status_code == 200 and ok.json()['must_change_password'] is False
    # senha antiga não loga mais; a nova sim
    assert client.post('/auth/login', json={'username': uname, 'password': 'senha123'}).status_code == 401
    assert 'access' in client.post('/auth/login', json={'username': uname, 'password': 'novaSenha1'}).json()
