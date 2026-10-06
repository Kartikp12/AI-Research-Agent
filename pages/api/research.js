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
  
      const ollamaResponse = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen3:4b",
          prompt: question,
          stream: false,
        }),
      });
  
      if (!ollamaResponse.ok) {
        const errorText = await ollamaResponse.text();
  
        return res.status(500).json({
          error: "Ollama request failed",
          details: errorText,
        });
      }
  
      const data = await ollamaResponse.json();
  
      return res.status(200).json({
        answer: data.response,
      });
    } catch (error) {
      console.error("Research API error:", error);
  
      return res.status(500).json({
        error: "Something went wrong",
        details: error.message,
      });
    }
  }