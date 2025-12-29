-- Add columns for customizing login page left panel content
ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS hero_title TEXT DEFAULT 'Welcome back',
ADD COLUMN IF NOT EXISTS hero_description TEXT DEFAULT 'Secure access to programmes, projects, products and PRINCE2 controls—fully branded for your organization.',
ADD COLUMN IF NOT EXISTS feature_1_label TEXT DEFAULT 'Multi-tenant',
ADD COLUMN IF NOT EXISTS feature_1_text TEXT DEFAULT 'Organization data isolation',
ADD COLUMN IF NOT EXISTS feature_2_label TEXT DEFAULT 'Governance',
ADD COLUMN IF NOT EXISTS feature_2_text TEXT DEFAULT 'PRINCE2 registers & reporting',
ADD COLUMN IF NOT EXISTS login_footer_text TEXT DEFAULT 'Use your company email to sign in.';