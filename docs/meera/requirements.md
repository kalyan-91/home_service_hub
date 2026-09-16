# Meera – Phase 1 Requirements

## 1. Services UI Requirements

The Services UI allows a customer to discover, browse, and understand the services offered on the platform before requesting one.

### Functional Requirements

* Customer should be able to view a catalog of all available services as a grid/list of service cards.
* Customer should be able to filter the service catalog by category (Electrical, Plumbing, AC Service, Appliance Repair, Carpentry, Painting, Cleaning, RO Service, Geyser Service, Installation).
* Customer should be able to search services by name or keyword.
* Customer should be able to click a service card to view its detail page.
* Service detail page should display description, estimated price/range, required skill, and estimated duration.
* Service detail page should show a "Book this service" call-to-action button that leads into the Booking UI.
* Service cards should show a category icon/tag so customers can visually scan categories quickly.
* Service catalog should support an empty/no-results state (e.g., no services match filter).
* Service catalog and detail pages should be responsive across desktop and mobile.

### Screens

* Service Catalog (grid/list view with filters and search bar)
* Service Detail page

### UI Information Displayed

A service card/detail view should surface:

* Service name
* Category (with icon/tag)
* Short description
* Estimated price / price range
* Estimated duration
* Required skill (shown as a badge, e.g., "Electrician")

---

## 2. Technician UI Requirements

The Technician UI covers both the technician-facing profile/listing screens and the customer-facing technician browsing screens.

### Functional Requirements

