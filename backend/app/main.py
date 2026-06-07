
from __future__ import annotations

import enum
import os
import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    func,
    or_,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

from app.statements import parse_statement

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./plholding.db')
JWT_SECRET = os.getenv('JWT_SECRET', 'dev-secret-change-me')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '60'))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv('REFRESH_TOKEN_EXPIRE_DAYS', '7'))
STORAGE_DIR = Path(os.getenv('LOCAL_STORAGE_DIR', './storage')).resolve()

connect_args = {'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class UserRole(str, enum.Enum): admin='admin'; manager='manager'; viewer='viewer'
class PropertyKind(str, enum.Enum): condominio='condominio'; casa='casa'; fazenda='fazenda'; clinica='clinica'; comercial='comercial'; outro='outro'
class RentalMode(str, enum.Enum): by_unit='by_unit'; whole='whole'
class UnitStatus(str, enum.Enum): occupied='occupied'; vacant='vacant'
class LeaseStatus(str, enum.Enum): upcoming='upcoming'; active='active'; ended='ended'; cancelled='cancelled'
class ChargeStatus(str, enum.Enum): pending='pending'; paid='paid'; partial='partial'; overdue='overdue'
class ExpenseCategory(str, enum.Enum): iptu='iptu'; energia='energia'; agua='agua'; emprestimo='emprestimo'; outros='outros'
class ExpenseStatus(str, enum.Enum): pending='pending'; paid='paid'; overdue='overdue'
class DebtKind(str, enum.Enum): consignado='consignado'; financiamento='financiamento'; outro='outro'
class DocumentType(str, enum.Enum): comprovante_pagamento='comprovante_pagamento'; comprovante_imposto='comprovante_imposto'; contrato='contrato'; outro='outro'
class OwnerEntityType(str, enum.Enum): rent_charge='rent_charge'; expense='expense'; lease='lease'; property='property'; debt='debt'
class TxnKind(str, enum.Enum): credit='credit'; debit='debit'
class ReconStatus(str, enum.Enum): pending='pending'; reconciled='reconciled'; ignored='ignored'

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class User(Base, TimestampMixin):
    __tablename__='users'
    id: Mapped[int]=mapped_column(primary_key=True)
    username: Mapped[str]=mapped_column(String(80), unique=True, index=True)
    email: Mapped[Optional[str]]=mapped_column(String(255), unique=True, index=True, nullable=True)
    hashed_password: Mapped[str]=mapped_column(String(255))
    full_name: Mapped[str]=mapped_column(String(255))
    role: Mapped[UserRole]=mapped_column(Enum(UserRole), default=UserRole.viewer)
    is_active: Mapped[bool]=mapped_column(Boolean, default=True)

class Property(Base, TimestampMixin):
    __tablename__='properties'
    id: Mapped[int]=mapped_column(primary_key=True)
    name: Mapped[str]=mapped_column(String(255), index=True)
    kind: Mapped[PropertyKind]=mapped_column(Enum(PropertyKind))
    rental_mode: Mapped[RentalMode]=mapped_column(Enum(RentalMode))
    address_line: Mapped[Optional[str]]=mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]]=mapped_column(String(120), nullable=True)
    state: Mapped[Optional[str]]=mapped_column(String(2), nullable=True)
    cep: Mapped[Optional[str]]=mapped_column(String(20), nullable=True)
    matricula: Mapped[Optional[str]]=mapped_column(String(120), nullable=True)
    sequencial: Mapped[Optional[str]]=mapped_column(String(120), nullable=True)
    inscricao: Mapped[Optional[str]]=mapped_column(String(120), nullable=True)
    market_value: Mapped[Optional[Decimal]]=mapped_column(Numeric(12,2), nullable=True)
    notes: Mapped[Optional[str]]=mapped_column(Text, nullable=True)
    units: Mapped[list['Unit']]=relationship(back_populates='property', cascade='all, delete-orphan')
    expenses: Mapped[list['Expense']]=relationship(back_populates='property')
    debts: Mapped[list['Debt']]=relationship(back_populates='property')

class Unit(Base, TimestampMixin):
    __tablename__='units'
    id: Mapped[int]=mapped_column(primary_key=True)
    property_id: Mapped[int]=mapped_column(ForeignKey('properties.id', ondelete='RESTRICT'), index=True)
    name: Mapped[str]=mapped_column(String(255))
    base_rent: Mapped[Decimal]=mapped_column(Numeric(12,2))
    status: Mapped[UnitStatus]=mapped_column(Enum(UnitStatus), default=UnitStatus.vacant)
    notes: Mapped[Optional[str]]=mapped_column(Text, nullable=True)
    property: Mapped[Property]=relationship(back_populates='units')
    leases: Mapped[list['Lease']]=relationship(back_populates='unit')

class Tenant(Base, TimestampMixin):
    __tablename__='tenants'
    id: Mapped[int]=mapped_column(primary_key=True)
    full_name: Mapped[str]=mapped_column(String(255), index=True)
    cpf: Mapped[Optional[str]]=mapped_column(String(20), unique=True, nullable=True)
    email: Mapped[Optional[str]]=mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]]=mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]]=mapped_column(Text, nullable=True)
    lease_links: Mapped[list['LeaseTenant']]=relationship(back_populates='tenant', cascade='all, delete-orphan')

class LeaseTenant(Base):
    __tablename__='lease_tenants'
    lease_id: Mapped[int]=mapped_column(ForeignKey('leases.id', ondelete='CASCADE'), primary_key=True)
    tenant_id: Mapped[int]=mapped_column(ForeignKey('tenants.id', ondelete='RESTRICT'), primary_key=True)
    is_primary: Mapped[bool]=mapped_column(Boolean, default=False)
    lease: Mapped['Lease']=relationship(back_populates='tenant_links')
    tenant: Mapped[Tenant]=relationship(back_populates='lease_links')

class Lease(Base, TimestampMixin):
    __tablename__='leases'
    __table_args__=(CheckConstraint('due_day >= 1 AND due_day <= 28', name='ck_lease_due_day'),)
    id: Mapped[int]=mapped_column(primary_key=True)
    unit_id: Mapped[int]=mapped_column(ForeignKey('units.id', ondelete='RESTRICT'), index=True)
    start_date: Mapped[date]=mapped_column(Date)
    duration_months: Mapped[int]=mapped_column(Integer)
    end_date: Mapped[date]=mapped_column(Date)
    monthly_rent: Mapped[Decimal]=mapped_column(Numeric(12,2))
    due_day: Mapped[int]=mapped_column(Integer)
    deposit: Mapped[Optional[Decimal]]=mapped_column(Numeric(12,2), nullable=True)
    status: Mapped[LeaseStatus]=mapped_column(Enum(LeaseStatus), default=LeaseStatus.upcoming, index=True)
    notes: Mapped[Optional[str]]=mapped_column(Text, nullable=True)
    unit: Mapped[Unit]=relationship(back_populates='leases')
    tenant_links: Mapped[list[LeaseTenant]]=relationship(back_populates='lease', cascade='all, delete-orphan')
    charges: Mapped[list['RentCharge']]=relationship(back_populates='lease')

class RentCharge(Base, TimestampMixin):
    __tablename__='rent_charges'
    __table_args__=(UniqueConstraint('lease_id','reference_month', name='uq_charge_lease_month'),)
    id: Mapped[int]=mapped_column(primary_key=True)
    lease_id: Mapped[int]=mapped_column(ForeignKey('leases.id', ondelete='RESTRICT'), index=True)
    reference_month: Mapped[date]=mapped_column(Date, index=True)
    due_date: Mapped[date]=mapped_column(Date, index=True)
    amount_due: Mapped[Decimal]=mapped_column(Numeric(12,2))
    amount_paid: Mapped[Decimal]=mapped_column(Numeric(12,2), default=Decimal('0.00'))
    paid_date: Mapped[Optional[date]]=mapped_column(Date, nullable=True)
    status: Mapped[ChargeStatus]=mapped_column(Enum(ChargeStatus), default=ChargeStatus.pending, index=True)
    notes: Mapped[Optional[str]]=mapped_column(Text, nullable=True)
    lease: Mapped[Lease]=relationship(back_populates='charges')

