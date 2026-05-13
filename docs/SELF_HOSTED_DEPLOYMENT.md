# Self-Hosted Deployment Guide — Summit KT Portal

> **Why self-host?** Client data stays entirely within your infrastructure. No third-party vendor (Supabase, Vercel, etc.) has access to your database, files, or auth tokens.

---

## Architecture Overview

```
Your Server / VM
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌─────────────────┐    ┌─────────────────────┐    │
│  │  Supabase Stack │    │  Summit KT App      │    │
│  │  (Docker)       │    │  (Node.js / Docker) │    │
│  │                 │    │                     │    │
│  │  • PostgreSQL   │◄───│  • Next.js 14       │    │
│  │  • Auth (GoTrue)│    │  • Background worker│    │
│  │  • Storage      │    │                     │    │
│  │  • PostgREST    │    └─────────────────────┘    │
│  │  • Kong (proxy) │                               │
│  └─────────────────┘                               │
│                                                     │
└─────────────────────────────────────────────────────┘
         │
         │  HTTPS (port 443)
         ▼
    Your domain
  (e.g. kt.yourcompany.com)
```

---

## Server Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPUs | 4 vCPUs |
| RAM | 4 GB | 8 GB |
| Storage | 40 GB SSD | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Docker | 24+ | 24+ |
| Docker Compose | v2+ | v2+ |

**Suitable servers:**
- Azure VM (Standard_B2s ~$30/mo, Standard_D2s_v3 ~$70/mo)
- AWS EC2 (t3.small ~$15/mo, t3.medium ~$30/mo)
- On-premises Linux server
- Any VPS (DigitalOcean, Hetzner, Linode)

---

## Part 1 — Server Setup

### 1.1 Install Docker

```bash
# Update packages
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to the docker group (re-login after this)
sudo usermod -aG docker $USER

# Verify
docker --version
docker compose version
```

### 1.2 Install Git and other tools

```bash
sudo apt-get install -y git curl wget openssl nginx certbot python3-certbot-nginx
```

### 1.3 Point your domain to the server

In your DNS provider, create an A record:
```
kt.yourcompany.com      →  <server IP address>
supabase.yourcompany.com →  <server IP address>   # for Supabase dashboard
```

---

## Part 2 — Self-Hosted Supabase

### 2.1 Clone Supabase

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

### 2.2 Generate secrets

Run each command and save the output — you'll need these values:

```bash
# JWT Secret (at least 32 characters)
openssl rand -base64 32
# → e.g. K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=

# Anon key (JWT signed with the secret above)
# Use the JWT generator below

# Service role key (JWT signed with the secret above)
# Use the JWT generator below
```

**Generate the JWT keys** — paste this into any Node.js environment or at jwt.io:

