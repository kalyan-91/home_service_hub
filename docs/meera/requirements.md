# HomeService OS — Phase 1: UI/UX Requirements
### Member 2 — Services, Technicians, Matching, Booking, Payments & Reviews

---

## 1. Services Module

**Purpose:** Let the customer browse and understand available services before booking.

**Screens needed:**
- Service Catalog (grid/list of all services)
- Service Detail page

**Data fields required from database (Member 1's `services` table):**
- service_id, name, description, category, estimated_price (range), required_skill, estimated_duration

**User actions:**
- Search/filter services by category
- View service details
- Click "Book this service" → goes to Booking flow

---

## 2. Technicians Module

**Purpose:** Let the customer view technician profiles before/while booking.

**Screens needed:**
- Technician Listing page
- Technician Profile / Detail page

**Data fields required (Member 1's `technicians`, `technician_skills`, `technician_availability` tables):**
- technician_id, name, photo, skills, experience_years, service_area, rating, availability_status

**User actions:**
- View technician list
- Open a technician's profile
- See skills, ratings, and availability

---

## 3. Nearby Technician Matching Module

**Purpose:** Show the customer technicians close to them, matched by skill/rating/price.

**Screens needed:**
- Nearby Technician List / Map view

**Data fields required (from Member 3's matching logic):**
- technician distance (km), skill_match (yes/no), rating, price estimate

**User actions:**
- Toggle list view / map view
- Sort by distance, rating, or price
- Select a technician to proceed to booking

---

## 4. Booking Module

**Purpose:** Let the customer request a service and track its status.

**Screens needed:**
- Booking Request Wizard (multi-step: select home → appliance → service → problem → date/time → confirm)
- Status Tracker page

**Data fields required (Member 3's `service_requests`, `bookings` tables):**
- request_id, home_id, appliance_id, service_id, problem_description, preferred_date, preferred_time, status

**Status flow to display:**
`Pending → Assigned → Accepted → Scheduled → In Progress → Completed → Cancelled`

**User actions:**
- Fill and submit booking wizard
- View current status of a booking
- Cancel a pending booking

---

## 5. Payments Module

**Purpose:** Show the customer a clear cost summary after service completion.

**Screens needed:**
- Payment Summary page

**Data fields required (Member 3's `payments` table):**
- booking_id, service_cost, additional_cost, total, payment_method, payment_status, payment_date

**User actions:**
- View itemized cost breakdown
- View payment status (Paid / Pending)

---

## 6. Reviews Module

**Purpose:** Let the customer rate and review the technician/service after completion.

**Screens needed:**
- Rating & Review form (post-completion)

**Data fields required (Member 3's `reviews` table):**
- booking_id, technician_id, rating (1–5), review_text, review_date

**User actions:**
- Submit star rating
- Submit written review

---

## Shared Design Rules (from Member 4's design system)
- Consistent navbar, sidebar, buttons, cards, forms across all 6 screens above
- Same color palette, font, and spacing as the rest of the app
- Mobile-responsive layout

---

## Phase 1 Output
This document + the accompanying wireframe HTML files (`/wireframes`) satisfy the Phase 1 deliverable:
*"Contribute UI requirements/wireframes for Services, Technicians, Matching, Booking, Payments and Reviews screens."*
