# Pavan – Phase 1 Requirements

## 1. Admin Requirements

The Admin module allows the administrator to manage and monitor the complete home-service system.

### Functional Requirements

* Admin should be able to log in securely.
* Admin should be able to view registered customers.
* Admin should be able to view and manage technicians.
* Admin should be able to add, update, or remove service categories.
* Admin should be able to view all bookings.
* Admin should be able to monitor booking status.
* Admin should be able to view payment records.
* Admin should be able to view customer reviews and ratings.
* Admin should be able to view complaints.
* Admin should be able to send system notifications.
* Admin should be able to view statistics and reports.

### Admin Dashboard

The dashboard should display:

* Total customers
* Total technicians
* Total services
* Total bookings
* Completed bookings
* Pending bookings
* Cancelled bookings
* Total payments
* Average technician rating

---

## 2. Statistics Requirements

The Statistics module provides useful information about customers, technicians, services, bookings, and payments.

### Statistics to Collect

* Number of customers
* Number of technicians
* Number of bookings
* Number of completed bookings
* Number of cancelled bookings
* Most requested services
* Most booked technicians
* Average service price
* Average technician rating
* Total revenue
* Monthly bookings
* Monthly revenue

### Statistical Analysis

The system may provide:

* Mean
* Median
* Mode
* Variance
* Standard deviation
* Quartiles
* Correlation
* Regression
* Appropriate hypothesis testing

### Filters

Statistics should be filterable by:

* Date
* Service category
* Location
* Technician
* Booking status

---

## 3. Payment Requirements

The Payment module manages payment information related to service bookings.

### Functional Requirements

* Customer should be able to view the service cost.
* Customer should be able to view the payment amount.
* System should record payment status.
* System should generate a payment record for each booking.
* Customer should be able to view payment history.
* Admin should be able to view all payment records.
* Admin should be able to monitor successful and failed payments.

### Payment Status

* Pending
* Successful
* Failed
* Refunded

### Payment Information

A payment record should contain:

* Payment ID
* Booking ID
* Customer ID
* Amount
* Payment date
* Payment method
* Payment status

---

## 4. Reviews and Ratings Requirements

The Reviews module allows customers to provide feedback after receiving a service.

### Functional Requirements

* Customer should be able to rate a technician after service completion.
* Customer should be able to submit a written review.
* Customer should be able to view previous reviews.
* Technician should be able to view customer feedback.
* Admin should be able to view reviews.
* Admin should be able to manage inappropriate reviews.
* Technician's average rating should be calculated automatically.

### Rating

Rating should be provided on a scale of:

**1 to 5 stars**

### Review Information

A review should contain:

* Review ID
* Booking ID
* Customer ID
* Technician ID
* Rating
* Review text
* Review date

---

## 5. Notification Requirements

The Notification module keeps customers, technicians, and administrators informed about important activities.

### Customer Notifications

Customer should receive notifications for:

* Booking confirmation
* Technician acceptance
* Technician rejection
* Technician assignment
* Technician arrival
* Service started
* Service completed
* Payment confirmation
* Booking cancellation
* Service reminders

### Technician Notifications

Technician should receive notifications for:

* New service request
* Booking assignment
* Customer cancellation
* Schedule changes
* Service reminders
* Customer review

### Admin Notifications

Admin should receive notifications for:

* New customer registration
* New technician registration
* New booking
* Payment issues
* Complaints
* Important system events

### Notification Status

* Unread
* Read

---

## 6. Booking Requirements

The Booking module manages the complete service-booking process.

### Functional Requirements

* Customer should be able to select a service.
* Customer should be able to select a technician.
* Customer should be able to select a date and time.
* Customer should be able to provide the service location.
* Customer should be able to confirm a booking.
* Technician should receive the booking request.
* Technician should be able to accept or reject the request.
* Customer should be able to cancel a booking according to the system rules.
* Customer should be able to view booking status.
* Technician should be able to update service status.
* Admin should be able to monitor bookings.

### Booking Status

**Pending → Assigned → Accepted → Scheduled → In Progress → Completed**

A booking may also be:

**Cancelled**

### Booking Information

A booking should contain:

* Booking ID
* Customer ID
* Technician ID
* Service ID
* Location
* Booking date
* Booking time
* Service cost
* Booking status
* Created date

---

## 7. Nearby Technician Matching Requirements

The Nearby Matching module helps customers find suitable technicians based on location and service requirements.

### Functional Requirements

* System should identify the customer's service location.
* System should identify technicians available near the customer.
* System should match technicians based on required service or skill.
* System should consider technician availability.
* System should display nearby technicians.
* System should show technician distance from the customer.
* System should show technician rating.
* System should show technician experience.
* Customer should be able to compare available technicians.
* Customer should be able to select a technician and continue to booking.

### Matching Factors

Technicians can be ranked using:

1. Distance
2. Required skill/service
3. Availability
4. Rating
5. Experience

### Example

Customer selects:

**Service: AC Repair**

System checks:

* Customer location
* Nearby AC technicians
* Technician availability
* Technician rating
* Technician experience

Then the system displays suitable technicians for the customer.

---

# Overall Requirement Flow

The modules should work together as follows:

**Customer requests service**
↓
**Nearby Matching finds suitable technicians**
↓
**Customer selects technician**
↓
**Booking is created**
↓
**Technician accepts booking**
↓
**Service is completed**
↓
**Customer makes payment**
↓
**Customer gives rating/review**
↓
**Notifications are generated**
↓
**Data is stored for Statistics**
↓
**Admin monitors the complete process**

# Phase 1 Deliverable

Pavan is responsible for preparing the requirements for:

* Admin
* Statistics
* Payments
* Reviews
* Notifications
* Booking
* Nearby Matching

**Phase 1 does not require backend coding or frontend coding.**

These requirements will be used in the next phases for:

* Database design
* Backend development
* Frontend development
* Integration
* Testing
