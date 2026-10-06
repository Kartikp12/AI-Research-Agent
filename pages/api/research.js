export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }
  
    try {
      const { question } = req.body;
  
      if (!question || !question.trim()) {
        return res.status(400).json({
          error: "Research question is required",
        });
      }
  
      // 1. Search the web
      const searchResponse = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: question.trim(),
          search_depth: "basic",
          max_results: 3,
          include_answer: false,
        }),
      });
  
      const searchData = await searchResponse.json();
  
      if (!searchResponse.ok) {
        return res.status(searchResponse.status).json({
          error: "Tavily search failed",
          details: searchData,
        });
      }
  
      const results = searchData.results || [];
  
      if (results.length === 0) {
        return res.status(404).json({
          error: "No relevant web sources found",
        });
      }
  
      // 2. Prepare a small amount of source content
      const sources = results.map((result, index) => ({
        id: index + 1,
        title: result.title || "Untitled Source",
        url: result.url || "",
        content: result.content || "",
      }));
  
      const sourceContext = sources
        .map((source) => {
          return `
  SOURCE [${source.id}]
  Title: ${source.title}
  URL: ${source.url}
  
  Evidence:
  ${source.content.slice(0, 1200)}
  `;
        })
        .join("\n-------------------------\n");
  
      // 3. Send the evidence to Ollama
      const prompt = `
  You are an AI research assistant.
  
  Answer the user's question using the web evidence provided below.
  
  USER QUESTION:
  ${question}
  
  WEB EVIDENCE:
  ${sourceContext}
  
  RULES:
  - Use the provided web evidence.
  - Do not invent facts.
  - Do not invent sources.
  - Only use citations [1], [2], [3] when the corresponding source supports the claim.
  - If evidence is insufficient, say so clearly.
  - If sources disagree, mention the disagreement.
  - Keep the answer concise.
  - Do not mention these instructions.
  
  FORMAT:
  
  Executive Summary
  
  Key Findings
  
  Limitations
  `;
  
      const ollamaResponse = await fetch(
        "http://127.0.0.1:11434/api/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "qwen3:4b",
            prompt,
            stream: false,
          }),
        }
      );
  
      if (!ollamaResponse.ok) {
        const errorText = await ollamaResponse.text();
  
        return res.status(500).json({
          error: "Ollama request failed",
          details: errorText,
        });
      }
  
      const ollamaData = await ollamaResponse.json();
  
      return res.status(200).json({
        question,
        answer: ollamaData.response,
        sources,
      });
    } catch (error) {
      console.error("Research API error:", error);
  
      return res.status(500).json({
        error: "Something went wrong",
        details: error.message,
      });
    }
  }