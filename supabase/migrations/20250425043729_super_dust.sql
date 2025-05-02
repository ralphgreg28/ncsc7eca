/*
  # Fix Administrator Password

  1. Changes
    - Update password hash for initial administrator account
    - Ensure password matches the specified credentials

  2. Security
    - Use SHA-256 for password hashing
    - Maintain password requirements
*/

-- Update password hash for administrator account
UPDATE staff 
SET password_hash = '7d5c06b0e94e594b7c66c90e0c0ca8b75cd5e9fa7adc6218d3c0d1c9f80d601c'
WHERE username = 'rjdgregorio';