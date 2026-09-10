CREATE DATABASE IF NOT EXISTS home_service_hub;
USE home_service_hub;

-- Asif
CREATE TABLE IF NOT EXISTS users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(120)  NOT NULL,
    email         VARCHAR(150)  NOT NULL UNIQUE,
    phone         VARCHAR(20),
    password_hash VARCHAR(255)  NOT NULL,
    role          ENUM('customer','technician','admin') NOT NULL,
    status        ENUM('active','inactive') DEFAULT 'active',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id     INT PRIMARY KEY,
    registered_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS homes (
    home_id      INT AUTO_INCREMENT PRIMARY KEY,
    customer_id   INT NOT NULL,
    address        VARCHAR(255),
    city             VARCHAR(100),
    state             VARCHAR(100),
    pincode            VARCHAR(20),
    latitude            DECIMAL(9,6),
    longitude            DECIMAL(9,6),
    home_type             ENUM('owned','rented','other') DEFAULT 'owned',
    status                 ENUM('current','previous') DEFAULT 'current',
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE IF NOT EXISTS appliances (
    appliance_id    INT AUTO_INCREMENT PRIMARY KEY,
    home_id           INT NOT NULL,
    name                VARCHAR(120) NOT NULL,
    category              ENUM('Fan','Light','AC','Refrigerator','Washing Machine',
                                'TV','Geyser','RO Purifier','Microwave','Inverter','Other') NOT NULL,
    brand                   VARCHAR(100),
    model                    VARCHAR(100),
    purchase_date             DATE,
    warranty_expiry            DATE,
    created_at                  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (home_id) REFERENCES homes(home_id)
);

CREATE TABLE IF NOT EXISTS move_requests (
    move_request_id  INT AUTO_INCREMENT PRIMARY KEY,
    customer_id        INT NOT NULL,
    old_home_id          INT NOT NULL,
    new_home_id            INT NOT NULL,
    move_status              ENUM('Pending','In Progress','Completed','Cancelled') DEFAULT 'Pending',
    created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (old_home_id) REFERENCES homes(home_id),
    FOREIGN KEY (new_home_id) REFERENCES homes(home_id)
);

CREATE TABLE IF NOT EXISTS move_appliances (
    move_appliance_id     INT AUTO_INCREMENT PRIMARY KEY,
    move_request_id         INT NOT NULL,
    appliance_id               INT NOT NULL,
    required_service_type        VARCHAR(120),
    FOREIGN KEY (move_request_id) REFERENCES move_requests(move_request_id),
    FOREIGN KEY (appliance_id) REFERENCES appliances(appliance_id)
);

CREATE TABLE IF NOT EXISTS services (
    service_id       INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(120) NOT NULL,
    description           TEXT,
    price_range             VARCHAR(50),
    required_skill            VARCHAR(100),
    estimated_duration          VARCHAR(50),
    category                      ENUM('Electrical','Plumbing','AC Service','Appliance Repair',
                                        'Carpentry','Painting','Cleaning','RO Service',
                                        'Geyser Service','Installation') NOT NULL
);

CREATE TABLE IF NOT EXISTS technicians (
    technician_id       INT PRIMARY KEY,
    service_area           VARCHAR(150),
    latitude                  DECIMAL(9,6),
    longitude                   DECIMAL(9,6),
    verification_status           ENUM('Pending','Verified','Rejected') DEFAULT 'Pending',
    registered_date                 DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (technician_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS technician_skills (
    skill_id           INT AUTO_INCREMENT PRIMARY KEY,
    technician_id         INT NOT NULL,
    skill_category           VARCHAR(100) NOT NULL,
    years_experience           TINYINT DEFAULT 0,
    FOREIGN KEY (technician_id) REFERENCES technicians(technician_id)
);

CREATE TABLE IF NOT EXISTS technician_availability (
    availability_id     INT AUTO_INCREMENT PRIMARY KEY,
    technician_id          INT NOT NULL,
    day_of_week               ENUM('Mon','Tue','Wed','Thu','Fri','Sat','Sun') NOT NULL,
    start_time                  TIME,
    end_time                      TIME,
    available                      BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (technician_id) REFERENCES technicians(technician_id)
);

-- Pavan
CREATE TABLE IF NOT EXISTS service_requests (
    request_id          INT AUTO_INCREMENT PRIMARY KEY,
    customer_id          INT NOT NULL,
    service_id            INT NOT NULL,
    appliance_id           INT NULL,
    problem_description  TEXT,
    preferred_date        DATE,
    preferred_time         TIME,
    location               VARCHAR(255),
    status                 ENUM('Pending','Matched','Converted','Cancelled') DEFAULT 'Pending',
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(user_id),
    FOREIGN KEY (service_id) REFERENCES services(service_id),
    FOREIGN KEY (appliance_id) REFERENCES appliances(appliance_id)
);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id    INT AUTO_INCREMENT PRIMARY KEY,
    customer_id    INT NOT NULL,
    technician_id   INT NOT NULL,
    service_id       INT NOT NULL,
    request_id        INT NULL,
    location           VARCHAR(255),
    booking_date       DATE,
    booking_time       TIME,
    service_cost       DECIMAL(10,2),
    status              ENUM('Pending','Assigned','Accepted','Scheduled','In Progress','Completed','Cancelled') DEFAULT 'Pending',
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(user_id),
    FOREIGN KEY (technician_id) REFERENCES users(user_id),
    FOREIGN KEY (service_id) REFERENCES services(service_id),
    FOREIGN KEY (request_id) REFERENCES service_requests(request_id)
);

CREATE TABLE IF NOT EXISTS service_history (
    history_id       INT AUTO_INCREMENT PRIMARY KEY,
    booking_id         INT NOT NULL,
    appliance_id         INT NULL,
    service_type          VARCHAR(120),
    cost                    DECIMAL(10,2),
    completed_date          DATETIME,
    notes                    TEXT,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (appliance_id) REFERENCES appliances(appliance_id)
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id     INT AUTO_INCREMENT PRIMARY KEY,
    booking_id       INT NOT NULL,
    customer_id       INT NOT NULL,
    amount             DECIMAL(10,2),
    payment_date        DATETIME,
    payment_method       VARCHAR(50),
    status                ENUM('Pending','Successful','Failed','Refunded') DEFAULT 'Pending',
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (customer_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS reviews (
    review_id      INT AUTO_INCREMENT PRIMARY KEY,
    booking_id       INT NOT NULL,
    customer_id       INT NOT NULL,
    technician_id      INT NOT NULL,
    rating               TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text          TEXT,
    review_date           DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (customer_id) REFERENCES users(user_id),
    FOREIGN KEY (technician_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS complaints (
    complaint_id    INT AUTO_INCREMENT PRIMARY KEY,
    customer_id       INT NOT NULL,
    booking_id          INT NULL,
    subject               VARCHAR(200),
    description             TEXT,
    status                   ENUM('Open','Resolved') DEFAULT 'Open',
    created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(user_id),
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id  INT AUTO_INCREMENT PRIMARY KEY,
    user_id            INT NOT NULL,
    message              VARCHAR(255),
    type                  VARCHAR(50),
    status                 ENUM('Unread','Read') DEFAULT 'Unread',
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS maintenance_reminders (
    reminder_id     INT AUTO_INCREMENT PRIMARY KEY,
    appliance_id       INT NOT NULL,
    customer_id           INT NOT NULL,
    reminder_type          VARCHAR(120),
    due_date                 DATE,
    status                    ENUM('Pending','Sent','Dismissed') DEFAULT 'Pending',
    FOREIGN KEY (appliance_id) REFERENCES appliances(appliance_id),
    FOREIGN KEY (customer_id) REFERENCES users(user_id)
);
