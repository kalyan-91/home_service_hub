-- HomeService OS — Pavan's (Member 3's) tables
-- Run this after the database itself and the shared `users`,
-- `homes`, `appliances`, `services`, `technicians` tables
-- (Member 1) already exist, since these tables reference them.

CREATE DATABASE IF NOT EXISTS home_service_hub;
USE home_service_hub;

-- ---------------------------------------------------------------
-- Shared users table (created here for local dev if Member 1
-- hasn't set it up yet — DROP this block once the real one exists)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id      INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(120)  NOT NULL,
    email        VARCHAR(150)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role         ENUM('customer','technician','admin') NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------
-- service_requests
-- ---------------------------------------------------------------
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
    FOREIGN KEY (customer_id) REFERENCES users(user_id)
);

-- ---------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------
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
    FOREIGN KEY (request_id) REFERENCES service_requests(request_id)
);

-- ---------------------------------------------------------------
-- service_history
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_history (
    history_id       INT AUTO_INCREMENT PRIMARY KEY,
    booking_id         INT NOT NULL,
    appliance_id         INT NULL,
    service_type          VARCHAR(120),
    cost                    DECIMAL(10,2),
    completed_date          DATETIME,
    notes                    TEXT,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);

-- ---------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- complaints
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    notification_id  INT AUTO_INCREMENT PRIMARY KEY,
    user_id            INT NOT NULL,
    message              VARCHAR(255),
    type                  VARCHAR(50),
    status                 ENUM('Unread','Read') DEFAULT 'Unread',
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ---------------------------------------------------------------
-- maintenance_reminders
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_reminders (
    reminder_id     INT AUTO_INCREMENT PRIMARY KEY,
    appliance_id       INT NOT NULL,
    customer_id           INT NOT NULL,
    reminder_type          VARCHAR(120),
    due_date                 DATE,
    status                    ENUM('Pending','Sent','Dismissed') DEFAULT 'Pending',
    FOREIGN KEY (customer_id) REFERENCES users(user_id)
);
