# Local File Storage Configuration

## Overview

Summit KT Portal now uses **local file storage** instead of Cloudflare R2 to ensure sensitive KT documents remain on your infrastructure and are never uploaded to external cloud services.

---

## Storage Location

All uploaded documents are stored in:

```
public/uploads/
```

This is the default location. You can override it with `UPLOAD_DIR`.

This directory is:

- ✅ **Excluded from Git** (see `.gitignore`)
- ✅ **Served locally** without external dependencies
- ✅ **Accessible only through authenticated API routes**
- ⚠️ **Your responsibility to backup** (not automatically replicated)

---

## File Organization

Files are named with a timestamp + sanitized filename to prevent collisions:

```
uploads/
├── 1715556000000-project-handbook.pdf
├── 1715556015000-onboarding-guide.docx
└── 1715556030000-api-spec.csv
```

---

## API Changes

### Before (Cloudflare R2)

```typescript
// lib/storage/r2.ts (deprecated)
await r2.send(new PutObjectCommand({...}))
```

### After (Local Storage)

```typescript
// lib/storage/local.ts (new)
import { uploadFile, downloadFile } from '@/lib/storage/local';

// Upload
const path = await uploadFile(fileName, buffer);
// Returns: "uploads/1715556000000-filename.pdf"

// Download
const buffer = await downloadFile(path);

// Delete
await deleteFile(path);
```

---

## Security Considerations

### ✅ What's Protected

- **Authentication Required**: All document endpoints require user login
- **Authorization Checked**: Members can only access documents from assigned projects
- **Access Logs**: Every document view is logged to `activity_log`
- **Directory Traversal Prevention**: File paths are validated to prevent `../` attacks

### ⚠️ Your Responsibility

- **Backups**: Set up regular backups of `public/uploads/`
- **File Cleanup**: Implement manual cleanup for old/deleted documents
- **Disk Space Monitoring**: Track `/uploads` directory size
- **Access Control**: Secure your server's file system permissions
- **Encryption at Rest**: Consider full-disk encryption if handling highly sensitive data

---

## Production Deployment

### Option 1: Mounted Volume (Recommended)

For cloud deployments, mount an external persistent volume:

**Docker:**

```yaml
volumes:
  - /mnt/data/uploads:/app/public/uploads
```

**Docker Compose:**

```yaml
services:
  app:
    volumes:
      - ./data/uploads:/app/public/uploads
```

### Option 2: Network-Attached Storage (NAS)

For on-prem or hybrid setups, mount a network share:

```bash
# Mount SMB/NFS share
mount -t nfs 192.168.1.100:/shared/uploads /app/public/uploads
```

### Option 3: External Storage Backup

Keep a read-only backup copy:

```bash
# Backup to network drive every 6 hours
0 */6 * * * rsync -av /app/public/uploads /backup/summit-kt-uploads/
```

---

## Environment Variables

Local storage supports an optional env variable:

```bash
UPLOAD_DIR=/mnt/summit/uploads
```

Examples:

```bash
# Windows
UPLOAD_DIR=D:\\summit-data\\uploads

# Linux / mounted drive
UPLOAD_DIR=/mnt/summit/uploads
```

---

## Migration from Cloudflare R2

If you had existing documents in R2, you must manually download and re-upload them:

```bash
# 1. Download all files from R2
# 2. Copy to public/uploads/
# 3. Update database file_url paths if they contain R2 bucket names
```

---

## Monitoring & Maintenance

### Check Disk Usage

```bash
du -sh public/uploads/
```

### List Recent Uploads

```bash
ls -lart public/uploads/ | tail -20
```

### Remove Files Older Than 90 Days

```bash
find public/uploads/ -type f -mtime +90 -delete
```

---

## Troubleshooting

| Issue                                      | Cause                     | Solution                                                             |
| ------------------------------------------ | ------------------------- | -------------------------------------------------------------------- |
| `Error: EACCES: permission denied`         | File system permissions   | Ensure `public/uploads/` is writable by Node.js process              |
| `Error: ENOENT: no such file or directory` | Uploads dir doesn't exist | Directory auto-creates on first upload; check parent dir permissions |
| `Document view returns 500`                | File was manually deleted | Re-upload document or check server logs                              |
| `Disk full`                                | No cleanup policy         | Implement automated deletion or expand storage                       |

---

## Switching Back to Cloud Storage

If you need to switch to Cloudflare R2 in the future:

1. Rename `lib/storage/local.ts` → `lib/storage/local.ts.bak`
2. Uncomment `lib/storage/r2.ts`
3. Update imports in:
   - `lib/documents/upload.ts`
   - `app/api/jobs/worker/route.ts`
   - `app/api/documents/view/route.ts`
4. Re-upload documents to R2
5. Update database `file_url` paths

---

## Support

For questions or issues with local file storage, refer to:

- [Node.js fs API](https://nodejs.org/api/fs.html)
- [Next.js Server-Side Code](https://nextjs.org/docs/getting-started/project-structure)
- Project issue tracker