class Expense(Base, TimestampMixin):
    __tablename__='expenses'
    id: Mapped[int]=mapped_column(primary_key=True)
    property_id: Mapped[Optional[int]]=mapped_column(ForeignKey('properties.id', ondelete='RESTRICT'), index=True, nullable=True)
    debt_id: Mapped[Optional[int]]=mapped_column(ForeignKey('debts.id', ondelete='SET NULL'), index=True, nullable=True)
    category: Mapped[ExpenseCategory]=mapped_column(Enum(ExpenseCategory), index=True)
    reference_period: Mapped[date]=mapped_column(Date, index=True)
    amount: Mapped[Decimal]=mapped_column(Numeric(12,2))
    due_date: Mapped[Optional[date]]=mapped_column(Date, nullable=True)
    paid_date: Mapped[Optional[date]]=mapped_column(Date, nullable=True)
    status: Mapped[ExpenseStatus]=mapped_column(Enum(ExpenseStatus), default=ExpenseStatus.pending, index=True)
    notes: Mapped[Optional[str]]=mapped_column(Text, nullable=True)
    property: Mapped[Optional[Property]]=relationship(back_populates='expenses')
    debt: Mapped[Optional['Debt']]=relationship(back_populates='expenses')

class Debt(Base, TimestampMixin):
    __tablename__='debts'
    id: Mapped[int]=mapped_column(primary_key=True)
    name: Mapped[str]=mapped_column(String(255))
    kind: Mapped[DebtKind]=mapped_column(Enum(DebtKind))
    principal_amount: Mapped[Decimal]=mapped_column(Numeric(12,2))
    installment_amount: Mapped[Optional[Decimal]]=mapped_column(Numeric(12,2), nullable=True)
    installments_count: Mapped[Optional[int]]=mapped_column(Integer, nullable=True)
    first_due_date: Mapped[Optional[date]]=mapped_column(Date, nullable=True)
    outstanding_balance: Mapped[Decimal]=mapped_column(Numeric(12,2))
    property_id: Mapped[Optional[int]]=mapped_column(ForeignKey('properties.id', ondelete='SET NULL'), nullable=True)
    start_date: Mapped[Optional[date]]=mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]]=mapped_column(Text, nullable=True)
    property: Mapped[Optional[Property]]=relationship(back_populates='debts')
    expenses: Mapped[list['Expense']]=relationship(back_populates='debt')

class Document(Base):
    __tablename__='documents'
    id: Mapped[int]=mapped_column(primary_key=True)
    storage_key: Mapped[str]=mapped_column(String(500))
    original_filename: Mapped[str]=mapped_column(String(255))
    content_type: Mapped[str]=mapped_column(String(120))
    size_bytes: Mapped[int]=mapped_column(Integer)
    document_type: Mapped[DocumentType]=mapped_column(Enum(DocumentType))
    owner_entity_type: Mapped[OwnerEntityType]=mapped_column(Enum(OwnerEntityType), index=True)
    owner_entity_id: Mapped[int]=mapped_column(Integer, index=True)
    uploaded_by: Mapped[int]=mapped_column(ForeignKey('users.id', ondelete='RESTRICT'))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class BankTransaction(Base):
    __tablename__='bank_transactions'
    __table_args__=(UniqueConstraint('account_id','fitid', name='uq_bank_acct_fitid'),)
    id: Mapped[int]=mapped_column(primary_key=True)
    account_id: Mapped[str]=mapped_column(String(40), index=True)
    fitid: Mapped[str]=mapped_column(String(120), index=True)
    posted_date: Mapped[date]=mapped_column(Date, index=True)
    kind: Mapped[TxnKind]=mapped_column(Enum(TxnKind), index=True)
    amount: Mapped[Decimal]=mapped_column(Numeric(12,2))
    counterparty_name: Mapped[Optional[str]]=mapped_column(String(255), nullable=True)
    counterparty_doc: Mapped[Optional[str]]=mapped_column(String(40), nullable=True)
    memo: Mapped[Optional[str]]=mapped_column(String(255), nullable=True)
    status: Mapped[ReconStatus]=mapped_column(Enum(ReconStatus), default=ReconStatus.pending, index=True)
    rent_charge_id: Mapped[Optional[int]]=mapped_column(ForeignKey('rent_charges.id', ondelete='SET NULL'), nullable=True)
    expense_id: Mapped[Optional[int]]=mapped_column(ForeignKey('expenses.id', ondelete='SET NULL'), nullable=True)
    tenant_id: Mapped[Optional[int]]=mapped_column(ForeignKey('tenants.id', ondelete='SET NULL'), nullable=True)
    notes: Mapped[Optional[str]]=mapped_column(Text, nullable=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

# passlib's bcrypt backend can be brittle across bcrypt releases; pbkdf2_sha256 is used here
# as a deterministic, salted password hasher for the local app/test environment.
pwd_context = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')
security = HTTPBearer()

def get_db():
    db=SessionLocal()
    try: yield db
    finally: db.close()

def hash_password(password: str) -> str: return pwd_context.hash(password)
def verify_password(password: str, hashed: str) -> bool: return pwd_context.verify(password, hashed)
def create_token(sub: str, typ: str, expires: timedelta) -> str:
    now=datetime.now(timezone.utc)
    return jwt.encode({'sub': sub, 'typ': typ, 'iat': now, 'exp': now+expires}, JWT_SECRET, algorithm=JWT_ALGORITHM)
def token_pair(user: User) -> dict[str,str]:
    return {'access': create_token(str(user.id),'access',timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)), 'refresh': create_token(str(user.id),'refresh',timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)), 'token_type':'bearer'}

def get_current_user(creds: HTTPAuthorizationCredentials=Depends(security), db: Session=Depends(get_db)) -> User:
    try:
        payload=jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id=int(payload['sub'])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(401, 'Invalid token')
    user=db.get(User, user_id)
    if not user or not user.is_active: raise HTTPException(401, 'Inactive or missing user')
    return user

def require_roles(*roles: UserRole):
    def dep(user: User=Depends(get_current_user)) -> User:
        if user.role not in roles: raise HTTPException(403, 'Insufficient role')
        return user
    return dep

class CamelModel(BaseModel):
    model_config=ConfigDict(from_attributes=True, use_enum_values=True)
class LoginRequest(BaseModel): username: str; password: str
class RefreshRequest(BaseModel): refresh: str
class UserCreate(BaseModel): username: str=Field(min_length=3); full_name: str; password: str=Field(min_length=6); role: UserRole=UserRole.viewer; email: Optional[EmailStr]=None
class UserRead(CamelModel): id:int; username:str; email:Optional[EmailStr]=None; full_name:str; role:UserRole; is_active:bool
class UserUpdate(BaseModel): full_name:Optional[str]=None; role:Optional[UserRole]=None; is_active:Optional[bool]=None; password:Optional[str]=None; email:Optional[EmailStr]=None
class ListResponse(CamelModel): items:list[Any]; total:int; limit:int; offset:int
class PropertyIn(BaseModel):
    name:str; kind:PropertyKind; rental_mode:RentalMode; address_line:Optional[str]=None; city:Optional[str]=None; state:Optional[str]=None; cep:Optional[str]=None; matricula:Optional[str]=None; sequencial:Optional[str]=None; inscricao:Optional[str]=None; market_value:Optional[Decimal]=None; notes:Optional[str]=None
