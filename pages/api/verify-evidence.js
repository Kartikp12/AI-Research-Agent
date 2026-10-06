export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }
  
    try {
      const { claim, evidence, source } = req.body;
  
      if (!claim || !evidence || !source) {
        return res.status(400).json({
          error: "Claim, evidence, and source are required",
        });
      }
  
      const prompt = `
  You are an evidence verification system.
  
  Claim:
  ${claim}
  
  Extracted evidence:
  ${evidence}
  
  Source content:
  ${source}
  
  Determine whether the source content directly supports the claim.
  
  Return ONLY valid JSON.
  
  Use exactly this format:
  
  {
    "status": "supported",
    "reason": "Short explanation"
  }
  
  Allowed status values:
  - supported
  - partially_supported
  - unsupported
  
  Rules:
  - Use ONLY the provided source content.
  - Do not use outside knowledge.
  - Do not invent information.
  - Keep the reason short.
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
            format: "json",
            think: false,
            options: {
              num_predict: 100,
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
  
      let verification;
  
      try {
        verification = JSON.parse(ollamaData.response);
      } catch (error) {
        console.error(
          "Invalid verification JSON:",
          ollamaData.response
        );
  
        return res.status(500).json({
          error: "Ollama returned invalid JSON",
        });
      }
  
      return res.status(200).json({
        claim,
        evidence,
        verification,
      });
    } catch (error) {
      console.error("Evidence verification error:", error);
  
      return res.status(500).json({
        error: "Evidence verification failed",
        details: error.message,
      });
    }
  }