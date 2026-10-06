export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }
  
    try {
      const { query } = req.body;
  
      if (!query || !query.trim()) {
        return res.status(400).json({
          error: "Search query is required",
        });
      }
  
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: query.trim(),
          search_depth: "basic",
          max_results: 5,
          include_answer: false,
        }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        return res.status(response.status).json({
          error: "Tavily search failed",
          details: data,
        });
      }
  
      return res.status(200).json({
        results: data.results || [],
      });
    } catch (error) {
      console.error("Search API error:", error);
  
      return res.status(500).json({
        error: "Something went wrong while searching",
        details: error.message,
      });
    }
  }