class UnitIn(BaseModel): name:str; base_rent:Decimal; notes:Optional[str]=None
class TenantIn(BaseModel): full_name:str; cpf:Optional[str]=None; email:Optional[str]=None; phone:Optional[str]=None; notes:Optional[str]=None
class LeaseTenantIn(BaseModel): tenant_id:int; is_primary:bool=False
class LeaseIn(BaseModel):
    unit_id:int; start_date:date; end_date:date; monthly_rent:Decimal; due_day:Optional[int]=Field(default=None, ge=1, le=28); deposit:Optional[Decimal]=None; notes:Optional[str]=None; tenants:list[LeaseTenantIn]
    @field_validator('end_date')
    @classmethod
    def _end_after_start(cls, v, info):
        s=info.data.get('start_date');
        if s and v<s: raise ValueError('end_date must be on or after start_date')
        return v
class PaymentIn(BaseModel): amount_paid:Decimal; paid_date:date; document_id:Optional[int]=None
class ExpenseIn(BaseModel): category:ExpenseCategory; reference_period:date; amount:Decimal; due_date:Optional[date]=None; debt_id:Optional[int]=None; notes:Optional[str]=None
class DebtIn(BaseModel): name:str; kind:DebtKind; principal_amount:Decimal; installment_amount:Optional[Decimal]=None; installments_count:Optional[int]=Field(default=None, ge=1); first_due_date:Optional[date]=None; outstanding_balance:Decimal; property_id:Optional[int]=None; start_date:Optional[date]=None; notes:Optional[str]=None
class MatchIn(BaseModel): rent_charge_id:Optional[int]=None; expense_id:Optional[int]=None
class TxnExpenseIn(BaseModel): category:ExpenseCategory; property_id:Optional[int]=None; reference_period:Optional[date]=None

# serializers
def money(v): return str(Decimal(v or 0).quantize(Decimal('0.01')))
def user_out(u:User): return {'id':u.id,'username':u.username,'email':u.email,'full_name':u.full_name,'role':u.role.value,'is_active':u.is_active}
def property_out(p:Property): return {'id':p.id,'name':p.name,'kind':p.kind.value,'rental_mode':p.rental_mode.value,'address_line':p.address_line,'city':p.city,'state':p.state,'cep':p.cep,'matricula':p.matricula,'sequencial':p.sequencial,'inscricao':p.inscricao,'market_value':money(p.market_value) if p.market_value is not None else None,'notes':p.notes,'units':[unit_out(u, shallow=True) for u in p.units]}
def unit_out(u:Unit, shallow=False): return {'id':u.id,'property_id':u.property_id,'name':u.name,'base_rent':money(u.base_rent),'status':u.status.value,'notes':u.notes}
def tenant_out(t:Tenant): return {'id':t.id,'full_name':t.full_name,'cpf':t.cpf,'email':t.email,'phone':t.phone,'notes':t.notes}
def lease_out(l:Lease): return {'id':l.id,'unit_id':l.unit_id,'start_date':l.start_date.isoformat(),'duration_months':l.duration_months,'end_date':l.end_date.isoformat(),'monthly_rent':money(l.monthly_rent),'due_day':l.due_day,'deposit':money(l.deposit) if l.deposit is not None else None,'status':l.status.value,'notes':l.notes,'tenants':[{'tenant':tenant_out(x.tenant),'tenant_id':x.tenant_id,'is_primary':x.is_primary} for x in l.tenant_links]}
def charge_out(c:RentCharge): return {'id':c.id,'lease_id':c.lease_id,'reference_month':c.reference_month.isoformat(),'due_date':c.due_date.isoformat(),'amount_due':money(c.amount_due),'amount_paid':money(c.amount_paid),'paid_date':c.paid_date.isoformat() if c.paid_date else None,'status':c.status.value,'notes':c.notes}
def expense_out(e:Expense): return {'id':e.id,'property_id':e.property_id,'debt_id':e.debt_id,'category':e.category.value,'reference_period':e.reference_period.isoformat(),'amount':money(e.amount),'due_date':e.due_date.isoformat() if e.due_date else None,'paid_date':e.paid_date.isoformat() if e.paid_date else None,'status':e.status.value,'notes':e.notes}
def debt_out(d:Debt): return {'id':d.id,'name':d.name,'kind':d.kind.value,'principal_amount':money(d.principal_amount),'installment_amount':money(d.installment_amount) if d.installment_amount is not None else None,'installments_count':d.installments_count,'first_due_date':d.first_due_date.isoformat() if d.first_due_date else None,'outstanding_balance':money(d.outstanding_balance),'property_id':d.property_id,'start_date':d.start_date.isoformat() if d.start_date else None,'notes':d.notes}
def doc_out(d:Document): return {'id':d.id,'storage_key':d.storage_key,'original_filename':d.original_filename,'content_type':d.content_type,'size_bytes':d.size_bytes,'document_type':d.document_type.value,'owner_entity_type':d.owner_entity_type.value,'owner_entity_id':d.owner_entity_id,'uploaded_by':d.uploaded_by}
def bank_txn_out(t:BankTransaction): return {'id':t.id,'account_id':t.account_id,'fitid':t.fitid,'posted_date':t.posted_date.isoformat(),'kind':t.kind.value,'amount':money(t.amount),'counterparty_name':t.counterparty_name,'counterparty_doc':t.counterparty_doc,'memo':t.memo,'status':t.status.value,'rent_charge_id':t.rent_charge_id,'expense_id':t.expense_id,'tenant_id':t.tenant_id,'notes':t.notes}

def add_months(d:date, months:int)->date:
    y=d.year+(d.month-1+months)//12; m=(d.month-1+months)%12+1
    md=[31,29 if y%4==0 and (y%100!=0 or y%400==0) else 28,31,30,31,30,31,31,30,31,30,31][m-1]
    return date(y,m,min(d.day,md))
def month_start(d:date)->date: return date(d.year,d.month,1)
def months_between(start:date, end:date)->int:
    m=(end.year-start.year)*12+(end.month-start.month)
    if end.day>=start.day: m+=1
    return max(1, m)
def parse_ym(s:str)->date:
    y,m=map(int,s.split('-')); return date(y,m,1)
def recompute_charge(c:RentCharge, today:date|None=None):
    today=today or date.today()
    if c.amount_paid >= c.amount_due: c.status=ChargeStatus.paid
    elif c.amount_paid > 0: c.status=ChargeStatus.partial
    elif c.due_date < today: c.status=ChargeStatus.overdue
    else: c.status=ChargeStatus.pending

def recompute_lease(l:Lease, today:date|None=None):
    if l.status == LeaseStatus.cancelled: return
    today=today or date.today()
    if l.start_date > today: l.status=LeaseStatus.upcoming
    elif l.end_date < today: l.status=LeaseStatus.ended
    else: l.status=LeaseStatus.active

def recompute_units(db:Session):
    units=db.scalars(select(Unit)).all()
    for u in units:
        u.status = UnitStatus.occupied if any(l.status==LeaseStatus.active for l in u.leases) else UnitStatus.vacant

# ---------- conciliação: casamento por nome ----------
import unicodedata as _ud
_STOP={'de','da','do','dos','das','e','di','ltda','ltd','me','epp','eireli','servicos','serviços','saude','performance'}
def _tokens(s:str)->list[str]:
    s=_ud.normalize('NFKD', s or '').encode('ascii','ignore').decode().lower()
    return [w for w in re.findall(r'[a-z]+', s) if len(w)>2 and w not in _STOP]
def _cpf_digits(s:str)->str: return re.sub(r'\D','', s or '')
def _cpf_mid_match(doc:str|None, cpf:str|None)->bool:
    mid=re.search(r'\*{3}\.?(\d{3})\.?(\d{3})-?\*{2}', doc or '')
    cd=_cpf_digits(cpf or '')
    return bool(mid and len(cd)>=9 and cd[3:9]==mid.group(1)+mid.group(2))
