# Product

## Register

product

## Users

Internal team at P&L Investimentos, Incorporações e Locações LTDA: an admin (likely the owner), one or two managers, and occasional viewers. They use this daily on desktop, in an office environment, to check lease status, register payments, and monitor delinquency. They are not technical; they are familiar with the business domain and expect the system to match their mental model without training.

## Product Purpose

A single source of truth for the company's real estate portfolio: properties, units, tenants, leases, monthly charges, delinquency, expenses (IPTU, utilities), assets, and debts. It replaces a spreadsheet that mixed inconsistent data. Success means the team can open a tab and immediately see the financial health of the portfolio — what's owed, what's overdue, what's coming due — without interpretation effort.

## Brand Personality

Sólido, confiável, discreto. An institutional tool that earns trust by being precise and predictable. The gold accent signals heritage, not decoration. Navy communicates depth. The tagline "Da raiz ao fruto" grounds the identity in long-term stewardship, not speculation.

## Anti-references

- **Imobiliárias online (Zap, QuintoAndar):** listing-card grids, search-first UX, big property photos, consumer-facing tone. This is an operations back-office, not a storefront.
- **Generic SaaS dashboards (Vercel, Linear style):** gradient hero metrics, purple/indigo palettes, "unlock your potential" copy, identical metric-card grids with spark trends. The P&L tool is not a growth product.
- **Bootstrap/MUI defaults:** no brand identity, template feel. Every spacing and type decision should read as deliberate.

## Design Principles

1. **Numbers earn the space.** Every monetary value and date is the primary content. Typography, spacing, and color exist to make the numbers legible and scannable — not to decorate around them.
2. **Status must never be ambiguous.** The system surfaces problems (overdue charges, delinquency, expiring leases). Every status badge must be readable at a glance, even under time pressure or stress.
3. **Institutional restraint.** Elegance comes from what you leave out. No unnecessary chrome, no decorative gradients, no animation for its own sake. When in doubt, reduce.
4. **Consistent before creative.** The same kind of entity is always shown the same way. A table header, a pill status, a KPI card — always aligned to the same pattern. Consistency is the trust signal for internal tools.
5. **Precision is warmth.** For a family business, a well-crafted tool that runs reliably IS the expression of care. Pixel-perfect alignment and correct data formatting are emotional qualities here, not just technical ones.

## Accessibility & Inclusion

WCAG AA as a minimum. The team is small and able-bodied, but color contrast must be correct (status colors especially — green/red distinctions require sufficient luminance difference, not just hue). No known assistive technology needs beyond standard keyboard navigation.
