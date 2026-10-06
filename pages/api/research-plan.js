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
  
      const prompt = `
  You are a research planning system.
  
  User research question:
  ${question}
  
  Break this question into 2 to 5 focused research sub-questions.
  
  Rules:
  - Cover the important aspects of the original question.
  - Each sub-question should investigate a different aspect.
  - Keep questions concise.
  - Do not answer the questions.
  - Do not use outside knowledge.
  - Return ONLY valid JSON.
  
  Required format:
  {
    "subQuestions": [
      "question 1",
      "question 2",
      "question 3"
    ]
  }
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
              num_predict: 120,
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
  
      console.log(
        "Research planner response:",
        ollamaData.response
      );
  
      let plan;
  
      try {
        plan = JSON.parse(ollamaData.response);
      } catch (error) {
        console.error(
          "Invalid planner JSON:",
          ollamaData.response
        );
  
        return res.status(500).json({
          error: "Invalid planner JSON",
          rawResponse: ollamaData.response,
        });
      }
  
      const subQuestions = Array.isArray(plan.subQuestions)
        ? plan.subQuestions
        : [];
  
      if (!subQuestions.length) {
        return res.status(500).json({
          error: "Planner returned no sub-questions",
        });
      }
  
      return res.status(200).json({
        question,
        subQuestions,
      });
    } catch (error) {
      console.error("Research planner error:", error);
  
      return res.status(500).json({
        error: "Research planning failed",
        details: error.message,
      });
    }
  }