def match_tenant(db:Session, name:str, doc:str|None, amount:Decimal|None=None)->tuple[Optional[Tenant],str]:
    """Casa contraparte -> Tenant. Precisão: CPF, ou >=2 tokens, ou nome curto com
    primeiro-nome igual. Desempate pelo valor (aluguel do contrato ativo)."""
    bt=_tokens(name)
    if not bt: return None, 'none'
    bset=set(bt); cands=[]
    for t in db.scalars(select(Tenant)).all():
        tt=_tokens(t.full_name)
        if not tt: continue
        shared=bset & set(tt)
        if not shared: continue
        cpf_ok=_cpf_mid_match(doc, t.cpf)
        first_ok=bt[0] in shared and tt[0] in shared  # mesmo primeiro nome
        eligible = cpf_ok or len(shared)>=2 or (len(shared)==1 and first_ok and (len(tt)<=2 or len(bt)<=2))
        if not eligible: continue
        rent_ok = amount is not None and any(l.status==LeaseStatus.active and l.monthly_rent==amount for lk in t.lease_links for l in [lk.lease])
        cands.append((cpf_ok, len(shared), rent_ok, t))
    if not cands: return None, 'none'
    cpf_ok, _s, _r, best = max(cands, key=lambda c:(c[0], c[2], c[1]))
    return best, ('alta' if cpf_ok else 'media')
def suggest_for_txn(db:Session, t:BankTransaction)->dict:
    """Sugestão (não aplica nada). credit->cobrança via inquilino; debit->despesa por valor+mês."""
    if t.kind==TxnKind.credit:
        tenant,conf=match_tenant(db, t.counterparty_name or '', t.counterparty_doc, t.amount)
        if not tenant: return {'kind':'none'}
        mref=date(t.posted_date.year, t.posted_date.month, 1)
        charge=db.scalar(select(RentCharge).join(Lease).join(LeaseTenant).where(LeaseTenant.tenant_id==tenant.id, RentCharge.reference_month==mref, RentCharge.status!=ChargeStatus.paid).order_by(RentCharge.id))
        return {'kind':'rent_charge','confidence':conf,'tenant':tenant_out(tenant),'rent_charge':charge_out(charge) if charge else None}
    mref=date(t.posted_date.year, t.posted_date.month, 1)
    exp=db.scalar(select(Expense).where(Expense.amount==t.amount, Expense.reference_period==mref, Expense.status!=ExpenseStatus.paid).order_by(Expense.id))
    cat=ExpenseCategory.energia if 'LUZ' in (t.memo or '').upper() else ExpenseCategory.outros
    return {'kind':'expense','expense':expense_out(exp) if exp else None,'suggested_category':cat.value}

def seed_admin():
    Base.metadata.create_all(engine)
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    admin_username=os.getenv('ADMIN_USERNAME','eduardo')
    admin_password=os.getenv('ADMIN_PASSWORD','eduardo123')
    db=SessionLocal()
    try:
        if not db.scalar(select(User).where(User.username==admin_username)):
            db.add(User(username=admin_username, email=None, full_name='Eduardo', role=UserRole.admin, hashed_password=hash_password(admin_password)))
            db.commit()
    finally: db.close()

app=FastAPI(title='P&L Holding API', version='0.1.0')
# Em prod (mesma origem via Caddy) defina CORS_ORIGINS=https://app.holdingpl.com.br; default '*' p/ dev.
_cors=[o.strip() for o in os.getenv('CORS_ORIGINS','*').split(',') if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_cors, allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
if not os.getenv('SKIP_SEED'): seed_admin()

@app.get('/health')
def health(db:Session=Depends(get_db)):
    db.execute(select(1)); return {'status':'ok'}

@app.post('/auth/login')
def login(data:LoginRequest, db:Session=Depends(get_db)):
    user=db.scalar(select(User).where(User.username==data.username))
    if not user or not user.is_active or not verify_password(data.password, user.hashed_password): raise HTTPException(401, 'Invalid credentials')
    return token_pair(user)
@app.post('/auth/refresh')
def refresh(data:RefreshRequest, db:Session=Depends(get_db)):
    try: payload=jwt.decode(data.refresh, JWT_SECRET, algorithms=[JWT_ALGORITHM]); assert payload.get('typ')=='refresh'; uid=int(payload['sub'])
    except Exception: raise HTTPException(401, 'Invalid refresh token')
    user=db.get(User, uid)
    if not user or not user.is_active: raise HTTPException(401, 'Invalid refresh token')
    return token_pair(user)
@app.get('/auth/me')
def me(user:User=Depends(get_current_user)): return user_out(user)

@app.post('/users', status_code=201)
def create_user(data:UserCreate, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin))):
    if db.scalar(select(User).where(User.username==data.username)): raise HTTPException(409,'Username already exists')
    if data.email and db.scalar(select(User).where(User.email==data.email)): raise HTTPException(409,'E-mail already exists')
    u=User(username=data.username, email=data.email, full_name=data.full_name, role=data.role, hashed_password=hash_password(data.password)); db.add(u); db.commit(); db.refresh(u); return user_out(u)
@app.get('/users')
def list_users(limit:int=50, offset:int=0, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin))):
    q=select(User).offset(offset).limit(limit); return {'items':[user_out(x) for x in db.scalars(q)],'total':db.scalar(select(func.count(User.id))),'limit':limit,'offset':offset}
@app.get('/users/{id}')
def get_user(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin))):
    u=db.get(User,id); 
    if not u: raise HTTPException(404,'User not found')
    return user_out(u)
@app.patch('/users/{id}')
def update_user(id:int, data:UserUpdate, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin))):
    u=db.get(User,id); 
    if not u: raise HTTPException(404,'User not found')
    for k,v in data.model_dump(exclude_unset=True).items():
        if k=='password': u.hashed_password=hash_password(v)
        else: setattr(u,k,v)
    db.commit(); return user_out(u)
@app.patch('/users/{id}/deactivate')
def deactivate_user(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin))):
    u=db.get(User,id); 
    if not u: raise HTTPException(404,'User not found')
    u.is_active=False; db.commit(); return user_out(u)

