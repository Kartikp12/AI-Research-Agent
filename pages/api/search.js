import { searchWeb } from "../../lib/search";

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

    const results = await searchWeb(query.trim());

    return res.status(200).json({
      results,
    });
  } catch (error) {
    console.error("Search API error:", error);

    return res.status(500).json({
      error: "Search failed",
      details: error.message,
    });
  }
}