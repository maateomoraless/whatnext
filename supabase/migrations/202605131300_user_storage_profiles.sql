-- Ejecutar también en el SQL Editor de Supabase si hace falta.
alter table public.profiles add column if not exists plataformas jsonb;
alter table public.profiles add column if not exists valoraciones jsonb;
alter table public.profiles add column if not exists watchlist jsonb;
alter table public.profiles add column if not exists racha jsonb;
-- nombre, apellidos, email, peliculas_mes (objeto JSON)
alter table public.profiles add column if not exists perfil_meta jsonb;