@app.post('/properties', status_code=201)
def create_property(data:PropertyIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    p=Property(**data.model_dump()); db.add(p); db.commit(); db.refresh(p)
    if p.rental_mode==RentalMode.whole:
        db.add(Unit(property_id=p.id,name='Inteiro',base_rent=Decimal('0.00'))); db.commit(); db.refresh(p)
    return property_out(p)
@app.get('/properties')
def list_properties(q:Optional[str]=None, kind:Optional[PropertyKind]=None, limit:int=50, offset:int=0, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    stmt=select(Property); count=select(func.count(Property.id))
    if q: stmt=stmt.where(Property.name.ilike(f'%{q}%')); count=count.where(Property.name.ilike(f'%{q}%'))
    if kind: stmt=stmt.where(Property.kind==kind); count=count.where(Property.kind==kind)
    return {'items':[property_out(x) for x in db.scalars(stmt.offset(offset).limit(limit)).unique()],'total':db.scalar(count),'limit':limit,'offset':offset}
@app.get('/properties/{id}')
def get_property(id:int, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    p=db.get(Property,id); 
    if not p: raise HTTPException(404,'Property not found')
    return property_out(p)
@app.patch('/properties/{id}')
def update_property(id:int, data:PropertyIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    p=db.get(Property,id); 
    if not p: raise HTTPException(404,'Property not found')
    for k,v in data.model_dump(exclude_unset=True).items(): setattr(p,k,v)
    db.commit(); db.refresh(p); return property_out(p)
@app.delete('/properties/{id}', status_code=204)
def delete_property(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    p=db.get(Property,id); 
    if not p: raise HTTPException(404,'Property not found')
    if p.units or p.expenses or p.debts: raise HTTPException(409,'Property has linked records')
    db.delete(p); db.commit()

@app.post('/properties/{property_id}/units', status_code=201)
def create_unit(property_id:int, data:UnitIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    p=db.get(Property,property_id); 
    if not p: raise HTTPException(404,'Property not found')
    if p.rental_mode==RentalMode.whole and p.units: raise HTTPException(409,'Whole-rental property can have only one unit')
    u=Unit(property_id=property_id, **data.model_dump()); db.add(u); db.commit(); db.refresh(u); return unit_out(u)
@app.get('/units')
def list_units(property_id:Optional[int]=None, limit:int=100, offset:int=0, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    stmt=select(Unit); count=select(func.count(Unit.id))
    if property_id: stmt=stmt.where(Unit.property_id==property_id); count=count.where(Unit.property_id==property_id)
    return {'items':[unit_out(x) for x in db.scalars(stmt.offset(offset).limit(limit))],'total':db.scalar(count),'limit':limit,'offset':offset}
@app.patch('/units/{id}')
def update_unit(id:int, data:UnitIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    u=db.get(Unit,id); 
    if not u: raise HTTPException(404,'Unit not found')
    for k,v in data.model_dump(exclude_unset=True).items(): setattr(u,k,v)
    db.commit(); return unit_out(u)
@app.delete('/units/{id}', status_code=204)
def delete_unit(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    u=db.get(Unit,id); 
    if not u: raise HTTPException(404,'Unit not found')
    if u.leases: raise HTTPException(409,'Unit has leases')
    db.delete(u); db.commit()

@app.post('/tenants', status_code=201)
def create_tenant(data:TenantIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    t=Tenant(**data.model_dump()); db.add(t); db.commit(); db.refresh(t); return tenant_out(t)
@app.get('/tenants')
def list_tenants(q:Optional[str]=None, limit:int=50, offset:int=0, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    stmt=select(Tenant); count=select(func.count(Tenant.id))
    if q: stmt=stmt.where(or_(Tenant.full_name.ilike(f'%{q}%'), Tenant.cpf.ilike(f'%{q}%'))); count=count.where(or_(Tenant.full_name.ilike(f'%{q}%'), Tenant.cpf.ilike(f'%{q}%')))
    return {'items':[tenant_out(x) for x in db.scalars(stmt.offset(offset).limit(limit))],'total':db.scalar(count),'limit':limit,'offset':offset}
@app.get('/tenants/{id}')
def get_tenant(id:int, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    t=db.get(Tenant,id); 
    if not t: raise HTTPException(404,'Tenant not found')
    out=tenant_out(t); out['leases']=[lease_out(link.lease) for link in t.lease_links]; return out
@app.patch('/tenants/{id}')
def update_tenant(id:int, data:TenantIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    t=db.get(Tenant,id); 
    if not t: raise HTTPException(404,'Tenant not found')
    for k,v in data.model_dump(exclude_unset=True).items(): setattr(t,k,v)
    db.commit(); return tenant_out(t)
@app.delete('/tenants/{id}', status_code=204)
def delete_tenant(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    t=db.get(Tenant,id); 
    if not t: raise HTTPException(404,'Tenant not found')
    if t.lease_links: raise HTTPException(409,'Tenant has leases')
    db.delete(t); db.commit()

@app.post('/leases', status_code=201)
def create_lease(data:LeaseIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    u=db.get(Unit,data.unit_id); 
    if not u: raise HTTPException(404,'Unit not found')
    if not data.tenants: raise HTTPException(422,'Lease needs at least one tenant')
    due_day=data.due_day or min(data.start_date.day, 28)
    duration=months_between(data.start_date, data.end_date)
    l=Lease(unit_id=data.unit_id,start_date=data.start_date,duration_months=duration,end_date=data.end_date,monthly_rent=data.monthly_rent,due_day=due_day,deposit=data.deposit,notes=data.notes)
    recompute_lease(l); db.add(l); db.flush()
    for ti in data.tenants:
        if not db.get(Tenant,ti.tenant_id): raise HTTPException(404,'Tenant not found')
        db.add(LeaseTenant(lease_id=l.id,tenant_id=ti.tenant_id,is_primary=ti.is_primary))
    db.commit(); recompute_units(db); db.commit(); db.refresh(l); return lease_out(l)
@app.get('/leases')
def list_leases(status_:Optional[LeaseStatus]=Query(None, alias='status'), unit_id:Optional[int]=None, tenant_id:Optional[int]=None, limit:int=50, offset:int=0, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    stmt=select(Lease); count=select(func.count(Lease.id))
    if status_: stmt=stmt.where(Lease.status==status_); count=count.where(Lease.status==status_)
    if unit_id: stmt=stmt.where(Lease.unit_id==unit_id); count=count.where(Lease.unit_id==unit_id)
    if tenant_id: stmt=stmt.join(LeaseTenant).where(LeaseTenant.tenant_id==tenant_id); count=count.join(LeaseTenant).where(LeaseTenant.tenant_id==tenant_id)
    return {'items':[lease_out(x) for x in db.scalars(stmt.offset(offset).limit(limit)).unique()],'total':db.scalar(count),'limit':limit,'offset':offset}
@app.get('/leases/{id}')
def get_lease(id:int, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    l=db.get(Lease,id); 
    if not l: raise HTTPException(404,'Lease not found')
    out=lease_out(l); out['charges']=[charge_out(c) for c in l.charges]; return out
@app.patch('/leases/{id}')
def update_lease(id:int, data:LeaseIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    l=db.get(Lease,id); 
    if not l: raise HTTPException(404,'Lease not found')
    l.unit_id=data.unit_id; l.start_date=data.start_date; l.end_date=data.end_date; l.duration_months=months_between(data.start_date,data.end_date); l.monthly_rent=data.monthly_rent; l.due_day=data.due_day or min(data.start_date.day,28); l.deposit=data.deposit; l.notes=data.notes
    l.tenant_links.clear(); db.flush()
    for ti in data.tenants: db.add(LeaseTenant(lease_id=l.id, tenant_id=ti.tenant_id, is_primary=ti.is_primary))
    recompute_lease(l); db.commit(); recompute_units(db); db.commit(); return lease_out(l)
@app.post('/leases/{id}/end')
def end_lease(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    l=db.get(Lease,id); 
    if not l: raise HTTPException(404,'Lease not found')
    l.status=LeaseStatus.ended; l.end_date=date.today(); db.commit(); recompute_units(db); db.commit(); return lease_out(l)
@app.post('/leases/{id}/cancel')
def cancel_lease(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    l=db.get(Lease,id); 
    if not l: raise HTTPException(404,'Lease not found')
    l.status=LeaseStatus.cancelled; db.commit(); recompute_units(db); db.commit(); return lease_out(l)

@app.post('/rent-charges/generate')
def generate_charges(up_to_month:Optional[str]=None, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    up=parse_ym(up_to_month) if up_to_month else month_start(date.today()); created=[]
    for l in db.scalars(select(Lease).where(Lease.status==LeaseStatus.active)).all():
        cur=month_start(l.start_date)
        while cur<=up and cur<=month_start(l.end_date):
            exists=db.scalar(select(RentCharge).where(RentCharge.lease_id==l.id, RentCharge.reference_month==cur))
            if not exists:
                c=RentCharge(lease_id=l.id, reference_month=cur, due_date=date(cur.year,cur.month,l.due_day), amount_due=l.monthly_rent, amount_paid=Decimal('0.00'))
                recompute_charge(c); db.add(c); created.append(c)
            cur=add_months(cur,1)
    db.commit(); return {'created':[charge_out(c) for c in created], 'count':len(created)}
@app.post('/rent-charges/recompute')
def recompute_all(db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    for l in db.scalars(select(Lease)): recompute_lease(l)
    for c in db.scalars(select(RentCharge)): recompute_charge(c)
    recompute_units(db); db.commit(); return {'status':'ok'}
@app.get('/rent-charges')
def list_charges(lease_id:Optional[int]=None, status_:Optional[ChargeStatus]=Query(None, alias='status'), from_:Optional[str]=Query(None, alias='from'), to:Optional[str]=None, tenant_id:Optional[int]=None, vencidas:bool=False, limit:int=100, offset:int=0, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    stmt=select(RentCharge); count=select(func.count(RentCharge.id))
    if tenant_id: stmt=stmt.join(Lease).join(LeaseTenant).where(LeaseTenant.tenant_id==tenant_id); count=count.join(Lease).join(LeaseTenant).where(LeaseTenant.tenant_id==tenant_id)
    if lease_id: stmt=stmt.where(RentCharge.lease_id==lease_id); count=count.where(RentCharge.lease_id==lease_id)
    if status_: stmt=stmt.where(RentCharge.status==status_); count=count.where(RentCharge.status==status_)
    if from_: d=parse_ym(from_); stmt=stmt.where(RentCharge.reference_month>=d); count=count.where(RentCharge.reference_month>=d)
    if to: d=parse_ym(to); stmt=stmt.where(RentCharge.reference_month<=d); count=count.where(RentCharge.reference_month<=d)
    if vencidas: stmt=stmt.where(RentCharge.status.in_([ChargeStatus.overdue,ChargeStatus.partial])); count=count.where(RentCharge.status.in_([ChargeStatus.overdue,ChargeStatus.partial]))
    return {'items':[charge_out(x) for x in db.scalars(stmt.offset(offset).limit(limit)).unique()],'total':db.scalar(count),'limit':limit,'offset':offset}
@app.get('/rent-charges/{id}')
def get_charge(id:int, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    c=db.get(RentCharge,id); 
    if not c: raise HTTPException(404,'Charge not found')
    return charge_out(c)
@app.post('/rent-charges/{id}/payment')
def pay_charge(id:int, data:PaymentIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    c=db.get(RentCharge,id); 
    if not c: raise HTTPException(404,'Charge not found')
    if c.lease.status==LeaseStatus.cancelled: raise HTTPException(409,'Lease cancelled')
    c.amount_paid=data.amount_paid; c.paid_date=data.paid_date; recompute_charge(c); db.commit(); return charge_out(c)
@app.post('/rent-charges/{id}/reverse')
def reverse_charge(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    c=db.get(RentCharge,id); 
    if not c: raise HTTPException(404,'Charge not found')
    c.amount_paid=Decimal('0.00'); c.paid_date=None; c.notes=((c.notes or '')+'\nPagamento estornado').strip(); recompute_charge(c); db.commit(); return charge_out(c)

@app.post('/properties/{property_id}/expenses', status_code=201)
def create_expense(property_id:int, data:ExpenseIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    if not db.get(Property,property_id): raise HTTPException(404,'Property not found')
    e=Expense(property_id=property_id, **data.model_dump());
    if e.paid_date: e.status=ExpenseStatus.paid
    elif e.due_date and e.due_date<date.today(): e.status=ExpenseStatus.overdue
    db.add(e); db.commit(); db.refresh(e); return expense_out(e)
@app.get('/expenses')
def list_expenses(property_id:Optional[int]=None, debt_id:Optional[int]=None, category:Optional[ExpenseCategory]=None, status_:Optional[ExpenseStatus]=Query(None, alias='status'), from_:Optional[str]=Query(None, alias='from'), to:Optional[str]=None, limit:int=100, offset:int=0, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    stmt=select(Expense); count=select(func.count(Expense.id))
    if property_id: stmt=stmt.where(Expense.property_id==property_id); count=count.where(Expense.property_id==property_id)
    if debt_id: stmt=stmt.where(Expense.debt_id==debt_id); count=count.where(Expense.debt_id==debt_id)
    if category: stmt=stmt.where(Expense.category==category); count=count.where(Expense.category==category)
    if status_: stmt=stmt.where(Expense.status==status_); count=count.where(Expense.status==status_)
    if from_: d=parse_ym(from_); stmt=stmt.where(Expense.reference_period>=d); count=count.where(Expense.reference_period>=d)
    if to: d=parse_ym(to); stmt=stmt.where(Expense.reference_period<=d); count=count.where(Expense.reference_period<=d)
    return {'items':[expense_out(x) for x in db.scalars(stmt.offset(offset).limit(limit))],'total':db.scalar(count),'limit':limit,'offset':offset}
@app.get('/expenses/{id}')
def get_expense(id:int, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    e=db.get(Expense,id); 
    if not e: raise HTTPException(404,'Expense not found')
    return expense_out(e)
@app.patch('/expenses/{id}')
def update_expense(id:int, data:ExpenseIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    e=db.get(Expense,id); 
    if not e: raise HTTPException(404,'Expense not found')
    for k,v in data.model_dump(exclude_unset=True).items(): setattr(e,k,v)
    db.commit(); return expense_out(e)
@app.post('/expenses/{id}/payment')
def pay_expense(id:int, paid_date:date, document_id:Optional[int]=None, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    e=db.get(Expense,id); 
    if not e: raise HTTPException(404,'Expense not found')
    e.paid_date=paid_date; e.status=ExpenseStatus.paid; db.commit(); return expense_out(e)
@app.delete('/expenses/{id}', status_code=204)
def delete_expense(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    e=db.get(Expense,id); 
    if not e: raise HTTPException(404,'Expense not found')
    db.delete(e); db.commit()
@app.get('/despesas/resumo')
def expense_summary(from_:str=Query(..., alias='from'), to:str=Query(...), db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    f=parse_ym(from_); t=parse_ym(to)
    rows=db.execute(select(Expense.property_id, Expense.category, func.sum(Expense.amount)).where(Expense.reference_period>=f, Expense.reference_period<=t).group_by(Expense.property_id, Expense.category)).all()
    return {'from':from_,'to':to,'items':[{'property_id':r[0],'category':r[1].value,'total':money(r[2])} for r in rows]}

def generate_debt_installments(db:Session, d:Debt)->int:
    # idempotent: only creates installment-expenses missing for this debt
    if not (d.installment_amount and d.installments_count and d.first_due_date): return 0
    created=0
    for i in range(d.installments_count):
        ref=month_start(add_months(d.first_due_date, i))
        if db.scalar(select(Expense).where(Expense.debt_id==d.id, Expense.reference_period==ref)): continue
        due=add_months(d.first_due_date, i)
        e=Expense(property_id=d.property_id, debt_id=d.id, category=ExpenseCategory.emprestimo, reference_period=ref, amount=d.installment_amount, due_date=due)
        if e.due_date and e.due_date<date.today(): e.status=ExpenseStatus.overdue
        db.add(e); created+=1
    return created

@app.post('/debts', status_code=201)
def create_debt(data:DebtIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    if data.property_id and not db.get(Property,data.property_id): raise HTTPException(404,'Property not found')
    d=Debt(**data.model_dump()); db.add(d); db.flush(); generate_debt_installments(db, d); db.commit(); db.refresh(d); return debt_out(d)
@app.post('/debts/{id}/generate-installments')
def regenerate_installments(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    d=db.get(Debt,id)
    if not d: raise HTTPException(404,'Debt not found')
    n=generate_debt_installments(db, d); db.commit(); return {'created':n}
@app.get('/debts')
def list_debts(limit:int=100, offset:int=0, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    return {'items':[debt_out(x) for x in db.scalars(select(Debt).offset(offset).limit(limit))], 'total':db.scalar(select(func.count(Debt.id))), 'limit':limit,'offset':offset}
@app.get('/debts/{id}')
def get_debt(id:int, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    d=db.get(Debt,id); 
    if not d: raise HTTPException(404,'Debt not found')
    return debt_out(d)
@app.patch('/debts/{id}')
def update_debt(id:int, data:DebtIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    d=db.get(Debt,id); 
    if not d: raise HTTPException(404,'Debt not found')
    for k,v in data.model_dump(exclude_unset=True).items(): setattr(d,k,v)
    db.commit(); return debt_out(d)
@app.delete('/debts/{id}', status_code=204)
def delete_debt(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    d=db.get(Debt,id); 
    if not d: raise HTTPException(404,'Debt not found')
    db.delete(d); db.commit()

@app.post('/documents', status_code=201)
def upload_document(document_type:DocumentType=Form(...), owner_entity_type:OwnerEntityType=Form(...), owner_entity_id:int=Form(...), file:UploadFile=File(...), db:Session=Depends(get_db), user:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    content=file.file.read(); key=f'{owner_entity_type.value}/{owner_entity_id}/{uuid4()}_{file.filename}'
    path=STORAGE_DIR/key; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(content)
    d=Document(storage_key=key, original_filename=file.filename or 'arquivo', content_type=file.content_type or 'application/octet-stream', size_bytes=len(content), document_type=document_type, owner_entity_type=owner_entity_type, owner_entity_id=owner_entity_id, uploaded_by=user.id)
    db.add(d); db.commit(); db.refresh(d); return doc_out(d)
@app.get('/documents')
def list_docs(owner_entity_type:OwnerEntityType, owner_entity_id:int, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    docs=db.scalars(select(Document).where(Document.owner_entity_type==owner_entity_type, Document.owner_entity_id==owner_entity_id)).all(); return {'items':[doc_out(d) for d in docs]}
@app.get('/documents/{id}/download-url')
def download_doc(id:int, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    d=db.get(Document,id); 
    if not d: raise HTTPException(404,'Document not found')
    return {'url':f'/documents/{id}/raw','expires_in':300}
@app.get('/documents/{id}/raw')
def raw_doc(id:int, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    d=db.get(Document,id);
    if not d: raise HTTPException(404,'Document not found')
    return {'storage_key':d.storage_key,'path':str(STORAGE_DIR/d.storage_key)}
@app.get('/documents/{id}/file')
def file_doc(id:int, db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    d=db.get(Document,id)
    if not d: raise HTTPException(404,'Document not found')
    p=STORAGE_DIR/d.storage_key
    if not p.exists(): raise HTTPException(404,'File missing on storage')
    return FileResponse(str(p), media_type=d.content_type, filename=d.original_filename)
@app.delete('/documents/{id}', status_code=204)
def delete_doc(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    d=db.get(Document,id); 
    if not d: raise HTTPException(404,'Document not found')
    try: (STORAGE_DIR/d.storage_key).unlink(missing_ok=True)
    except Exception: pass
    db.delete(d); db.commit()

# ---------- Conciliação bancária ----------
BANK_ACCOUNT='caixa-5736295241'
@app.post('/bank/import')
def bank_import(files:list[UploadFile]=File(...), db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    created=0; duplicated=0; total=0
    for f in files:
        content=f.file.read()
        try: txns=parse_statement(f.filename or '', content)
        except Exception as e: raise HTTPException(422, f'Falha ao ler {f.filename}: {e}')
        for tx in txns:
            if not tx.get('posted_date'): continue
            total+=1
            if db.scalar(select(BankTransaction).where(BankTransaction.account_id==BANK_ACCOUNT, BankTransaction.fitid==tx['fitid'])):
                duplicated+=1; continue
            db.add(BankTransaction(account_id=BANK_ACCOUNT, fitid=tx['fitid'], posted_date=tx['posted_date'], kind=TxnKind(tx['kind']), amount=tx['amount'], counterparty_name=tx['counterparty_name'], counterparty_doc=tx['counterparty_doc'], memo=tx['memo']))
            created+=1
    db.commit(); return {'created':created,'duplicated':duplicated,'total':total}
@app.get('/bank/transactions')
def list_bank_txns(month:Optional[str]=None, kind:Optional[TxnKind]=None, status_:Optional[ReconStatus]=Query(None, alias='status'), db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    stmt=select(BankTransaction)
    if month: d=parse_ym(month); stmt=stmt.where(BankTransaction.posted_date>=d, BankTransaction.posted_date<add_months(d,1))
    if kind: stmt=stmt.where(BankTransaction.kind==kind)
    if status_: stmt=stmt.where(BankTransaction.status==status_)
    items=[]
    for t in db.scalars(stmt.order_by(BankTransaction.posted_date, BankTransaction.id)).all():
        out=bank_txn_out(t)
        out['suggestion']=suggest_for_txn(db, t) if t.status==ReconStatus.pending else None
        items.append(out)
    return {'items':items,'total':len(items)}
@app.get('/reconciliation/summary')
def recon_summary(month:str=Query(...), db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    d=parse_ym(month); nxt=add_months(d,1)
    txns=db.scalars(select(BankTransaction).where(BankTransaction.posted_date>=d, BankTransaction.posted_date<nxt)).all()
    charges=db.scalars(select(RentCharge).where(RentCharge.reference_month==d)).all()
    recebido=sum((t.amount for t in txns if t.kind==TxnKind.credit), Decimal('0.00'))
    conciliado=sum((t.amount for t in txns if t.kind==TxnKind.credit and t.status==ReconStatus.reconciled), Decimal('0.00'))
    nao_conc=sum((t.amount for t in txns if t.kind==TxnKind.credit and t.status==ReconStatus.pending), Decimal('0.00'))
    esperado=sum((c.amount_due for c in charges), Decimal('0.00'))
    em_aberto=sum((c.amount_due-c.amount_paid for c in charges if c.status!=ChargeStatus.paid), Decimal('0.00'))
    return {'month':month,'recebido':money(recebido),'esperado':money(esperado),'conciliado':money(conciliado),'nao_conciliado':money(nao_conc),'em_aberto':money(em_aberto)}
@app.get('/reconciliation/charges')
def recon_charges(month:str=Query(...), db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    """Visão por aluguel previsto: cada cobrança do mês + lançamento vinculado e/ou sugerido (por nome)."""
    d=parse_ym(month); nxt=add_months(d,1)
    charges=db.scalars(select(RentCharge).where(RentCharge.reference_month==d).order_by(RentCharge.id)).all()
    # casa cada crédito pendente do mês a um inquilino (uma vez)
    pend=[]
    for t in db.scalars(select(BankTransaction).where(BankTransaction.kind==TxnKind.credit, BankTransaction.status==ReconStatus.pending, BankTransaction.posted_date>=d, BankTransaction.posted_date<nxt)).all():
        ten,conf=match_tenant(db, t.counterparty_name or '', t.counterparty_doc, t.amount)
        pend.append((t, ten.id if ten else None, conf))
    items=[]; esperado=recebido=aberto=Decimal('0.00')
    for c in charges:
        lease=c.lease; unit=lease.unit; prop=unit.property
        prim=next((lk.tenant for lk in lease.tenant_links if lk.is_primary), None)
        tenants=', '.join(lk.tenant.full_name for lk in lease.tenant_links)
        linked=db.scalar(select(BankTransaction).where(BankTransaction.rent_charge_id==c.id))
        sug=None; conf=None
        if c.status!=ChargeStatus.paid and prim:
            cands=[(t,cf) for (t,tid,cf) in pend if tid==prim.id and not t.rent_charge_id]
            if cands:
                cands.sort(key=lambda x:(x[1]=='alta', x[0].amount==c.amount_due), reverse=True)
                sug, conf = cands[0]
        esperado+=c.amount_due; recebido+=c.amount_paid
        if c.status!=ChargeStatus.paid: aberto+=c.amount_due-c.amount_paid
        items.append({'charge':charge_out(c),'property':prop.name,'unit':unit.name,'tenants':tenants,
                      'linked_txn':bank_txn_out(linked) if linked else None,
                      'suggested_txn':bank_txn_out(sug) if sug else None,'confidence':conf})
    return {'month':month,'esperado':money(esperado),'recebido':money(recebido),'em_aberto':money(aberto),'items':items}
@app.post('/bank/transactions/{id}/match')
def bank_match(id:int, data:MatchIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    t=db.get(BankTransaction,id)
    if not t: raise HTTPException(404,'Lançamento não encontrado')
    if data.rent_charge_id:
        c=db.get(RentCharge,data.rent_charge_id)
        if not c: raise HTTPException(404,'Cobrança não encontrada')
        c.amount_paid=t.amount; c.paid_date=t.posted_date; recompute_charge(c)
        t.rent_charge_id=c.id
        prim=next((lt.tenant_id for lt in c.lease.tenant_links if lt.is_primary), None)
        t.tenant_id=prim
    elif data.expense_id:
        e=db.get(Expense,data.expense_id)
        if not e: raise HTTPException(404,'Despesa não encontrada')
        e.paid_date=t.posted_date; e.status=ExpenseStatus.paid; t.expense_id=e.id
    else:
        raise HTTPException(422,'Informe rent_charge_id ou expense_id')
    t.status=ReconStatus.reconciled; db.commit(); return bank_txn_out(t)
@app.post('/bank/transactions/{id}/create-expense')
def bank_create_expense(id:int, data:TxnExpenseIn, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    t=db.get(BankTransaction,id)
    if not t: raise HTTPException(404,'Lançamento não encontrado')
    if t.kind!=TxnKind.debit: raise HTTPException(422,'Só débitos viram despesa')
    ref=data.reference_period or date(t.posted_date.year, t.posted_date.month, 1)
    e=Expense(property_id=data.property_id, category=data.category, reference_period=ref, amount=t.amount, due_date=t.posted_date, paid_date=t.posted_date, status=ExpenseStatus.paid, notes=f'Criada da conciliação: {t.memo or ""} {t.counterparty_name or ""}'.strip())
    db.add(e); db.flush(); t.expense_id=e.id; t.status=ReconStatus.reconciled; db.commit(); return bank_txn_out(t)
@app.post('/bank/transactions/{id}/ignore')
def bank_ignore(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    t=db.get(BankTransaction,id)
    if not t: raise HTTPException(404,'Lançamento não encontrado')
    t.status=ReconStatus.ignored; db.commit(); return bank_txn_out(t)
@app.post('/bank/transactions/{id}/unmatch')
def bank_unmatch(id:int, db:Session=Depends(get_db), _:User=Depends(require_roles(UserRole.admin,UserRole.manager))):
    t=db.get(BankTransaction,id)
    if not t: raise HTTPException(404,'Lançamento não encontrado')
    if t.rent_charge_id:
        c=db.get(RentCharge,t.rent_charge_id)
        if c: c.amount_paid=Decimal('0.00'); c.paid_date=None; recompute_charge(c)
    if t.expense_id:
        e=db.get(Expense,t.expense_id)
        if e: e.paid_date=None; e.status=ExpenseStatus.pending
    t.rent_charge_id=None; t.expense_id=None; t.tenant_id=None; t.status=ReconStatus.pending; db.commit(); return bank_txn_out(t)

@app.get('/inadimplencia')
def inadimplencia(db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    rows=db.scalars(select(RentCharge).where(RentCharge.status.in_([ChargeStatus.overdue, ChargeStatus.partial]))).all(); today=date.today(); items=[]
    for c in rows:
        tenants=[x.tenant.full_name for x in c.lease.tenant_links]
        items.append({'charge':charge_out(c),'lease_id':c.lease_id,'tenants':tenants,'total_em_atraso':money(c.amount_due-c.amount_paid),'dias_atraso':max(0,(today-c.due_date).days)})
    return {'items':items,'total_em_atraso':money(sum((c.amount_due-c.amount_paid for c in rows), Decimal('0.00')))}
@app.get('/fluxo-alugueis')
def fluxo_alugueis(from_:str=Query(..., alias='from'), to:str=Query(...), db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    f=parse_ym(from_); t=parse_ym(to); cur=f; items=[]
    while cur<=t:
        rows=db.scalars(select(RentCharge).where(RentCharge.reference_month==cur)).all()
        items.append({'mes':cur.strftime('%Y-%m'),'esperado':money(sum((r.amount_due for r in rows),Decimal('0.00'))),'recebido':money(sum((r.amount_paid for r in rows),Decimal('0.00')))}); cur=add_months(cur,1)
    return {'items':items}
@app.get('/reports/resultado')
def resultado(from_:str=Query(..., alias='from'), to:str=Query(...), db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    f=parse_ym(from_); t=parse_ym(to)
    charges=db.scalars(select(RentCharge).where(RentCharge.reference_month>=f, RentCharge.reference_month<=t)).all(); expenses=db.scalars(select(Expense).where(Expense.reference_period>=f, Expense.reference_period<=t)).all()
    rec_real=sum((c.amount_paid for c in charges),Decimal('0.00')); rec_exp=sum((c.amount_due for c in charges),Decimal('0.00')); desp=sum((e.amount for e in expenses),Decimal('0.00'))
    return {'from':from_,'to':to,'receita_realizada':money(rec_real),'receita_esperada':money(rec_exp),'despesa_total':money(desp),'lucro':money(rec_real-desp),'base':'receita_realizada usa amount_paid; receita_esperada usa amount_due'}
@app.get('/reports/patrimonio')
def patrimonio(db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    props=db.scalars(select(Property)).all(); debts=db.scalars(select(Debt)).all(); pat=sum((p.market_value or Decimal('0.00') for p in props),Decimal('0.00')); div=sum((d.outstanding_balance for d in debts),Decimal('0.00'))
    return {'patrimonio_total':money(pat),'dividas_total':money(div),'patrimonio_liquido':money(pat-div),'properties':[property_out(p) for p in props],'debts':[debt_out(d) for d in debts]}
@app.get('/reports/fluxo-alugueis')
def reports_fluxo(from_:str=Query(..., alias='from'), to:str=Query(...), db:Session=Depends(get_db), user:User=Depends(get_current_user)): return fluxo_alugueis(from_,to,db,user)
@app.get('/reports/inadimplencia')
def reports_inad(db:Session=Depends(get_db), user:User=Depends(get_current_user)): return inadimplencia(db,user)
@app.get('/reports/ocupacao')
def ocupacao(db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    items=[]
    for p in db.scalars(select(Property)).all():
        total=len(p.units); occ=sum(1 for u in p.units if u.status==UnitStatus.occupied)
        items.append({'property_id':p.id,'property_name':p.name,'occupied':occ,'vacant':total-occ,'total':total,'taxa_ocupacao': (occ/total if total else 0)})
    return {'items':items}
@app.get('/reports/dashboard')
def dashboard(db:Session=Depends(get_db), _:User=Depends(get_current_user)):
    ym=date.today().strftime('%Y-%m'); res=resultado(ym,ym,db,_); pat=patrimonio(db,_); inad=inadimplencia(db,_); occ=ocupacao(db,_)
    return {'receita_mes':res['receita_realizada'],'inadimplencia_total':inad['total_em_atraso'],'patrimonio_liquido':pat['patrimonio_liquido'],'ocupacao':occ['items'],'contratos_vencendo_30_dias':[]}