```javascript
// Run: node generate-keys.js
const crypto = require('crypto');
const secret = 'YOUR_JWT_SECRET_FROM_ABOVE';

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function sign(header, payload, secret) {
  const data = `${base64url(header)}.${base64url(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${data}.${sig}`;
}

const header = { alg: 'HS256', typ: 'JWT' };

// Anon key
console.log('ANON KEY:', sign(header, {
  role: 'anon', iss: 'supabase', iat: 1700000000, exp: 2000000000
}, secret));

// Service role key
console.log('SERVICE KEY:', sign(header, {
  role: 'service_role', iss: 'supabase', iat: 1700000000, exp: 2000000000
}, secret));
```

### 2.3 Configure .env

Edit `supabase/docker/.env` with your values:

```bash
# Secrets — use the values generated above
POSTGRES_PASSWORD=<strong-random-password>
JWT_SECRET=<your-jwt-secret>
ANON_KEY=<anon-key-from-above>
SERVICE_ROLE_KEY=<service-role-key-from-above>

# Site URL — your app's public URL
SITE_URL=https://kt.yourcompany.com
ADDITIONAL_REDIRECT_URLS=https://kt.yourcompany.com

# Dashboard credentials
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<strong-dashboard-password>

# Email — use your SMTP server or Resend/SendGrid
SMTP_HOST=smtp.yourcompany.com
SMTP_PORT=587
SMTP_USER=noreply@yourcompany.com
SMTP_PASS=<smtp-password>
SMTP_SENDER_NAME=Summit KT Portal
```

### 2.4 Start Supabase

```bash
cd supabase/docker
docker compose up -d

# Verify all containers are running
docker compose ps
```

You should see these containers running:
- `supabase-db` — PostgreSQL
- `supabase-auth` — Auth (GoTrue)
- `supabase-rest` — PostgREST (API)
- `supabase-storage` — File storage
- `supabase-kong` — API gateway
- `supabase-studio` — Dashboard UI
- `supabase-imgproxy` — Image processing
- `supabase-realtime` — WebSocket realtime

### 2.5 Access the dashboard

Temporarily, Supabase dashboard is available at:
```
http://<server-ip>:8000
```

Login with the `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` you set.

---

## Part 3 — SSL & Reverse Proxy (Nginx)

### 3.1 Get SSL certificate

```bash
sudo certbot --nginx -d kt.yourcompany.com -d supabase.yourcompany.com
```

### 3.2 Nginx configuration

Create `/etc/nginx/sites-available/summit-kt`:

```nginx
# Summit KT App
server {
    listen 443 ssl;
    server_name kt.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/kt.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kt.yourcompany.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        # Allow large file uploads (matches Next.js 10MB limit)
        client_max_body_size 20M;
    }
}

# Supabase Dashboard & API
server {
    listen 443 ssl;
    server_name supabase.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/kt.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kt.yourcompany.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name kt.yourcompany.com supabase.yourcompany.com;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/summit-kt /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Part 4 — Run the Database Migrations

### 4.1 Copy migration files to server

From your local machine:
```bash
scp -r supabase/migrations/ user@<server-ip>:~/summit-migrations/
```

### 4.2 Run migrations via Supabase dashboard

1. Open `https://supabase.yourcompany.com`
2. Go to **SQL Editor**
3. Run each migration file in order:
   - `001_init.sql`
   - `002_quiz_window_resets.sql`
   - `003_activity_log_index.sql`
   - `004_document_governance.sql`
   - `005_seed_admin.sql` ← Edit this first: change the admin email/password
   - `006_chat_bookmarks.sql`
   - `007_quiz_category.sql`
   - `008_partial_retake.sql`
   - `009_question_type.sql`
   - `010_processing_jobs.sql`
   - `011_observability.sql`

### 4.3 Create Storage bucket

1. In Supabase dashboard → **Storage**
2. Create bucket named `documents`
3. Set to **Private** (not public)

---

## Part 5 — Deploy the Summit KT App

### Option A: Docker (recommended for production)

Create `Dockerfile` in the project root:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Add to `next.config.mjs`:
```javascript
output: 'standalone',
```

Build and run:
```bash
# On your server
docker build -t summit-kt .
docker run -d \
  --name summit-kt-app \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.production \
  summit-kt
```

### Option B: PM2 (simpler)

```bash
npm install -g pm2
npm run build
pm2 start npm --name "summit-kt" -- start
pm2 startup    # Auto-start on reboot
pm2 save
```

### Worker process

```bash
# Run alongside the app
pm2 start worker/index.mjs --name "summit-kt-worker"
pm2 save
```

---

## Part 6 — App Environment Variables

Create `.env.production` on the server:

```env
# Supabase — point to YOUR self-hosted instance
NEXT_PUBLIC_SUPABASE_URL=https://supabase.yourcompany.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-part-2>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-from-part-2>

# App
NEXT_PUBLIC_APP_NAME=Summit KT Portal
NEXT_PUBLIC_APP_URL=https://kt.yourcompany.com

# Worker
WORKER_SECRET=<random-secret>
INTERNAL_APP_URL=http://localhost:3000

# Groq AI
GROQ_API_KEY=gsk_...
GROQ_API_KEY_QUIZ=gsk_...

# Email (optional)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourcompany.com
```

**These are the ONLY changes needed to the app** — everything else is identical to the cloud version.

---

## Part 7 — Backups

### Automated daily database backup

```bash
# Create backup script
cat > /home/ubuntu/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/postgres
mkdir -p $BACKUP_DIR

docker exec supabase-db pg_dump -U postgres postgres \
  | gzip > $BACKUP_DIR/summit_kt_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: summit_kt_$DATE.sql.gz"
EOF

chmod +x /home/ubuntu/backup-db.sh

# Schedule daily at 2 AM
crontab -e
# Add: 0 2 * * * /home/ubuntu/backup-db.sh >> /var/log/db-backup.log 2>&1
```

### Restore from backup

```bash
gunzip -c /backups/postgres/summit_kt_20260511_020000.sql.gz \
  | docker exec -i supabase-db psql -U postgres postgres
```

---

## Part 8 — Security Hardening

### Firewall rules (UFW)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 8000/tcp   # Block direct Supabase port (use Nginx proxy only)
sudo ufw deny 5432/tcp   # Block direct PostgreSQL port
sudo ufw enable
```

### Restrict Supabase dashboard access (optional)

If only internal users need the dashboard, restrict it to your office IP:
```bash
sudo ufw allow from <office-ip> to any port 8000
```

### SSL auto-renewal

```bash
# Certbot auto-renews, verify the timer is active
sudo systemctl status certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

### Keep Docker images updated

```bash
# Monthly: update Supabase
cd ~/supabase/docker
docker compose pull
docker compose up -d
```

---

## Part 9 — Monitoring

### Check app health

```bash
# App status
pm2 status

# App logs
pm2 logs summit-kt --lines 100

# Worker logs
pm2 logs summit-kt-worker --lines 50
```

### Check Supabase health

```bash
# All containers running?
cd ~/supabase/docker && docker compose ps

# Database logs
docker logs supabase-db --tail 50

# Storage logs
docker logs supabase-storage --tail 50
```

### Disk usage

```bash
df -h                           # Server disk
docker system df                # Docker volumes
du -sh /backups/                # Backup size
```

---

## Part 10 — Migrating Existing Data from Supabase Cloud

If you have data in Supabase cloud that needs to move to the self-hosted instance:

```bash
# 1. Export from Supabase cloud (run on your local machine)
PGPASSWORD=<cloud-db-password> pg_dump \
  -h db.<project-ref>.supabase.co \
  -U postgres \
  -d postgres \
  --no-owner \
  --no-acl \
  -t users \
  -t projects \
  -t project_members \
  -t documents \
  -t document_chunks \
  -t chat_sessions \
  -t chat_messages \
  -t quiz_sets \
  -t quiz_questions \
  -t quiz_attempts \
  > summit_kt_export.sql

# 2. Copy export to your server
scp summit_kt_export.sql user@<server-ip>:~/

# 3. Import to self-hosted Supabase
docker exec -i supabase-db psql -U postgres postgres < ~/summit_kt_export.sql

# 4. Migrate storage files (documents bucket)
# Download all files from Supabase cloud storage
# Re-upload to self-hosted Supabase storage via the dashboard or API
```

---

## Quick Reference

| Task | Command |
|---|---|
| Start Supabase | `cd ~/supabase/docker && docker compose up -d` |
| Stop Supabase | `cd ~/supabase/docker && docker compose down` |
| Start app | `pm2 start summit-kt` |
| View app logs | `pm2 logs summit-kt` |
| Restart app | `pm2 restart summit-kt` |
| Manual DB backup | `/home/ubuntu/backup-db.sh` |
| Check disk space | `df -h` |
| Update Supabase | `docker compose pull && docker compose up -d` |
| Supabase dashboard | `https://supabase.yourcompany.com` |
| App | `https://kt.yourcompany.com` |

---

## Cost Summary (self-hosted vs cloud)

| | Cloud (Supabase Pro) | Self-hosted |
|---|---|---|
| Platform | $25/mo | $0 |
| Server | $0 | $30–80/mo (VM) |
| SSL | $0 | $0 (Let's Encrypt) |
| Backups | Included | $0 (local) or ~$2/mo (S3) |
| **Total** | **$25/mo** | **$30–80/mo** |
| Data control | Supabase servers | **Your servers** |
| Maintenance | Managed | **Your team** |
