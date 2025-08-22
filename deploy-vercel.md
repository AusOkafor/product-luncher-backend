# 🚀 Vercel Deployment Guide

## Quick Deployment Steps:

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy
```bash
vercel --prod
```

### 4. Set Environment Variables
After deployment, go to Vercel dashboard and add these environment variables:

```
DATABASE_URL=postgres://postgres:Okwy%401986@localhost:5432/product-luncher?sslmode=disable
TOGETHER_API_KEY=your_together_key
JWT_SECRET=your-secret-key
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

### 5. Update Shopify Webhooks
Replace ngrok URL with your Vercel URL:
- `https://your-app.vercel.app/api/shopify/webhooks/orders/create`
- `https://your-app.vercel.app/api/shopify/webhooks/orders/updated`

## Benefits:
✅ No more local server issues
✅ Public HTTPS URL for webhooks
✅ Automatic scaling
✅ Better error handling
✅ Production-ready environment

## Test After Deployment:
```bash
# Test health endpoint
curl https://your-app.vercel.app/health

# Test webhook endpoint
curl -X POST https://your-app.vercel.app/api/shopify/webhooks/orders/create \
  -H "Content-Type: application/json" \
  -d '{"id":"test123","shop_domain":"austus-themes.myshopify.com"}'
```
