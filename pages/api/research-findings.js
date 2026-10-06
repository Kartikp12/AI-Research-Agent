export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }
  
    try {
      const { question, researchResults } = req.body;
  
      if (!question || !question.trim()) {
        return res.status(400).json({
          error: "Research question is required",
        });
      }
  
      if (!Array.isArray(researchResults) || !researchResults.length) {
        return res.status(400).json({
          error: "Research results are required",
        });
      }
  
      const findings = [];
  
      // --------------------------------------------------
      // Process each research sub-question
      // --------------------------------------------------
  
      for (const researchItem of researchResults) {
        const subQuestion = researchItem.subQuestion;
        const sources = Array.isArray(researchItem.sources)
          ? researchItem.sources
          : [];
  
        if (!subQuestion || !sources.length) {
          continue;
        }
  
        // --------------------------------------------------
        // 1. Build source context
        // --------------------------------------------------
  
        const sourceContext = sources
          .slice(0, 3)
          .map((source) => {
            return `
  SOURCE [${source.id}]
  Title: ${source.title}
  
  Content:
  ${source.content?.slice(0, 700) || ""}
  `;
          })
          .join("\n-----------------\n");
  
        // --------------------------------------------------
        // 2. Extract claims and evidence
        // --------------------------------------------------
  
        const extractionPrompt = `
  You are an evidence extraction system.
  
  Research sub-question:
  ${subQuestion}
  
  Sources:
  ${sourceContext}
  
  Extract up to 2 important factual claims that directly help answer the research sub-question.
  
  Rules:
  - Use ONLY the provided sources.
  - Do not use outside knowledge.
  - Do not invent facts.
  - Maximum 2 claims.
  - Keep each claim under 20 words.
  - Keep each evidence under 30 words.
  - sourceId must identify the source supporting the claim.
  - Return ONLY valid JSON.
  
  Required JSON:
  {
    "claims": [
      {
        "claim": "short factual claim",
        "evidence": "supporting evidence from source",
        "sourceId": 1
      }
    ]
  }
  `;
  
        const extractionResponse = await fetch(
          "http://127.0.0.1:11434/api/generate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "qwen3:4b",
              prompt: extractionPrompt,
              stream: false,
              format: "json",
              think: false,
              options: {
                num_predict: 140,
              },
            }),
          }
        );
  
        if (!extractionResponse.ok) {
          const errorText = await extractionResponse.text();
  
          return res.status(500).json({
            error: "Evidence extraction failed",
            details: errorText,
          });
        }
  
        const extractionData = await extractionResponse.json();
  
        let extracted;
  
        try {
          extracted = JSON.parse(extractionData.response);
        } catch (error) {
          console.error(
            "Invalid extraction JSON:",
            extractionData.response
          );
  
          return res.status(500).json({
            error: "Invalid extraction JSON",
            rawResponse: extractionData.response,
          });
        }
  
        const claims = Array.isArray(extracted.claims)
          ? extracted.claims
          : [];
  
        // --------------------------------------------------
        // 3. Verify extracted claims
        // --------------------------------------------------
  
        const verifiedClaims = [];
  
        for (const claimItem of claims) {
          const source = sources.find(
            (item) => item.id === claimItem.sourceId
          );
  
          if (!source) {
            verifiedClaims.push({
              ...claimItem,
              verification: {
                status: "unsupported",
                reason: "Referenced source was not found",
              },
            });
  
            continue;
          }
  
          const verificationPrompt = `
  You are an evidence verification system.
  
  Research sub-question:
  ${subQuestion}
  
  Claim:
  ${claimItem.claim}
  
  Extracted evidence:
  ${claimItem.evidence}
  
  Source content:
  ${source.content?.slice(0, 700) || ""}
  
  Determine whether the source content directly supports the claim.
  
  Allowed status values:
  - supported
  - partially_supported
  - unsupported
  
  Rules:
  - Use ONLY the provided source content.
  - Do not use outside knowledge.
  - Do not invent information.
  - Keep the reason short.
  - Return ONLY valid JSON.
  
  Required JSON:
  {
    "status": "supported",
    "reason": "short explanation"
  }
  `;
  
          const verificationResponse = await fetch(
            "http://127.0.0.1:11434/api/generate",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "qwen3:4b",
                prompt: verificationPrompt,
                stream: false,
                format: "json",
                think: false,
                options: {
                  num_predict: 100,
                },
              }),
            }
          );
  
          if (!verificationResponse.ok) {
            const errorText = await verificationResponse.text();
  
            return res.status(500).json({
              error: "Evidence verification failed",
              details: errorText,
            });
          }
  
          const verificationData =
            await verificationResponse.json();
  
          let verification;
  
          try {
            verification = JSON.parse(
              verificationData.response
            );
          } catch (error) {
            console.error(
              "Invalid verification JSON:",
              verificationData.response
            );
  
            return res.status(500).json({
              error: "Invalid verification JSON",
              rawResponse: verificationData.response,
            });
          }
  
          verifiedClaims.push({
            ...claimItem,
            source: {
              title: source.title,
              url: source.url,
            },
            verification: {
              status: verification.status || "unsupported",
              reason:
                verification.reason ||
                "No verification reason provided",
            },
          });
        }
  
        findings.push({
          subQuestion,
          claims: verifiedClaims,
        });
      }
  
      // --------------------------------------------------
      // 4. Final response
      // --------------------------------------------------
  
      return res.status(200).json({
        question,
        findings,
      });
    } catch (error) {
      console.error("Research findings error:", error);
  
      return res.status(500).json({
        error: "Research findings pipeline failed",
        details: error.message,
      });
    }
  }