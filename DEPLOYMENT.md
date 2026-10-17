# AWS EC2 CI/CD Deployment Guide

This repository contains a full automated **CI/CD Pipeline** using **GitHub Actions** and **Docker Compose** targeting **AWS EC2**.

---

## 🏗️ Architecture Overview

```
[ Developer ] -- git push --> [ GitHub Repository ]
                                     |
                                     v
                        [ GitHub Actions CI Runner ]
                        ├── 1. npm ci (Dependencies)
                        ├── 2. npm run lint (ESLint Quality Check)
                        ├── 3. npm test (Jest Unit Tests)
                        ├── 4. npm run build (TypeScript Compilation)
                        └── 5. docker build (Multi-stage Container Test)
                                     |
                                (If branch == main & CI passes)
                                     v
                        [ GitHub Actions CD Runner ]
                                     | (SSH via Appleboy SSH Action)
                                     v
                           [ AWS EC2 Instance ]
                        ├── 1. git pull origin main
                        ├── 2. docker compose up -d --build
                        ├── 3. npm run migration:run
                        └── 4. docker image prune -f
```

---

## 🛡️ Build Failure & Deploy Protection (Safety Gates)

The pipeline enforces **3 strict layers of safety** so broken code never reaches your production server:

1. **Local Pre-Push Gate (`.git/hooks/pre-push`)**:
   - Every time you run `git push`, your local machine automatically runs `npm run build`.
   - If TypeScript compilation fails, git immediately **aborts the push** and your broken code is never uploaded to GitHub.
2. **GitHub Actions CI Gate (`needs.ci.result == 'success'`)**:
   - The deployment job (`deploy`) **ONLY executes if all CI steps succeed 100%**:
     - `npm run lint` passes (0 errors)
     - `npm test` passes (100% tests green)
     - `npm run build` compiles cleanly
     - Multi-stage Docker build succeeds
   - If any step fails, GitHub Actions **immediately terminates and skips deployment**. Zero commands are sent to EC2.
3. **Server-Side Atomic Rollback (`deploy.sh`)**:
   - On EC2, `set -euo pipefail` ensures that if container building encounters an error, the deployment script aborts immediately without stopping your healthy, currently-running containers.

---

## 📋 Step 1: Prepare Your AWS EC2 Instance

1. **Launch EC2 Instance**:
   - AMI: **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS**
   - Instance Type: **t3.small** or **t3.medium** (recommended for Docker builds)
   - Key Pair: Create or select an existing key pair (download the `.pem` file).

2. **Configure Security Group (Inbound Rules)**:
   - **SSH**: Port `22` (Source: Your IP or `0.0.0.0/0` if required by GitHub Actions)
   - **HTTP**: Port `80` (Source: `0.0.0.0/0`)
   - **HTTPS**: Port `443` (Source: `0.0.0.0/0`)
   - **API Port**: Port `3000` (Source: `0.0.0.0/0` or reverse-proxied via Nginx on port 80/443)

3. **Install Docker & Docker Compose on EC2**:
   Connect to your EC2 instance via SSH:

   ```bash
   ssh -i your-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
   ```

   Run the following commands to install Docker:

   ```bash
   # Update packages
   sudo apt-get update && sudo apt-get upgrade -y

   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # Allow ubuntu user to run Docker without sudo
   sudo usermod -aG docker $USER
   newgrp docker

   # Verify Docker & Compose
   docker --version
   docker compose version
   ```

4. **Initial Repository Clone on EC2**:
   ```bash
   # Clone the repository
   cd /home/ubuntu
   git clone https://github.com/Vynn82/stock-management-api.git
   cd stock-management-api

   # Create production .env file
   cp .env.production.example .env
   nano .env
   # (Fill in your actual production secrets, database password, cloudinary keys, etc.)

   # Make deploy script executable
   chmod +x deploy.sh
   ```

---

## 🔐 Step 2: Configure GitHub Repository Secrets

Go to your repository on GitHub:
**Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions $\rightarrow$ New repository secret**

Add the following secrets:

| Secret Name   | Value                                | Description                                |
| :------------ | :----------------------------------- | :----------------------------------------- |
| `EC2_HOST`    | `54.x.x.x`                           | Your EC2 Public IPv4 address or Elastic IP |
| `EC2_USER`    | `ubuntu`                             | Default username for Ubuntu instances      |
| `EC2_SSH_KEY` | `-----BEGIN RSA PRIVATE KEY-----...` | Entire contents of your `.pem` key file    |
| `EC2_PORT`    | `22`                                 | Optional (default: `22`)                   |

> [!TIP]
> To copy your `.pem` key content cleanly, open it in a text editor and copy the entire text starting with `-----BEGIN ... PRIVATE KEY-----` and ending with `-----END ... PRIVATE KEY-----`.

---

## 🚀 Step 3: Triggering the Pipeline

1. **Continuous Integration (CI)**:
   - Triggers automatically on **every push** to `main` and `uat` branches, and on Pull Requests to `main`/`uat`.
   - Validates Lint, Tests, TypeScript Compilation, and Docker Multi-stage image build.

2. **Continuous Deployment (CD)**:
   - Triggers automatically whenever changes are pushed or merged into the **`main`** branch.
   - You can also trigger it manually from the **Actions** tab by selecting **"CI/CD Pipeline"** $\rightarrow$ **"Run workflow"**.

---

## 🔍 Verification & Useful Commands on EC2

Check container status:

```bash
docker compose -f docker-compose.prod.yml ps
```

View real-time API logs:

```bash
docker compose -f docker-compose.prod.yml logs -f api
```

View PostgreSQL logs:

```bash
docker compose -f docker-compose.prod.yml logs -f postgres
```

Run manual migration:

```bash
docker compose -f docker-compose.prod.yml exec api npm run migration:run
```
