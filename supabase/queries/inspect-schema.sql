-- Run this in Supabase SQL Editor to check column types
-- This will help identify which columns are BIGINT vs TIMESTAMP

-- Check loans table column types
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'loans'
ORDER BY ordinal_position;

-- Check payment_schedules table column types
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'payment_schedules'
ORDER BY ordinal_position;

-- Check borrowers table column types
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'borrowers'
ORDER BY ordinal_position;

-- Check user_profiles table column types
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Check for duplicate emails in user_profiles
SELECT email, COUNT(*) as count FROM user_profiles GROUP BY email HAVING COUNT(*) > 1;

-- Check for orphaned borrowers (collector_id not in user_profiles)
SELECT b.id, b.collector_id FROM borrowers b 
LEFT JOIN user_profiles u ON b.collector_id = u.id 
WHERE u.id IS NULL AND b.deleted_at IS NULL;

-- Check recent data pushes to see what failed
SELECT * FROM borrowers ORDER BY updated_at DESC LIMIT 5;
SELECT * FROM loans ORDER BY updated_at DESC LIMIT 5;
