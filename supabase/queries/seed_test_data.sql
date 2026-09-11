-- Clean Random Seed Script for 50 borrowers and their loans
-- Distributed: 25 to Bisayang Collector, 25 to Main Office
-- NO placeholder names like 'Bisayang Borrower' or 'Main Borrower'

DO $$
DECLARE
    bisayang_id uuid := 'febf98c8-ea7f-4bd7-b82d-3b0c9200f0b6';
    main_id uuid := '087c248d-2d08-4354-8e5b-e667567d39f6';
    new_borrower_id uuid;
    i integer;
    
    first_names text[] := ARRAY['Ricardo', 'Elena', 'Antonio', 'Sofia', 'Miguel', 'Carmen', 'Francisco', 'Beatriz', 'Bjay', 'Largo', 'Dante', 'Gina', 'Roderick', 'Isabel', 'Pedro', 'Rosa', 'Manuel', 'Teresa', 'Diego', 'Patricia', 'Fernando', 'Luisa', 'Jose', 'Maria', 'Juan'];
    last_names text[] := ARRAY['Mendoza', 'Torres', 'Tomas', 'Andrada', 'Luna', 'Villar', 'Perez', 'Gonzales', 'Rodriguez', 'Lopez', 'Dela Cruz', 'Villanueva', 'Santiago', 'Ramos', 'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia'];
    
    addresses text[] := ARRAY['Brgy. Malanday', 'Quezon City', 'Cebu City', 'Davao City', 'Taguig BGC', 'Makati Village', 'Ortigas Center', 'Iloilo City'];
    businesses text[] := ARRAY['Sari-sari Store', 'Street Food', 'Online Shop', 'Design Studio', 'Laundry', 'Water Station', 'Tailoring', 'Carpentry'];
    
    v_first_name text;
    v_last_name text;
    v_full_name text;
    v_collector_id uuid;
    v_principal numeric;
BEGIN
    FOR i IN 1..50 LOOP
        -- Distribute 25/25
        IF i <= 25 THEN
            v_collector_id := bisayang_id;
        ELSE
            v_collector_id := main_id;
        END IF;

        -- Generate unique random name
        v_first_name := first_names[1 + floor(random() * array_length(first_names, 1))];
        v_last_name := last_names[1 + floor(random() * array_length(last_names, 1))];
        v_full_name := v_first_name || ' ' || v_last_name || ' ' || (floor(random() * 1000 + i));
        
        new_borrower_id := gen_random_uuid();
        
        INSERT INTO app_borrowers (
            id, full_name, first_name, last_name, address, phone, area, route_index, 
            collector_id, date_of_birth, gender, notes, latitude, longitude, 
            "group", co_maker_name, business
        ) VALUES (
            new_borrower_id,
            v_full_name,
            v_first_name,
            v_last_name,
            addresses[1 + floor(random() * array_length(addresses, 1))],
            '091' || lpad((floor(random() * 100000000))::text, 8, '0'),
            CASE WHEN v_collector_id = bisayang_id THEN 'South Base' ELSE 'Main Center' END,
            i % 10,
            v_collector_id,
            '1985-05-20'::timestamptz + (random() * 10000 * interval '1 day'),
            CASE WHEN (random() > 0.5) THEN 'Male' ELSE 'Female' END,
            'Test borrower for sync verification',
            14.5 + (random() * 0.2), 
            121.0 + (random() * 0.2), 
            'Batch ' || (i % 3 + 1),
            'Guarantor ' || v_last_name,
            businesses[1 + floor(random() * array_length(businesses, 1))]
        );

        v_principal := 5000 + (floor(random() * 10) * 1000); 

        INSERT INTO app_loans (
            id, borrower_id, loan_number, principal_amount, interest_rate, interest_type,
            term, term_unit, frequency, total_amount, installment_amount, release_date,
            status, collector_id, notes, interest_amount, batch, cycle
        ) VALUES (
            gen_random_uuid()::text,
            new_borrower_id::text,
            'L-' || (CASE WHEN v_collector_id = bisayang_id THEN 'BC' ELSE 'MO' END) || '-' || lpad(i::text, 4, '0'),
            v_principal,
            5,
            'flat',
            30,
            'days',
            'daily',
            v_principal * 1.05,
            (v_principal * 1.05) / 30,
            now(),
            'active',
            v_collector_id::text,
            'Automated test loan',
            v_principal * 0.05,
            1,
            1
        );
    END LOOP;
END $$;
