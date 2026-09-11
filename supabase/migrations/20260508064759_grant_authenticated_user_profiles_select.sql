-- Role resolution reads only the current authenticated user's profile.
-- RLS remains responsible for row filtering; this grant only lets PostgREST
-- reach the table when the client has a valid authenticated JWT.
GRANT SELECT ON TABLE public.user_profiles TO authenticated;
