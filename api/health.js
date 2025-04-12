module.exports = (req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
    // Return a simple response
    res.status(200).json({ 
      status: 'ok',
      message: 'API is working',
      timestamp: new Date().toISOString()
    });
  };