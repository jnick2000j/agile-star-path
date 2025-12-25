-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  secondary_color TEXT DEFAULT '#1e293b',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create branding settings table
CREATE TABLE public.branding_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  secondary_color TEXT DEFAULT '#1e293b',
  accent_color TEXT DEFAULT '#3b82f6',
  font_family TEXT DEFAULT 'Inter',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Create user organization access table for RBAC
CREATE TABLE public.user_organization_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'viewer' CHECK (access_level IN ('admin', 'manager', 'editor', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Create user programme access table for granular RBAC
CREATE TABLE public.user_programme_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  programme_id UUID NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'viewer' CHECK (access_level IN ('owner', 'manager', 'editor', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, programme_id)
);

-- Create user project access table for granular RBAC
CREATE TABLE public.user_project_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'viewer' CHECK (access_level IN ('owner', 'manager', 'editor', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Add organization_id to existing tables
ALTER TABLE public.programmes ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.projects ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.risks ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.issues ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.benefits ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.stakeholders ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Add organization_id to profiles for default organization
ALTER TABLE public.profiles ADD COLUMN default_organization_id UUID REFERENCES public.organizations(id);

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organization_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_programme_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_project_access ENABLE ROW LEVEL SECURITY;

-- Create helper function to check organization access
CREATE OR REPLACE FUNCTION public.has_org_access(_user_id UUID, _org_id UUID, _min_level TEXT DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organization_access
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND CASE 
        WHEN _min_level = 'viewer' THEN access_level IN ('admin', 'manager', 'editor', 'viewer')
        WHEN _min_level = 'editor' THEN access_level IN ('admin', 'manager', 'editor')
        WHEN _min_level = 'manager' THEN access_level IN ('admin', 'manager')
        WHEN _min_level = 'admin' THEN access_level = 'admin'
        ELSE FALSE
      END
  ) OR public.is_admin(_user_id)
$$;

-- Create helper function to check programme access
CREATE OR REPLACE FUNCTION public.has_programme_access(_user_id UUID, _programme_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_programme_access
    WHERE user_id = _user_id
      AND programme_id = _programme_id
  ) 
  OR EXISTS (
    SELECT 1
    FROM public.programmes p
    JOIN public.user_organization_access uoa ON uoa.organization_id = p.organization_id
    WHERE p.id = _programme_id AND uoa.user_id = _user_id
  )
  OR public.is_admin(_user_id)
$$;

-- Create helper function to check project access
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_project_access
    WHERE user_id = _user_id
      AND project_id = _project_id
  ) 
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.user_organization_access uoa ON uoa.organization_id = p.organization_id
    WHERE p.id = _project_id AND uoa.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.user_programme_access upa ON upa.programme_id = p.programme_id
    WHERE p.id = _project_id AND upa.user_id = _user_id
  )
  OR public.is_admin(_user_id)
$$;

-- Organizations RLS policies
CREATE POLICY "Users can view orgs they have access to" ON public.organizations
FOR SELECT USING (
  public.has_org_access(auth.uid(), id) OR public.is_admin(auth.uid())
);

CREATE POLICY "Org admins can update their org" ON public.organizations
FOR UPDATE USING (
  public.has_org_access(auth.uid(), id, 'admin')
);

CREATE POLICY "System admins can create orgs" ON public.organizations
FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "System admins can delete orgs" ON public.organizations
FOR DELETE USING (public.is_admin(auth.uid()));

-- Branding settings RLS policies
CREATE POLICY "Users can view branding for their org" ON public.branding_settings
FOR SELECT USING (
  public.has_org_access(auth.uid(), organization_id)
);

CREATE POLICY "Org admins can manage branding" ON public.branding_settings
FOR ALL USING (
  public.has_org_access(auth.uid(), organization_id, 'admin')
);

-- User organization access RLS policies
CREATE POLICY "Users can view their own org access" ON public.user_organization_access
FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin(auth.uid())
);

CREATE POLICY "Org admins can manage access" ON public.user_organization_access
FOR ALL USING (
  public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid())
);

-- User programme access RLS policies
CREATE POLICY "Users can view their programme access" ON public.user_programme_access
FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin(auth.uid())
);

CREATE POLICY "Admins and org admins can manage programme access" ON public.user_programme_access
FOR ALL USING (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.programmes p
    WHERE p.id = programme_id AND public.has_org_access(auth.uid(), p.organization_id, 'admin')
  )
);

-- User project access RLS policies  
CREATE POLICY "Users can view their project access" ON public.user_project_access
FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin(auth.uid())
);

CREATE POLICY "Admins and org admins can manage project access" ON public.user_project_access
FOR ALL USING (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND public.has_org_access(auth.uid(), p.organization_id, 'admin')
  )
);

-- Update triggers for new tables
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_branding_settings_updated_at
BEFORE UPDATE ON public.branding_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for branding logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Storage policies for logos bucket
CREATE POLICY "Anyone can view logos" ON storage.objects
FOR SELECT USING (bucket_id = 'logos');

CREATE POLICY "Org admins can upload logos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'logos' AND auth.uid() IS NOT NULL
);

CREATE POLICY "Org admins can update logos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'logos' AND auth.uid() IS NOT NULL
);

CREATE POLICY "Org admins can delete logos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'logos' AND auth.uid() IS NOT NULL
);