# Bank-transfer checkout

Set BANK_BIN, BANK_LABEL, BANK_ACCOUNT and BANK_ACCOUNT_NAME in the private environment of the backend. Restart the backend after changing them. The frontend receives only the public transfer instructions for an order it is allowed to read. No bank login or bank API credentials are stored.

Guest bank orders use the standard server-side price, CSRF protection and a Secure/HttpOnly/SameSite cookie in production. The database stores only the hash of this browser capability. Knowing an order code is insufficient to read another guest order. Wallet checkout and full order lists still require login. Guest cookies last 30 days; keep the same browser to revisit the order.

Apply migration 008_guest_orders.sql before releasing the backend. It allows guest owners only for direct payments and enforces guest idempotency. Back up PostgreSQL and the environment before migrating. The migration is additive except for removing the customer NOT NULL restriction; existing account orders remain valid. Once guest orders exist, keep a guest-aware backend when rolling back frontend changes.

VietQR Quicklink generates the QR using the merchant account, whole VND amount converted from stored cents and ZET + order code as transfer content. Reference: https://www.vietqr.io/qr-dong

QR display or the customer clicking Refresh never confirms a payment. In Admin > Orders, open a pending payment, reconcile the bank statement against its amount and code, then use the explicit payment-confirmation button. Only an admin with CSRF validation can move awaiting_payment to pending_admin. This transition is atomic and audited, does not debit a wallet or create CTV income, and must happen before CTV dispatch. Automatic bank reconciliation is not configured.
