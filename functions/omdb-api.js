// OMDB API proxy handler
exports.handler = async (event, context) => {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get search params from querystring
    const params = event.queryStringParameters;
    if (!params || (!params.i && !params.t && !params.s)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required search parameters' })
      };
    }

    // Build OMDB API URL
    const searchParams = new URLSearchParams({
      ...params,
      apikey: process.env.OMDB_API_KEY
    });
    
    const response = await fetch(`http://www.omdbapi.com/?${searchParams}`);
    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('OMDB API error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};