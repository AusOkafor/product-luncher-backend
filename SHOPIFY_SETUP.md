# Shopify Integration Setup Guide

This guide will help you integrate your real Shopify store with the Product Luncher platform.

## Prerequisites

1. A Shopify store (can be a development store)
2. Admin access to your Shopify store
3. The Product Luncher backend running locally

## Step 1: Create a Shopify App

### Option A: Create a Custom App (Recommended for testing)

1. **Go to your Shopify Admin**
   - Log in to your Shopify store admin panel
   - Navigate to `Apps` > `Develop apps`

2. **Create a new app**
   - Click `Create an app`
   - Give it a name like "Product Luncher Integration"
   - Click `Create app`

3. **Configure Admin API access scopes**
   - Go to `Configuration` > `Admin API access scopes`
   - Select the following scopes:
     - `read_products`, `write_products`
     - `read_orders`, `write_orders`
     - `read_customers`, `write_customers`
     - `read_inventory`, `write_inventory`
     - `read_shop`, `write_shop`
   - Click `Save`

4. **Install the app**
   - Go to `API credentials`
   - Click `Install app`
   - Copy the `Admin API access token`

### Option B: Use a Public App (For production)

This requires creating a public Shopify app with OAuth flow, which is more complex but necessary for production use.

## Step 2: Configure Environment Variables

Add your Shopify credentials to your `.env` file:

```bash
# Shopify Configuration
SHOPIFY_ACCESS_TOKEN="your-admin-api-access-token-here"
SHOPIFY_STORE_DOMAIN="your-store.myshopify.com"
```

## Step 3: Run the Setup Script

```bash
npm run setup:shopify
```

This script will:
- Create a demo workspace and store
- Test the connection to your Shopify store
- Sync initial products and orders
- Display store statistics

## Step 4: Test the Integration

### Using the API Endpoints

1. **List all stores:**
   ```bash
   curl http://localhost:3000/api/shopify/stores
   ```

2. **Test connection:**
   ```bash
   curl http://localhost:3000/api/shopify/test-connection/YOUR_STORE_ID
   ```

3. **Sync products:**
   ```bash
   curl -X POST http://localhost:3000/api/shopify/sync-products/YOUR_STORE_ID \
     -H "Content-Type: application/json" \
     -d '{"limit": 10}'
   ```

4. **Sync orders:**
   ```bash
   curl -X POST http://localhost:3000/api/shopify/sync-orders/YOUR_STORE_ID \
     -H "Content-Type: application/json" \
     -d '{"limit": 10}'
   ```

5. **Get store stats:**
   ```bash
   curl http://localhost:3000/api/shopify/stats/YOUR_STORE_ID
   ```

### Using the Setup Script

If you want to create a new store programmatically:

```bash
# First, get your workspace ID
curl http://localhost:3000/api/stores

# Then create a new Shopify store
curl -X POST http://localhost:3000/api/shopify/stores \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "your-workspace-id",
    "name": "My Shopify Store",
    "domain": "your-store.myshopify.com",
    "accessToken": "your-access-token"
  }'
```

## Step 5: Verify Data Sync

Check that your data has been synced:

1. **Products:** Check the `products` table in your database
2. **Orders:** Check the `orders` table in your database
3. **Customers:** Check the `customers` table in your database

You can use Prisma Studio to view the data:

```bash
npm run db:studio
```

## Troubleshooting

### Common Issues

1. **"Store access token not found"**
   - Make sure you've set the `SHOPIFY_ACCESS_TOKEN` in your `.env` file
   - Verify the token is correct and hasn't expired

2. **"Store not found"**
   - Make sure you've created a store record in the database
   - Check that the store ID in the URL matches your store

3. **"API rate limit exceeded"**
   - Shopify has rate limits (2 requests per second for most endpoints)
   - The service includes automatic retry logic, but you may need to wait

4. **"Invalid API key"**
   - Verify your access token is correct
   - Make sure you have the necessary API scopes enabled

### Debug Mode

To see detailed logs, set the log level in your `.env`:

```bash
LOG_LEVEL=debug
```

## Next Steps

Once your Shopify integration is working:

1. **Set up webhooks** for real-time updates
2. **Configure AI agents** for product launches
3. **Set up analytics** and monitoring
4. **Test the full workflow** with real products

## Security Notes

- Never commit your Shopify access token to version control
- Use environment variables for all sensitive data
- Consider using Shopify's OAuth flow for production apps
- Regularly rotate your access tokens

## API Reference

For detailed API documentation, see the individual route files in `src/routes/shopifyRoutes.js`.
