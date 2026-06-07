"""Parsers de extrato bancário (Caixa) para a conciliação.

- PDF (primário): tem o NOME do pagador/recebedor + CPF mascarado/CNPJ + chave E2E.
- OFX/OFC e TXT: fallback (mesmos lançamentos, sem nome).

Cada parser devolve uma lista de dicts normalizados:
    {fitid, posted_date(date), kind('credit'|'debit'), amount(Decimal>0),
     counterparty_name(str|None), counterparty_doc(str|None), memo(str)}
"""
from __future__ import annotations

import csv
import io
import re
from datetime import date
from decimal import Decimal

# ---------- helpers ----------

def _money(s: str) -> Decimal:
    s = s.replace('R$', '').replace(' ', '').replace('.', '').replace(',', '.').replace('-', '')
    return Decimal(s or '0').quantize(Decimal('0.01'))

_DOC_MASK = re.compile(r'(\*{3}\.\d{3}\.\d{3}-\*{2}|\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})\s*$')

# ---------- PDF (Gerenciador Caixa) ----------

# linha de lançamento: "<doc6> <nome ...> <-?> <valor> <saldo> C"
# o sinal '-' é capturado separado do nome (débitos podem não ter nome, ex. LUZ)
_PDF_LINE = re.compile(
    r'^(\d{6})\s+(.*?)(-?)\s*R\$\s?([\d.]+,\d{2})\s+R\$\s?[\d.]+,\d{2}\s*[CD]?\s*$'
)
_PDF_DATE = re.compile(r'^(\d{2})/(\d{2})/(\d{4})')
_PDF_E2E = re.compile(r'^(E[0-9A-Za-z]{12,})\s*$')


def parse_pdf(data: bytes) -> list[dict]:
    import pdfplumber

    lines: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            lines += (page.extract_text() or '').splitlines()

    out: list[dict] = []
    last_date: date | None = None
    last_type = ''
    for i, raw in enumerate(lines):
        line = raw.strip()
        md = _PDF_DATE.match(line)
        if md and 'SALDO DIA' not in line:
            last_date = date(int(md.group(3)), int(md.group(2)), int(md.group(1)))
        if re.fullmatch(r'[A-ZÇÃÁÉÍÓÚ0-9 \-/]+', line) and not line[0].isdigit() and 'SALDO' not in line and 'R$' not in line:
            last_type = line  # linha de tipo (PIX RECEBIDO, CRED PIX CHAVE, LUZ, ...)
        m = _PDF_LINE.match(line)
        if not m:
            continue
        doc, middle, neg, val = m.group(1), m.group(2).strip(), m.group(3), m.group(4)
        cpf = None
        dm = _DOC_MASK.search(middle)
        if dm:
            cpf = dm.group(1)
            middle = middle[:dm.start()].strip()
        # E2E na linha seguinte (id único do PIX) -> fitid; senão usa doc+data
        fitid = f'{doc}-{last_date.isoformat() if last_date else "?"}-{val}'
        for nxt in lines[i + 1:i + 3]:
            me = _PDF_E2E.match(nxt.strip())
            if me:
                fitid = me.group(1)
                break
        out.append({
            'fitid': fitid,
            'posted_date': last_date,
            'kind': 'debit' if neg else 'credit',
            'amount': _money(val),
            'counterparty_name': middle or None,
            'counterparty_doc': cpf,
            'memo': last_type or 'PIX',
        })
    return out


# ---------- OFX / OFC (SGML) ----------

def _tag(block: str, tag: str) -> str:
    m = re.search(rf'<{tag}>([^<\r\n]+)', block)
    return m.group(1).strip() if m else ''


def parse_ofx(data: bytes) -> list[dict]:
    text = data.decode('latin-1', 'ignore')
    out: list[dict] = []
    for b in re.findall(r'<STMTTRN>(.*?)</STMTTRN>', text, re.S):
        typ = _tag(b, 'TRNTYPE').upper()
        amt = Decimal(_tag(b, 'TRNAMT') or '0')
        dt = _tag(b, 'DTPOSTED')[:8]
        posted = date(int(dt[:4]), int(dt[4:6]), int(dt[6:8])) if len(dt) >= 8 else None
        kind = 'debit' if (typ in ('DEBIT', '1') or amt < 0) else 'credit'
        out.append({
            'fitid': _tag(b, 'FITID') or f'{dt}-{amt}',
            'posted_date': posted,
            'kind': kind,
            'amount': abs(amt).quantize(Decimal('0.01')),
            'counterparty_name': None,
            'counterparty_doc': None,
            'memo': _tag(b, 'MEMO') or 'PIX',
        })
    return out


# ---------- TXT (CSV ;) ----------

def parse_txt(data: bytes) -> list[dict]:
    text = data.decode('latin-1', 'ignore')
    out: list[dict] = []
    reader = csv.reader(io.StringIO(text), delimiter=';', quotechar='"')
    rows = list(reader)
    for r in rows[1:]:
        if len(r) < 6:
            continue
        _conta, dt, doc, hist, val, dc = r[:6]
        dt = dt.strip()
        posted = date(int(dt[:4]), int(dt[4:6]), int(dt[6:8])) if len(dt) >= 8 else None
        out.append({
            'fitid': doc.strip() or f'{dt}-{val}',
            'posted_date': posted,
            'kind': 'debit' if dc.strip().upper() == 'D' else 'credit',
            'amount': Decimal(val.strip() or '0').copy_abs().quantize(Decimal('0.01')),
            'counterparty_name': None,
            'counterparty_doc': None,
            'memo': hist.strip() or 'PIX',
        })
    return out


def parse_statement(filename: str, data: bytes) -> list[dict]:
    name = (filename or '').lower()
    head = data[:64].lstrip()
    if name.endswith('.pdf') or head.startswith(b'%PDF'):
        return parse_pdf(data)
    if b'<OFX>' in data[:4000] or b'<OFC>' in data[:4000] or name.endswith(('.ofx', '.ofc')):
        return parse_ofx(data)
    return parse_txt(data)
