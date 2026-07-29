# Pinterest Video Downloader

A modern, responsive, and high-converting frontend for downloading Pinterest videos, powered by a real Node.js scraping engine and bypass proxy. 

## Features
- **Modern Sky Blue Theme**: Frosty-glass UI elements, glowing background spots, and modern Poppins typography.
- **Real Scraper**: Automatically follow redirects, read metadata tags, parse schema structures recursively to grab the highest quality source MP4 link, and fallback dynamically.
- **Direct File Downloads**: Streams files through a backend proxy to bypass browser CORS blockages, forcing direct device downloads with progress loading states.
- **Responsive Layout**: Designed for mobile and desktop screens.

---

## 💻 Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start Server**:
   ```bash
   npm start
   ```
3. **Open Browser**: Go to [http://localhost:3000](http://localhost:3000).

---

## 🚀 How to Host / Deploy

Because this application relies on a **Node.js Express backend** for scraping and proxying file downloads, you **cannot** host it on static-only hosting services (like GitHub Pages, Netlify, or standard Vercel static deployments). You must deploy it to a platform that supports running a Node.js server.

Here are the best options:

### Option 1: Render (Recommended & Free)
Render is the easiest free cloud platform to deploy Node.js web services.

1. **Push your code to GitHub**:
   - Initialize git, commit your files, and push them to a private or public GitHub repository.
2. **Log in to Render**:
   - Go to [Render.com](https://render.com/) and sign up / log in with your GitHub account.
3. **Create a Web Service**:
   - Click the **"New +"** button in the dashboard and select **"Web Service"**.
   - Select your Pinterest Downloader repository.
4. **Configure Settings**:
   - **Name**: `pinterest-downloader` (or anything you prefer).
   - **Region**: Select the region closest to you.
   - **Branch**: `main` (or your default branch).
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Select the **"Free"** plan.
5. **Deploy**:
   - Click **"Deploy Web Service"**. Render will install the dependencies, build the project, start your server, and provide you with a free `https://your-app.onrender.com` URL with SSL enabled automatically.

---

### Option 2: Railway.app (Very Fast Setup)
Railway is another modern hosting service with a generous developer trial.

1. Go to [Railway.app](https://railway.app/) and sign in.
2. Click **"New Project"** -> **"Deploy from GitHub repo"**.
3. Select your repository.
4. Railway will automatically detect the `package.json` file, install dependencies, and host the Express server.
5. Go to the project settings in the dashboard and click **"Generate Domain"** to get a public URL.

---

### Option 3: VPS Self-Hosting (Ubuntu, Nginx, PM2)
If you want to host it on your own Virtual Private Server (e.g., DigitalOcean, Linode, AWS EC2, or Vultr):

1. **Install Node.js**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
2. **Clone your project** to the server.
3. **Install PM2** (process manager to run your server forever in the background):
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name "pinterest-downloader"
   pm2 startup
   pm2 save
   ```
4. **Configure Nginx Reverse Proxy**:
   - Install Nginx: `sudo apt install nginx`
   - Edit your default configuration `/etc/nginx/sites-available/default` to forward incoming traffic from port 80 to port 3000:
     ```nginx
     server {
         listen 80;
         server_name yourdomain.com;

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
   - Restart Nginx: `sudo systemctl restart nginx`.
5. **Set up SSL**: Use Certbot (Let's Encrypt) to configure HTTPS:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```
