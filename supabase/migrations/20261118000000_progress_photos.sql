-- Progress photos: a private storage bucket. Each person's photos live under a folder named after
-- their user id, and the policies below only let them see, add and delete inside their own folder.
-- Nobody else can open them, admins included. Files are capped at 3 MB and must be JPEGs (the app shrinks them first).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress', 'progress', false, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "progress photos: see own" on storage.objects;
create policy "progress photos: see own" on storage.objects
  for select to authenticated
  using (bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "progress photos: add own" on storage.objects;
create policy "progress photos: add own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "progress photos: remove own" on storage.objects;
create policy "progress photos: remove own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text);
