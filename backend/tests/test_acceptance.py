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
