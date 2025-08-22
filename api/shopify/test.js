export default function handler(req, res) {
    res.status(200).json({
        message: 'Shopify routes are working!',
        timestamp: new Date().toISOString()
    })
}