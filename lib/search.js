export async function searchWeb(query) {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: 3,
        include_answer: false,
      }),
    });
  
    const data = await response.json();
  
    if (!response.ok) {
      throw new Error(
        data?.detail || data?.error || "Tavily search failed"
      );
    }
  
    return (data.results || []).map((result, index) => ({
      id: index + 1,
      title: result.title || "Untitled Source",
      url: result.url || "",
      content: result.content || "",
      relevanceScore: result.score || 0,
    }));
  }