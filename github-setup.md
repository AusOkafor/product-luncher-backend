# 🚀 GitHub + Vercel Deployment Guide

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com)
2. Click "New repository"
3. Repository name: `product-luncher-backend`
4. Make it **Public** (Vercel works better with public repos)
5. **Don't** initialize with README (we already have one)
6. Click "Create repository"

## Step 2: Connect Local Repo to GitHub

After creating the GitHub repo, run these commands:

```bash
# Add the remote origin (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/product-luncher-backend.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

1. Go to [Vercel.com](https://vercel.com)
2. Sign up/Login with GitHub
3. Click "New Project"
4. Import your `product-luncher-backend` repository
5. Vercel will auto-detect it's a Node.js project
6. Click "Deploy"

## Step 4: Configure Environment Variables

In Vercel dashboard, go to your project settings and add:

```
DATABASE_URL=postgres://postgres:Okwy%401986@localhost:5432/product-luncher?sslmode=disable
TOGETHER_API_KEY=your_together_key
JWT_SECRET=your-secret-key
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

## Step 5: Update Shopify Webhooks

Replace ngrok URL with your Vercel URL:
- `https://your-app.vercel.app/api/shopify/webhooks/orders/create`
- `https://your-app.vercel.app/api/shopify/webhooks/orders/updated`

## Benefits:
✅ Automatic deployments on every git push
✅ No more local server issues
✅ Public HTTPS URL for webhooks
✅ Better error handling and logs
✅ Production-ready environment

## Test Your Deployment:
```bash
# Test health endpoint
curl https://your-app.vercel.app/health

# Test webhook endpoint
curl -X POST https://your-app.vercel.app/api/shopify/webhooks/orders/create \
  -H "Content-Type: application/json" \
  -d '{"id":"test123","shop_domain":"austus-themes.myshopify.com"}'
```
