import { searchWeb } from "../../lib/search";

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

    // 1. Search web
    const sources = await searchWeb(question.trim());

    if (!sources.length) {
      return res.status(404).json({
        error: "No sources found",
      });
    }

    // 2. Keep only small snippets
    const sourceContext = sources
      .slice(0, 3)
      .map((source) => {
        return `
SOURCE [${source.id}]
Title: ${source.title}
URL: ${source.url}

Evidence:
${source.content.slice(0, 700)}
`;
      })
      .join("\n-----------------\n");

    // 3. Small Ollama prompt
    const prompt = `
Extract factual claims from these sources.

Question:
${question}

Sources:
${sourceContext}

Rules:
- Use ONLY the provided sources.
- Do not invent facts.
- Keep evidence short.
- Maximum 3 claims.
- Return ONLY valid JSON.

Format:
{
  "claims": [
    {
      "claim": "factual claim",
      "evidence": "short supporting evidence",
      "sourceId": 1
    }
  ]
}
`;

    // 4. Ollama
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
          format: "json",
          think: false,
          options: {
            num_predict: 150,
          },
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

    let evidence;

    try {
      evidence = JSON.parse(ollamaData.response);
    } catch (error) {
      console.error("Invalid JSON from Ollama:", ollamaData.response);

      return res.status(500).json({
        error: "Ollama returned invalid JSON",
      });
    }

    return res.status(200).json({
      question,
      claims: evidence.claims || [],
      sources,
    });
  } catch (error) {
    console.error("Evidence extraction error:", error);

    return res.status(500).json({
      error: "Evidence extraction failed",
      details: error.message,
    });
  }
}