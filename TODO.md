# Task: Auth-Guard on "Place Order" button

## Goal
If user is not logged in, clicking "Place Order" redirects them to login. After successful login, checkout continues automatically. If already logged in, order proceeds directly.

## Steps

- [x] 1. Analyzed codebase: `handleProceedToPayment()` in checkout.html checks user but doesn't gate on auth
- [x] 2. Planned: Move auth check to top of `handleProceedToPayment()`, save form data, set pending flag, open account overlay if not logged in
- [x] 3. **Edited `checkout.html`**: Modified `handleProceedToPayment()` to gate on auth — if no user, save form backup, set `kappa_pending_checkout`, open account overlay, and return (blocking order)
- [x] 4. Verified existing `autoSubmitIfPending()` and auth state change handler already handle post-login auto-submit seamlessly

