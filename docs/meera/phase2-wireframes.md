# Meera – Phase 2: Page List & Wireframes

Built directly as working HTML/CSS/JS (not static wireframes), matching the pace the rest of the team set by shipping working code from Phase 1 onward. Each page extends `templates/base.html` and uses the shared `static/js/api.js` helper, per the team's frontend plan.

## Services

| Page | File | Phase |
|---|---|---|
| Service catalog | `templates/services/catalog.html` | 5, 8 |
| Service detail | `templates/services/detail_card.html` | 8 |

## Technician

| Page | File | Phase |
|---|---|---|
| My profile (skills, availability) | `templates/technician/profile.html` | 5, 8 |
| Public technician listing | `templates/technician/listing.html` | 8 |
| Nearby technicians for a service | `templates/technician/nearby_list.html` | 10 |
| Add completed work | `templates/technician/add_completed_work.html` | 12 |
| My stats | `templates/technician/dashboard_stats.html` | 14 |

## Booking

| Page | File | Phase |
|---|---|---|
| Request flow (service → technician → date → location → review) | `templates/booking/request_flow.html` | 5, 9 |
| Select appliance | `templates/booking/select_appliance.html` | 7 |
| Status tracker (standalone) | `templates/booking/status_tracker.html` | 9 |

## Move Mode (part 2 — Meera's half)

| Page | File | Phase |
|---|---|---|
| Required services | `templates/move/required_services.html` | 11 |
| Technician search | `templates/move/technician_search.html` | 11 |

## Payments

| Page | File | Phase |
|---|---|---|
| Payment summary and history | `templates/payments/summary.html` | 5, 13 |

## Reviews

| Page | File | Phase |
|---|---|---|
| Rate and review | `templates/reviews/rating_form.html` | 5, 13 |

## Notifications

| Page | File | Phase |
|---|---|---|
| Notification center | `templates/notifications/center.html` | 13 |

## Auth (customer and technician)

| Page | File | Phase |
|---|---|---|
| Customer login and register | `templates/auth/customer_login.html` | 6 |
| Technician login and register | `templates/auth/technician_login.html` | 6 |

## Not yet built

| Page | File | Phase |
|---|---|---|
| Technician detail (linked from listing) | `templates/technician/<id>.html` | 8 |
| AI chat widget | `templates/ai/chat_widget.html` | 18 — later, after MVP is stable |

## Backend gaps affecting these pages

A few pages call endpoints that don't exist yet on the backend. Each JS file has a comment at the top naming the exact missing route:

- `GET /api/technician/stats` — `dashboard_stats.html`
- `POST /api/technician/work` — `add_completed_work.html`
- `GET /api/notifications/<user_id>`, `PATCH /api/notifications/<id>/read` — `center.html`
- `POST /api/reviews` — `rating_form.html`
