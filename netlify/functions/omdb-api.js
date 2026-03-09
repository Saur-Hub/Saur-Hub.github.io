const https = require('https');

function fetchOmdb(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', (chunk) => {
        data += chunk;
      });
      resp.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  try {
    const OMDB_API_KEY = process.env.OMDB_API_KEY;
    if (!OMDB_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OMDB API key not configured' })
      };
    }

    let search = null;
    let imdbId = null;

    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      search = params.s || null;
      imdbId = params.i || null;
    } else if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      search = body.searchQuery || body.s || null;
      imdbId = body.imdbID || body.i || null;
    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    if (!search && !imdbId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing query parameter: use s (search) or i (imdb id)' })
      };
    }

    const query = search
      ? `s=${encodeURIComponent(search)}`
      : `i=${encodeURIComponent(imdbId)}`;

    const data = await fetchOmdb(`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&${query}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
