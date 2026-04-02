ALTER TABLE booking_flights
ADD COLUMN IF NOT EXISTS ticketing_deadline date;
