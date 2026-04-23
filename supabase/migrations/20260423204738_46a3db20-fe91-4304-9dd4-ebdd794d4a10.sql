-- Create dedicated schema for extensions if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move vector extension out of public
ALTER EXTENSION vector SET SCHEMA extensions;

-- Make sure roles can use the extension types
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;