# AWS Deployment Guide for Congressional App Challenge

This guide shows how to deploy CivicLens to AWS using the 12-month free tier.

## Prerequisites

- AWS account (sign up at https://aws.amazon.com/free/)
- Node.js installed locally
- Git installed locally
- Basic AWS CLI or AWS Console access

---

## Step 1: Prepare Your Application

### 1.1 Build the Production Bundle

```bash
cd C:\Users\kamal\CAC-App
pnpm build
```

This creates a `.next` folder with the production build.

### 1.2 Set Environment Variables

Create a `.env.production` file with your Groq API key:

```bash
AI_PROVIDER=openai
ENRICHMENT_API_KEY=your-groq-api-key-here
ENRICHMENT_BASE_URL=https://api.groq.com/openai/v1
ENRICHMENT_MODEL=openai/gpt-oss-20b
```

**Note:** We'll set these in AWS later, but keep this file locally for reference.

---

## Step 2: Launch an EC2 Instance

### 2.1 Go to AWS Console

1. Log in to https://console.aws.amazon.com/
2. Go to **EC2** (under "Compute")
3. Click **"Launch Instance"**

### 2.2 Configure the Instance

**Name:** `civiclens-app`

**AMI (Amazon Machine Image):**
- Select **Amazon Linux 2023** (free tier eligible)
- Architecture: x86_64

**Instance Type:**
- Select **t2.micro** (free tier eligible)
- 1 vCPU, 1 GB RAM

**Key Pair (Login):**
- Click **"Create new key pair"**
- Name: `civiclens-key`
- Type: RSA
- Format: .pem (for Windows) or .ppk (for PuTTY)
- **Download the key file immediately** - you won't get it again!
- Save it in a safe location

**Network Settings:**
- Click **"Edit"**
- Create a security group named `civiclens-sg`
- Add rules:
  - **SSH (Port 22):** Allow from your IP (or 0.0.0.0/0 for testing)
  - **HTTP (Port 80):** Allow from 0.0.0.0/0
  - **HTTPS (Port 443):** Allow from 0.0.0.0/0

**Storage:**
- 8 GB gp3 (free tier eligible)

Click **"Launch Instance"**

---

## Step 3: Connect to Your EC2 Instance

### 3.1 Windows (using PuTTY)

1. Download PuTTY and PuTTYgen from https://www.putty.org/
2. Open PuTTYgen, load your `.pem` key, convert to `.ppk`
3. Open PuTTY:
   - Host Name: `ec2-user@<your-instance-public-ip>`
   - Port: 22
   - Connection → SSH → Auth → Credentials: Load your `.ppk` file
   - Click **"Open"**

### 3.2 Windows (using AWS CLI in PowerShell)

```powershell
aws ec2-instance-connect ssh --instance-id <your-instance-id> --os-user ec2-user
```

### 3.3 macOS/Linux

```bash
chmod 400 /path/to/civiclens-key.pem
ssh -i /path/to/civiclens-key.pem ec2-user@<your-instance-public-ip>
```

---

## Step 4: Install Node.js on EC2

Once connected:

```bash
# Update the system
sudo yum update -y

# Install Node.js 20.x
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version
npm --version
```

---

## Step 5: Deploy Your Application

### 5.1 Install Git and Clone Your Repo

```bash
sudo yum install -y git
cd /home/ec2-user
git clone https://github.com/Congressional-App-Challenge-Group/CAC-App.git
cd CAC-App
```

### 5.2 Install Dependencies

```bash
# Install pnpm globally
npm install -g pnpm

# Install project dependencies
pnpm install
```

### 5.3 Set Environment Variables

```bash
# Create .env.local
nano .env.local
```

Add your environment variables:
```bash
AI_PROVIDER=openai
ENRICHMENT_API_KEY=your-groq-api-key-here
ENRICHMENT_BASE_URL=https://api.groq.com/openai/v1
ENRICHMENT_MODEL=openai/gpt-oss-20b
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

### 5.4 Build the Application

```bash
pnpm build
```

### 5.5 Run the Application in Production Mode

```bash
# Install PM2 to keep the app running
npm install -g pm2

# Start the app with PM2
pm2 start npm --name civiclens -- start

# Configure PM2 to start on boot
pm2 startup
pm2 save
```

Your app is now running on port 3000!

---

## Step 6: Set Up Nginx Reverse Proxy

### 6.1 Install Nginx

```bash
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 6.2 Configure Nginx

```bash
sudo nano /etc/nginx/conf.d/civiclens.conf
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name <your-ec2-public-ip> <your-domain-if-any>;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

### 6.3 Restart Nginx

```bash
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

---

## Step 7: (Optional) Set Up SSL with Let's Encrypt

### 7.1 Install Certbot

```bash
sudo yum install -y certbot python3-certbot-nginx
```

### 7.2 Get SSL Certificate

```bash
sudo certbot --nginx -d <your-domain>
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

### 7.3 Auto-renewal

Certbot sets up auto-renewal by default. Verify:
```bash
sudo certbot renew --dry-run
```

---

## Step 8: Monitor Your Application

### 8.1 Check PM2 Status

```bash
pm2 status
pm2 logs civiclens
```

### 8.2 Restart if Needed

```bash
pm2 restart civiclens
```

### 8.3 Check Nginx Status

```bash
sudo systemctl status nginx
```

---

## Step 9: Update Your Application

When you push changes to GitHub:

```bash
cd /home/ec2-user/CAC-App
git pull
pnpm install
pnpm build
pm2 restart civiclens
```

---

## Step 10: Free Tier Monitoring

**Important:** The AWS free tier includes:
- 750 hours/month of t2.micro instances
- 30 GB of EBS storage
- 100 GB of data transfer out

**To avoid unexpected charges:**
1. Monitor your AWS Billing Dashboard
2. Set up billing alerts
3. Stop the instance when not in use:
   ```bash
   # From AWS Console or CLI
   aws ec2 stop-instances --instance-ids <your-instance-id>
   ```

---

## Troubleshooting

### Issue: Can't connect via SSH
- Check your security group allows port 22 from your IP
- Verify your key file permissions: `chmod 400 civiclens-key.pem`

### Issue: App won't start
- Check PM2 logs: `pm2 logs civiclens`
- Check if port 3000 is available: `sudo netstat -tlnp | grep 3000`

### Issue: Nginx 502 Bad Gateway
- Check if your Next.js app is running: `pm2 status`
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### Issue: Build fails
- Ensure Node.js version is 20.x or higher
- Try `rm -rf .next node_modules && pnpm install && pnpm build`

---

## Cost Summary (Free Tier)

| Service | Free Tier Limit | Cost After Free Tier |
|---------|----------------|---------------------|
| EC2 t2.micro | 750 hours/month | ~$8.50/month |
| EBS Storage (8 GB) | 30 GB/month | ~$0.96/month for 8 GB |
| Data Transfer | 100 GB/month | ~$0.09/GB |

**Total first year: $0** (if you stay within free tier limits)

---

## Alternative: Use AWS Amplify (Easier)

If you want a simpler deployment, consider AWS Amplify:

1. Go to https://console.aws.amazon.com/amplify/
2. Click **"New app"** → **"Host web app"**
3. Connect your GitHub repository
4. Amplify will automatically:
   - Build your Next.js app
   - Deploy to a global CDN
   - Set up SSL certificates
   - Handle CI/CD

**Note:** Amplify may not be fully covered by the free tier after the first few months, but it's much easier to set up.

---

## Summary

You now have CivicLens deployed on AWS with:
- ✅ Free tier EC2 instance
- ✅ Nginx reverse proxy
- ✅ Optional SSL with Let's Encrypt
- ✅ PM2 process management
- ✅ Groq AI integration via environment variables

For the Congressional App Challenge, judges can access your app at:
- `http://<your-ec2-public-ip>` or
- `https://<your-domain>` (if you set up SSL)

Good luck! 🚀
