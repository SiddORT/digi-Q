# Logo storage configuration

Logo selection supports **file uploads and existing HTTPS image links**. An external
image link does not require upload storage.

Configure uploads in the same private server settings file, such as
`/etc/digiq/server.env` loaded by Node's `--env-file`. Restart after configuration
changes. Never put this file or the upload folder in the web/public directory.

## Replit publishing

Keep `MEDIA_STORAGE=object` (the default). Existing App Storage configuration is used.
Do not select local disk on Replit Autoscale: deployment files are ephemeral.
This change does not migrate old files, change database schema or send messages.

## Independent server with persistent disk

```dotenv
MEDIA_STORAGE=local
MEDIA_ROOT=/var/lib/digiq/uploads
MEDIA_URL=/media
```

The server creates the folder if necessary and checks write access before listening.
Its service account needs ownership/write permission. Use a persistent disk/mount
outside release directories. Back up the folder **and the database**; metadata in
the database identifies each image. All replicas must share this folder.

`MEDIA_ROOT` is the physical folder. `MEDIA_URL` is a dedicated same-origin URL
prefix, for example `/media` or `/clinic-media`. It is not an arbitrary remote
folder, network share link or HTTPS upload API. A reverse proxy must forward that
prefix to the app, as well as `/api`. Do not expose the disk folder directly.
Proxy upload limits must allow 2 MB images (e.g. nginx `client_max_body_size 3m`).

Upload requests retain native session, CSRF, clinic ownership and rate limiting.
The backend checks byte limits and image dimensions, sanitizes raster images,
and assigns server-generated immutable filenames. Only validated logos are public;
there is no directory listing or generic file browser. Stored template references
remain canonical `/api/branding/logos/<id>` paths, so email CID attachments continue
working without fetching public URLs.

Each upload records its provider. Changing the default affects **new uploads only**;
old object-storage logos still need App Storage access, and old local logos still
need their original MEDIA_ROOT. Do not move/delete a folder or remove storage access
without an explicit file migration. No automatic fallback silently changes providers.

## Before publishing

- On Replit, retain object storage and its existing secrets.
- On independent hosting, attach persistent disk and load the above settings.
- Build/typecheck; verify a logo upload, preview and template save on the target host.
- SMTP acceptance and inbox delivery are separate checks; storage setup does not
  configure email delivery.