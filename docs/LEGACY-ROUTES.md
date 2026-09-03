# Legacy customer-app routes

These exist on `apps/web` for compatibility. Do not add new callers.

| Path | Meaning | Replacement |
| --- | --- | --- |
| `POST /api/login` | Legacy login alias | `POST /api/auth/login` |
| `POST /api/register` | **B2B registration**, not customer signup | `POST /api/auth/register/b2b` on web, or B2B app `/api/auth/register` |
| `/login` | Generic login page | `/login/customer` |
| `/register` | Generic register page | `/signup` |
| `/dashboard` | Legacy account entry | `/account` |
| `/account/settings` | Redirects to security | `/account/security` |
| `/account/bookings` | Redirects to trips | `/account/trips` |
| `/account/passengers` | Redirects to travelers | `/account/travelers` |

Removal requires an explicit consumer audit. Customer UIs must never post to `/api/register`.
