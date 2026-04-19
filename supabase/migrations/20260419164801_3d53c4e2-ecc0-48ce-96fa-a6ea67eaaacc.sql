UPDATE public.subscription_plans
SET stripe_product_id = 'plan_pro',
    stripe_lookup_key_monthly = 'plan_pro_monthly',
    stripe_lookup_key_yearly = 'plan_pro_yearly',
    sync_status = 'synced',
    last_synced_at = now()
WHERE name = 'Pro';

UPDATE public.subscription_plans
SET stripe_product_id = 'plan_enterprise',
    stripe_lookup_key_monthly = 'plan_enterprise_monthly',
    stripe_lookup_key_yearly = 'plan_enterprise_yearly',
    sync_status = 'synced',
    last_synced_at = now()
WHERE name = 'Enterprise';