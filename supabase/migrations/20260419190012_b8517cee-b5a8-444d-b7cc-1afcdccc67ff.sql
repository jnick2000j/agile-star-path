-- Explicitly deny all direct user access to reference_sequences.
-- The SECURITY DEFINER function generate_reference_number() bypasses these.

CREATE POLICY "Admins can view reference sequences"
ON public.reference_sequences
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- No INSERT/UPDATE/DELETE policies → blocked for all non-superuser roles.