* Technician should be able to register via a form (name, email, phone number, password).
* Technician should be able to log in via a dedicated technician login screen.
* Technician should be able to create/edit a profile (skills, years of experience, service area/location, availability by day and time).
* Technician profile screen should let the technician add multiple skills and set weekly availability using a simple day/time picker.
* Customer should be able to view a technician listing/search page showing technician cards.
* Customer should be able to click a technician card to view a full technician profile (skills, experience, rating, service area).
* Technician cards should show name, primary skill/category, average rating (stars), and experience (years).
* Technician listing should support sorting (e.g., by rating, by experience).
* Screens should show a "Pending Verification" indicator on technician-facing profile until Admin (Member 3's module) verifies them.

### Screens

* Technician Registration
* Technician Login
* Technician Profile (edit view, technician-facing)
* Technician Profile (read-only view, customer-facing)
* Technician Listing/Search

### UI Information Displayed

* Technician name
* Profile photo/avatar
* Skill(s) / category tags
* Years of experience
* Service area / location
* Availability summary (e.g., "Mon–Sat, 9 AM–6 PM")
* Average rating (stars) and review count
* Verification status badge

---

## 3. Booking UI Requirements

The Booking UI covers the multi-step flow a customer uses to request and track a service, and the technician-facing view of an assigned job.

### Functional Requirements

* Customer should be able to start a booking from a service detail page or technician profile.
* Booking flow should be a step-by-step wizard: select service → select technician (or "auto-match") → select date & time → enter/confirm location → review & confirm.
* Each step of the wizard should show progress (e.g., a step indicator: Step 2 of 5).
* Customer should be able to go back and edit a previous step before final confirmation.
* Review & confirm step should show a summary of all selections before submission.
* Customer should be able to view a booking status tracker showing the current stage: Pending → Assigned → Accepted → Scheduled → In Progress → Completed (or Cancelled).
* Customer should be able to cancel a pending/scheduled booking from the status tracker screen.
* Technician should be able to view an incoming booking request card with Accept/Reject actions.
* Technician should be able to update booking status (e.g., "Start Service", "Mark Completed") from a job detail screen.
* Booking screens should show empty states (e.g., "No active bookings") and loading states while awaiting backend confirmation.

### Screens

* Booking Request Wizard (multi-step)
* Booking Review & Confirm
* Booking Status Tracker (customer-facing)
* Incoming Request card + Job Detail screen (technician-facing)

### UI Information Displayed

A booking card/tracker should surface:

* Booking ID
* Service name
* Technician name (once assigned)
* Scheduled date & time
* Location
* Current status (with a visual progress stepper matching: Pending → Assigned → Accepted → Scheduled → In Progress → Completed / Cancelled)
* Estimated/confirmed cost

---

## 4. Nearby Matching UI Requirements

The Nearby Matching UI helps a customer visually compare and pick from technicians suggested for their service and location.

### Functional Requirements

* Customer should be able to view a list of nearby technicians after submitting a service request.
* Customer should be able to view the same technicians on a map view, in addition to the list view.
* Each technician entry should display distance from the customer, rating, and experience so the customer can compare at a glance.
* Customer should be able to toggle between list view and map view.
* Customer should be able to sort/filter nearby technicians (e.g., by distance, by rating).
* Customer should be able to select a technician directly from this screen to continue to booking.
* Screen should handle the case where no technicians are found nearby (empty state with guidance, e.g., "widen search area").

### Screens

* Nearby Technicians – List View
* Nearby Technicians – Map View

### UI Information Displayed

* Technician name and photo
* Distance from customer (e.g., "2.3 km away")
* Rating (stars)
* Experience (years)
* Skill match indicator (e.g., "Matches: AC Repair")
* "Select & Book" action

---

## 5. Payments UI Requirements

The Payments UI presents cost and payment information to the customer after a service is completed or during checkout.

### Functional Requirements

* Customer should be able to view the service cost before confirming a booking.
* Customer should be able to view a payment summary screen after service completion, showing amount, method, and status.
* Customer should be able to view a payment history list of all past transactions.
* Payment status should be visually distinguished (e.g., color-coded badges for Pending, Successful, Failed, Refunded).
* Payment summary screen should show a simple breakdown (service cost, any additional cost, total).

### Screens

* Payment Summary (post-service)
* Payment History (list)

### UI Information Displayed

* Payment ID
* Booking ID
* Amount / cost breakdown
* Payment method
* Payment date
* Payment status (badge: Pending / Successful / Failed / Refunded)

---

## 6. Reviews UI Requirements

The Reviews UI lets a customer rate and review a technician after service completion, and lets others view past reviews.

### Functional Requirements

* Customer should be able to rate a technician (1–5 stars) after a booking is marked Completed.
* Customer should be able to submit an optional written review alongside the star rating.
* Customer should be able to view their previously submitted reviews.
* Technician profile screen should display the technician's average rating and a scrollable list of past reviews.
* Review submission screen should be reachable directly from the Booking Status Tracker once a booking is Completed.
* Star rating input should be an interactive tap/click component (not a dropdown or text field).

### Screens

* Submit Rating & Review (post-completion)
* Reviews List (on technician profile)

### UI Information Displayed

* Star rating (1–5, interactive)
* Review text
* Review date
* Reviewer name (or "Anonymous" if applicable)
* Booking/service reference

---

# Overall Requirement Flow (Member 2 scope)

**Customer browses Service Catalog**
↓
**Customer opens Service Detail / Technician Profile**
↓
**Customer starts Booking Wizard**
↓
**Nearby Matching screen suggests technicians (list/map)**
↓
**Customer selects technician & confirms booking**
↓
**Customer tracks booking via Status Tracker**
↓
**Technician accepts/updates job via technician-facing screens**
↓
**Customer views Payment Summary after completion**
↓
**Customer submits Rating & Review**
↓
**All screens follow the shared design system (Member 4): colors, typography, buttons, cards, forms, navbar**

# Phase 1 Deliverable

Meera (Member 2) is responsible for preparing the UI/UX requirements for:

* Services
* Technicians
* Booking
* Nearby Matching
* Payments
* Reviews

**Phase 1 does not require actual UI implementation or code.**

These requirements will be used in the next phases for:

* Wireframes (Phase 2)
* Frontend structure (Phase 4)
* Services/Technician/Booking/Payments/Reviews UI build (Phase 5)
* Integration with Member 1 & Member 3's backend APIs (Phase 15)
* Testing (Phase 16)
