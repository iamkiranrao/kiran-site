---
title: ach-payments-explained
session_id: 0aca854f-95a2-4dfd-a484-76133f62745a
source: claude-ai-export
captured_at: 2026-03-12T03:23:16Z
session_type: chat
session_start: 2026-02-11T08:23:39.198147Z
session_end: 2026-02-11T08:24:07.209185Z
message_count: 2
user_messages: 1
assistant_messages: 1
total_words: 713
---

# Session: ACH payments explained

**Date range:** 2026-02-11 08:23:39 UTC → 2026-02-11 08:24:07 UTC
**Messages:** 1 from Kiran, 1 from Claude
**Total words:** 713

---

### Kiran `08:23`

Tell me everything I need to know about ach payments

---

### Claude `08:24`

# ACH Payments: What You Need to Know

ACH (Automated Clearing House) is an electronic funds transfer system that moves money between bank accounts across the U.S. It's operated by Nacha (formerly the National Automated Clearing House Association) and processed through the Federal Reserve and The Clearing House's EPN.

## How It Works

ACH transactions involve an **originator** (the party initiating the payment), an **ODFI** (Originating Depository Financial Institution — their bank), the **ACH network** itself, an **RDFI** (Receiving Depository Financial Institution — the recipient's bank), and the **receiver**. Transactions are processed in batches rather than in real time, which is what makes them cheaper than wire transfers.

## Two Main Types

**ACH Debits** ("pull" payments) — the receiver's bank pulls money from the sender's account. This is how direct debits, bill payments, and subscription charges typically work. When you authorize your utility company to auto-pay from your checking account, that's an ACH debit.

**ACH Credits** ("push" payments) — the originator pushes money to the receiver. Direct deposit of payroll is the most common example. Government benefits, tax refunds, and vendor payments also use ACH credits.

## Timing

Standard ACH processing takes 1–3 business days. Nacha introduced **Same-Day ACH** in 2016, which allows transactions to settle within the same business day (with processing windows throughout the day). Same-Day ACH has a per-transaction limit that Nacha has gradually increased — it was raised to $1 million per transaction in 2022.

## Costs

ACH is one of the cheapest payment methods available. Businesses typically pay between $0.20 and $1.50 per transaction, compared to 2–3% for credit card processing or $15–$30+ for wire transfers. Some banks offer ACH transfers free for consumers.

## Key Rules and Compliance

**Authorization** is required for all ACH transactions. For debits, the receiver must provide written, verbal, or electronic authorization before money can be pulled from their account. Unauthorized transactions can be returned.

**Return codes** are standardized. Common ones include R01 (insufficient funds), R02 (account closed), R03 (no account found), and R10 (unauthorized). Originators with high return rates may face penalties or lose ACH privileges.

**Nacha Operating Rules** govern the entire system. Businesses must comply with these rules, which cover authorization requirements, data security (encryption of account numbers), timing, and dispute resolution.

**Regulation E** (for consumers) provides protections including the right to stop payments, error resolution procedures, and liability limits for unauthorized transfers.

## Common Use Cases

- **Payroll** direct deposit
- **Bill payments** (mortgage, utilities, insurance)
- **B2B vendor payments**
- **Government payments** (Social Security, tax refunds)
- **E-commerce** as an alternative to card payments
- **Person-to-person transfers** (apps like Venmo and Zelle use ACH rails)
- **Recurring subscriptions**

## Advantages

Low cost, reliability, wide adoption (virtually all U.S. bank accounts can send/receive ACH), automation-friendly for recurring payments, and lower fraud rates compared to checks.

## Limitations

- **U.S.-only** — ACH doesn't work for international transfers (SWIFT/wire is used instead)
- **Not instant** — even Same-Day ACH isn't real-time like FedNow or RTP
- **Reversibility risk** — ACH debits can be returned or disputed, creating chargeback-like risk for businesses
- **Batch processing** — no weekend or holiday processing (though Same-Day ACH windows have expanded)

## ACH vs. Other Payment Methods

| Feature | ACH | Wire Transfer | Credit Card | FedNow/RTP |
|---|---|---|---|---|
| Speed | 1–3 days (same-day available) | Same day | Instant auth, 1–2 day settle | Seconds |
| Cost | Very low | $15–$50 | 2–3% | Low–moderate |
| Reversibility | Yes (returns/disputes) | Generally no | Chargebacks | No |
| International | No | Yes | Yes | No |

## If You're a Business Accepting ACH

You'll need a relationship with an ODFI (or use a payment processor like Stripe, Square, Dwolla, or Plaid that handles this), proper authorization collection and storage, compliance with Nacha rules and data security standards, and a process for handling returns and disputes. Many businesses use **ACH verification** services (like micro-deposits or instant account verification via Plaid) to reduce failed transactions.

If you want me to go deeper on any specific aspect — setting up ACH for a business, the technical file format (NACHA files), compliance details, or anything else — just let me know.

---
