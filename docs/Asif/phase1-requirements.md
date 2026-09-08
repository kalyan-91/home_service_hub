# Asif – Phase 1 Requirements

## 1. Customer Requirements

The Customer module allows a registered user to manage their account and interact with the home-service system.

### Functional Requirements

* Customer should be able to register using name, email, phone number, and password.
* Customer should be able to log in securely.
* Customer should be able to view and update their profile (name, phone, email, address).
* Customer should be able to reset or change their password.
* Customer should be able to view their dashboard (homes, appliances, bookings, service history).
* Customer should be able to log out.
* Customer should be able to delete or deactivate their account.

### Customer Information

A customer profile should contain:

* Customer ID
* Name
* Email
* Phone number
* Password (hashed)
* Registered date
* Account status (active/inactive)

---

## 2. Home Requirements

The Home module allows a customer to manage one or more residences linked to their account.

### Functional Requirements

* Customer should be able to add a new home.
* Customer should be able to view a list of all their homes.
* Customer should be able to view details of a specific home.
* Customer should be able to edit home details.
* Customer should be able to delete a home.
* Customer should be able to mark a home as the "current" home.
* Customer should be able to switch between multiple homes.
* System should support multiple homes per customer.

### Home Information

A home record should contain:

* Home ID
* Customer ID
* Address
* City
* State
* Pincode
* Latitude
* Longitude
* Home type (owned/rented/other)
* Current/previous status
* Created date

---

## 3. Appliance Requirements

The Appliance module allows a customer to maintain a digital record of appliances within each home.

### Functional Requirements

* Customer should be able to add an appliance to a home.
* Customer should be able to view a list of appliances for a home.
* Customer should be able to view details of a specific appliance.
* Customer should be able to edit appliance details.
* Customer should be able to delete an appliance.
* Customer should be able to record warranty information for an appliance.
* System should link each appliance to a home and, where applicable, to relevant services.
* System should support common appliance categories.

### Appliance Categories

* Fans
* Lights
* AC
* Refrigerator
* Washing machine
* TV
* Geyser
* RO purifier
* Microwave
* Inverter
* Other

### Appliance Information

An appliance record should contain:

* Appliance ID
* Home ID
* Name
* Category
* Brand
* Model
* Purchase date
* Warranty expiry date
* Created date

---

## 4. Move Mode Requirements

The Move Mode module helps a customer relocate their appliances to a new home and arrange installation/removal services.

### Functional Requirements

* Customer should be able to initiate "Move to New Home."
* Customer should be able to enter the new home's address details.
* Customer should be able to select which appliances to transfer from the old home.
* Customer should be able to view the list of required services generated for the selected appliances (handled by Member 3, using appliance data provided by Asif).
* Customer should be able to view an estimated cost range for the move (handled by Member 3).
* Customer should be able to confirm and submit the move request.
* Customer should be able to track the status of the move request.
* System should create a new home record for the destination address once the move is confirmed.
* System should preserve appliance history when appliances are transferred to the new home.

### Move Request Information

A move request should contain:

* Move request ID
* Customer ID
* Old home ID
* New home ID
* List of appliances being moved
* Move status (Pending, In Progress, Completed, Cancelled)
* Created date

### Move Appliance Information

Each moved appliance record should contain:

* Move appliance ID
* Move request ID
* Appliance ID
* Required service type (e.g., removal, installation)

---

## 5. Services Requirements

The Services module defines the catalog of home services the platform offers.

### Functional Requirements

* System should maintain a catalog of available services.
* Each service should have a name, description, estimated price/range, required skill, and estimated duration.
* Customer should be able to browse the service catalog.
* Customer should be able to view details of a specific service.
* System should associate services with relevant appliance categories where applicable.

### Initial Service Categories

* Electrical
* Plumbing
* AC Service
* Appliance Repair
* Carpentry
* Painting
* Cleaning
* RO Service
* Geyser Service
* Installation

### Service Information

A service record should contain:

* Service ID
* Name
* Description
* Estimated price / price range
* Required skill
* Estimated duration
* Category

---

## 6. Technician Requirements

The Technician module manages technician registration, profile, and availability.

### Functional Requirements

* Technician should be able to register using name, email, phone number, and password.
* Technician should be able to log in securely.
* Technician should be able to create and update a profile.
* Technician should be able to add skills and areas of expertise.
* Technician should be able to set service area / location.
* Technician should be able to set availability (days/times).
* Technician should be able to view assigned bookings (data supplied to Member 3's booking flow).
* System should calculate and display a technician's average rating (rating value supplied by Member 3's Reviews module).
* Admin should be able to verify technician registrations (verification action handled by Member 3, using data provided here).

### Technician Information

A technician profile should contain:

* Technician ID
* Name
* Email
* Phone number
* Password (hashed)
* Service area / location
* Latitude
* Longitude
* Verification status
* Registered date

### Technician Skill Information

A technician skill record should contain:

* Skill ID
* Technician ID
* Skill/service category
* Years of experience

### Technician Availability Information

An availability record should contain:

* Availability ID
* Technician ID
* Day of week
* Start time
* End time
* Available (yes/no)

---

# Overall Requirement Flow

**Customer registers/logs in**
↓
**Customer adds home(s) and appliance(s)**
↓
**Customer browses service catalog / technician profiles**
↓
**Customer requests a service or initiates Move Mode**
↓
**Appliance and service data is passed to Nearby Matching (Member 3)**
↓
**Technician receives and accepts the request (Member 3's Booking module)**
↓
**Service is completed and history is recorded**
↓
**Customer views updated home/appliance profile and service history**

# Phase 1 Deliverable

Asif is responsible for preparing the requirements for:

* Customer
* Home
* Appliance
* Move Mode
* Services
* Technicians

**Phase 1 does not require backend coding or frontend coding.**

These requirements will be used in the next phases for:

* Database design
* Backend development
* Frontend development
* Integration
* Testing
