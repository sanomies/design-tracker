-- 0027_storage_bucket_limits.sql — server-side size + MIME limits on storage.
--
-- Findings M13 (no size/MIME caps → cost/quota abuse), M6 + M7 (stored XSS:
-- the public task-images bucket served user-uploaded SVG/HTML inline, and a
-- file card opening that object top-level executed script on the supabase.co
-- origin).
--
-- Client-side caps are bypassable by POSTing directly to /storage with the
-- anon key + a JWT, so the controls must live on the bucket. allowed_mime_types
-- is enforced at upload against the request's content-type and persisted, so a
-- content-type-spoofed HTML file is stored (and later served) as whatever safe
-- type it claimed — never as executable text/html.
--
-- task-images: capped at 50 MB and restricted to a generous list of safe
-- inline-renderable / downloadable types. Critically EXCLUDES text/html,
-- image/svg+xml, application/xhtml+xml, text/xml and application/xml — the
-- types a browser will execute as script when opened top-level. (image/* is
-- intentionally NOT used as a wildcard because it would re-admit image/svg+xml.)
--
-- task-attachments: size-capped only. It is private and served exclusively via
-- short-lived signed URLs, so it isn't a public inline-execution origin. (The
-- one place it can still be opened inline — openAttachmentInTab — is handled
-- separately.)
--
-- NOTE: allowed_mime_types gates NEW uploads only; it does not retroactively
-- remove or re-type objects already stored in the bucket.

update storage.buckets
set
  file_size_limit = 52428800, -- 50 MB
  allowed_mime_types = array[
    -- raster images (deliberately no image/svg+xml)
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif',
    -- documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv', 'text/plain', 'text/markdown', 'application/json',
    -- archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/x-tar', 'application/gzip',
    -- media
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
    -- generic binary download fallback (forces download, never inline render)
    'application/octet-stream'
  ]
where id = 'task-images';

update storage.buckets
set file_size_limit = 52428800 -- 50 MB
where id = 'task-attachments';
