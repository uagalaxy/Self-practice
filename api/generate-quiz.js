// api/generate-quiz.js

// Note: 'node-fetch' is no longer required in Node.js 18+ (Vercel's default)
// as the 'fetch' API is now built-in.

module.exports = async (req, res) => {
    // 1. Validate Method
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. Only POST requests are accepted.' });
    }

    // 2. Validate API Key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is missing from environment variables.');
        return res.status(500).json({ 
            error: 'Server configuration error: API key missing.' 
        });
    }

    try {
        const { topic, numQuestions } = req.body;

        // 3. Validate Input
        if (!topic || !numQuestions) {
            return res.status(400).json({ error: 'Topic and number of questions are required.' });
        }

        // 4. Construct Prompt
        const prompt = `Generate ${numQuestions} objective questions about "${topic}". 
        Each question must have exactly 4 options (A, B, C, D), one correct answer, and a concise explanation. 
        Provide the output as a JSON array of objects.
        Structure:
        {
          "questionText": "string",
          "options": ["option1", "option2", "option3", "option4"],
          "correctAnswer": "the exact string of the correct option",
          "explanation": "string"
        }`;

        // 5. Define Payload & Correct Model Name
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                // The schema ensures the AI adheres strictly to your data format
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            "questionText": { "type": "STRING" },
                            "options": { "type": "ARRAY", "items": { "type": "STRING" } },
                            "correctAnswer": { "type": "STRING" },
                            "explanation": { "type": "STRING" }
                        },
                        required: ["questionText", "options", "correctAnswer", "explanation"]
                    }
                }
            }
        };

        // Corrected URL: Using gemini-1.5-flash
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-8b:generateContent?key=${GEMINI_API_KEY}`;

        // 6. Execute Request
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const geminiResult = await geminiResponse.json();

        // 7. Handle Response
        if (geminiResponse.ok) {
            const content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (content) {
                // Return the parsed JSON directly to the frontend
                return res.status(200).json(JSON.parse(content));
            } else {
                throw new Error('Gemini returned an empty response.');
            }
        } else {
            console.error('Gemini API Error:', geminiResult.error);
            return res.status(geminiResponse.status).json({ 
                error: geminiResult.error?.message || 'Gemini API Error' 
            });
        }

    } catch (error) {
        console.error('Internal Server Error:', error);
        return res.status(500).json({ error: 'Internal server error during quiz generation.' });
    }
};
