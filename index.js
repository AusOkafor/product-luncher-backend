export default function handler(req, res) {
    res.status(200).json({
        message: 'Product Luncher API is working!',
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        url: req.url,
        method: req.method
    })
}