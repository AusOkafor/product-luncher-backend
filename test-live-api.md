# 🚀 Test Your Live Vercel API

## Your API is now live at:
**https://product-luncher-backend.vercel.app**

## Test These Endpoints:

### 1. Health Check
```bash
curl https://product-luncher-backend.vercel.app/health
```

### 2. Shopify Routes Test
```bash
curl https://product-luncher-backend.vercel.app/api/shopify/test
```

### 3. Test Webhook Endpoint
```bash
curl -X POST https://product-luncher-backend.vercel.app/api/shopify/webhooks/orders/create \
  -H "Content-Type: application/json" \
  -d '{"id":"test123","shop_domain":"austus-themes.myshopify.com"}'
```

### 4. AI Launch Test
```bash
curl https://product-luncher-backend.vercel.app/api/ai-launches/test
```

## Set Environment Variables in Vercel:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add these variables:

```
DATABASE_URL=postgres://postgres:Okwy%401986@localhost:5432/product-luncher?sslmode=disable
TOGETHER_API_KEY=your_together_key
JWT_SECRET=your-secret-key
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

## Update Shopify Webhooks:

Replace ngrok URL with your new Vercel URL:
- `https://product-luncher-backend.vercel.app/api/shopify/webhooks/orders/create`
- `https://product-luncher-backend.vercel.app/api/shopify/webhooks/orders/updated`

## Benefits Achieved:
✅ No more local server crashes
✅ Public HTTPS URL for webhooks
✅ Automatic scaling
✅ Better error handling
✅ Production-ready environment
