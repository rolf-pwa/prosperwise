
-- Content status enum
CREATE TYPE public.content_status AS ENUM ('draft', 'review', 'approved', 'published', 'archived');

-- Platform enum
CREATE TYPE public.content_platform AS ENUM ('linkedin', 'substack', 'wix_blog');

-- Main content posts table
CREATE TABLE public.content_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  status content_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  assigned_to uuid DEFAULT NULL,
  scheduled_at timestamp with time zone DEFAULT NULL,
  published_at timestamp with time zone DEFAULT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  notes text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Platform-specific versions of each post
CREATE TABLE public.content_platform_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.content_posts(id) ON DELETE CASCADE,
  platform content_platform NOT NULL,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone DEFAULT NULL,
  external_url text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(post_id, platform)
);

-- Enable RLS
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_platform_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for content_posts
CREATE POLICY "Advisors can view content posts" ON public.content_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Advisors can insert content posts" ON public.content_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Advisors can update content posts" ON public.content_posts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Advisors can delete content posts" ON public.content_posts FOR DELETE TO authenticated USING (true);

-- RLS policies for content_platform_versions
CREATE POLICY "Advisors can view platform versions" ON public.content_platform_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Advisors can insert platform versions" ON public.content_platform_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Advisors can update platform versions" ON public.content_platform_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Advisors can delete platform versions" ON public.content_platform_versions FOR DELETE TO authenticated USING (true);

-- Updated_at triggers
CREATE TRIGGER update_content_posts_updated_at BEFORE UPDATE ON public.content_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_platform_versions_updated_at BEFORE UPDATE ON public.content_platform_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
