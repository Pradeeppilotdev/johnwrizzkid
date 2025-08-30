export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch global leaderboard from Monad Games ID site
    const upstream = await fetch('https://monad-games-id-site.vercel.app/api/leaderboard');
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Upstream leaderboard unavailable' });
    }
    const data = await upstream.json();
    // Normalize to a small shape for UI
    return res.status(200).json({
      top: data.top || data.top10 || [],
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Simple leaderboard API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch leaderboard data',
      message: error.message 
    });
  }
}

