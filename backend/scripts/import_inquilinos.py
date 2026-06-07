"""Recria o cadastro de inquilinos com o INQUILINO ATUAL de cada unidade.

Fontes (decisão do usuário — contratos 2026 têm prioridade):
  - Base: docs/Aluguel/Antigos/Condominio_2/controle_alugueis.xlsx (18 unidades,
    nomes/apelidos, co-locatários separados por "/").
  - Override: 6 contratos .docx de 2026 preenchidos (nome completo + CPF/RG),
    resolvidos por unidade (abaixo). Onde há contrato, ele substitui o controle.

Aplicação (decisão do usuário — "resetar e recriar só com os atuais"):
  apaga rent_charges, lease_tenants, leases e tenants (descarta os contratos
  importados da planilha) e recria a tabela tenants só com os inquilinos atuais.
  properties / units / debts / users são preservados.

Uso (de backend/, com Postgres no ar e .env carregado):
    set -a && . ./.env && set +a
    PYTHONPATH=. uv run python scripts/import_inquilinos.py
"""
from __future__ import annotations

import os
import re
from pathlib import Path

os.environ.setdefault('SKIP_SEED', '1')

import openpyxl
from sqlalchemy import delete, func, select

from app.main import Document, Lease, LeaseTenant, RentCharge, SessionLocal, Tenant  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTROLE = REPO_ROOT / 'docs' / 'Aluguel' / 'Antigos' / 'Condominio_2' / 'controle_alugueis.xlsx'

# Override por (condomínio, unidade) a partir dos contratos .docx de 2026.
# Cada item: (nome_completo, cpf_digitos, rg, fonte). Substitui o controle naquela unidade.
CONTRATOS_2026 = {
    (1, 1): [('Isaque Italo Medeiros Dantas', '12368211497', '1236821149', 'Contrato 2026 (Cond1 Un1)')],
    (1, 6): [('Enrique Bezerra de Souza', '', '', 'Contrato 2026 (Cond1 Un6)')],
    (2, 3): [('João Vitor de Oliveira Alves', '70097969478', '', 'Contrato 2026 (-ContratoCond2)'),
             ('Alice', '', '', 'controle_alugueis (co-locatária)')],
    (3, 1): [('Eduarda Fabricio Passo', '', '', 'Contrato 2026 (Cond3 Un1)')],
    (3, 2): [('Thiago Duarte Coelho de Souza Dantas', '512829488', '62.261.007-7', 'Contrato 2026 (NovosContratos Cond3 Un2)')],
    (3, 8): [('Erik Leandro Lucas de Oliveira', '01145769470', '', 'Contrato 2026 (Condominio3.docx, Unidade 8)')],
}


def norm(s: str) -> str:
    return re.sub(r'\s+', ' ', str(s)).strip()


def read_controle() -> dict[tuple[int, int], list[tuple[str, str, str, str]]]:
    """(cond, unidade) -> lista de (nome, cpf, rg, fonte)."""
    wb = openpyxl.load_workbook(CONTROLE, data_only=True)
    ws = wb['Alugueis']
    out: dict[tuple[int, int], list[tuple[str, str, str, str]]] = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] is None or row[1] is None:
            continue
        try:
            cond = int(float(row[0])); unit = int(float(row[1]))
        except (TypeError, ValueError):
            continue
        names = [norm(n) for n in str(row[2] or '').split('/') if norm(n)]
        out[(cond, unit)] = [(n, '', '', 'controle_alugueis') for n in names]
    return out


def run():
    units = read_controle()
    units.update(CONTRATOS_2026)  # contratos 2026 substituem o controle nas suas unidades

    # consolidar por inquilino (dedup por nome normalizado); juntar origens/dados
    tenants: dict[str, dict] = {}
    for (cond, unit), people in sorted(units.items()):
        for name, cpf, rg, fonte in people:
            key = name.lower()
            t = tenants.setdefault(key, {'full_name': name, 'cpf': '', 'rg': '', 'fontes': [], 'unidades': []})
            t['unidades'].append(f'Cond {cond} Un {unit:02d}')
            if cpf and not t['cpf']:
                t['cpf'] = re.sub(r'\D', '', cpf)
            if rg and not t['rg']:
                t['rg'] = rg
            if fonte not in t['fontes']:
                t['fontes'].append(fonte)

    db = SessionLocal()
    try:
        # reset: contratos importados + inquilinos (mantém properties/units/debts/users)
        for model in (Document, RentCharge, LeaseTenant, Lease, Tenant):
            db.execute(delete(model))
        db.commit()

        for t in tenants.values():
            notes_parts = [f"Atual em: {', '.join(t['unidades'])}"]
            if t['rg']:
                notes_parts.append(f"RG: {t['rg']}")
            notes_parts.append('Sem telefone/email nas fontes.')
            notes_parts.append('Fonte: ' + '; '.join(t['fontes']))
            db.add(Tenant(full_name=t['full_name'], cpf=t['cpf'] or None, notes=' | '.join(notes_parts)))
        db.commit()

        total = db.scalar(select(func.count(Tenant.id)))
        com_cpf = db.scalar(select(func.count(Tenant.id)).where(Tenant.cpf.is_not(None)))
    finally:
        db.close()

    print(f'Inquilinos recriados: {total} (com CPF: {com_cpf})')
    print('Contratos da planilha (leases) e cadastro antigo de inquilinos foram descartados.')
    print('\nInquilinos atuais por unidade:')
    for (cond, unit), people in sorted(units.items()):
        parts = []
        for name, cpf, _rg, _fonte in people:
            digits = re.sub(r'\D', '', cpf)
            parts.append(f'{name} [CPF {digits}]' if digits else name)
        print(f'  Cond {cond} Un {unit:02d}: {", ".join(parts)}')


if __name__ == '__main__':
    run()
