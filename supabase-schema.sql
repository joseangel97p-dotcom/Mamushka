-- MAMUSHKA: ejecutar una sola vez en Supabase > SQL Editor.
-- Crea catálogo público, estados de publicación y bucket de fotos.
-- La clave service_role NUNCA debe colocarse en el frontend.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  category text not null check (category in ('Indumentaria','Calzado','Accesorios')),
  sizes jsonb not null default '[]'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('published','sold_out','draft','hidden')),
  tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists "Public can read visible products" on public.products;
create policy "Public can read visible products"
on public.products for select
to anon, authenticated
using (status in ('published','sold_out'));

drop policy if exists "Authenticated users manage products" on public.products;
create policy "Authenticated users manage products"
on public.products for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- Bucket público: cualquiera puede ver las fotos; solamente usuarios autenticados pueden subir/borrar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images',true, 10485760, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 10485760;

drop policy if exists "Anyone can view product images" on storage.objects;
create policy "Anyone can view product images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "Authenticated users upload product images" on storage.objects;
create policy "Authenticated users upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and auth.uid() is not null);

drop policy if exists "Authenticated users update product images" on storage.objects;
create policy "Authenticated users update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and auth.uid() is not null)
with check (bucket_id = 'product-images' and auth.uid() is not null);

drop policy if exists "Authenticated users delete product images" on storage.objects;
create policy "Authenticated users delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and auth.uid() is not null);
