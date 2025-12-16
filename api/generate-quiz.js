/**
 * Vercel Serverless Function: api/generate-quiz.js
 * Model: gemini-1.5-flash-8b (Free Tier Optimized)
 */

module.exports = async (req, res) => {
    // 1. Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    }

    // 2. Check for the API Key in Environment Variables
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        console.error('SERVER ERROR: GEMINI_API_KEY is missing.');
        return res.status(500).json({ 
            error: 'Server configuration error. Please check environment variables.' 
        });
    }

    try {
        const { topic, numQuestions } = req.body;

        // 3. Simple validation of user input
        if (!topic || !numQuestions) {
            return res.status(400).json({ error: 'Missing topic or number of questions.' });
        }

        // 4. Construct the prompt for the AI
        const prompt = `Generate a JSON array containing ${numQuestions} multiple-choice questions about "${topic}". 
        Each object in the array must follow this exact structure:
        {
          "questionText": "The question string",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": "The exact string from the options array that is correct",
          "explanation": "A brief explanation of why the answer is correct"
        }
        Return ONLY the JSON array. Do not include introductory text.`;

        // 5. Setup the API request payload
        const payload = {
            contents: [{ 
                role: "user", 
                parts: [{ text: prompt }] 
            }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        };

        /**
         * 6. Use the V1 endpoint and the Flash-8B model.
         * Flash-8B is currently the best choice for free usage and high speed.
         */
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-8b:generateContent?key=${GEMINI_API_KEY}`;

        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const geminiResult = await geminiResponse.json();

        // 7. Handle Success or Failure from Google
        if (geminiResponse.ok) {
            let content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (content) {
                try {
                    /**
                     * Clean the response: sometimes the AI includes markdown backticks 
                     * like ```json ... ``` even when told not to.
                     */
                    const sanitizedJson = content.replace(/```json|```/g, "").trim();
                    const parsedData = JSON.parse(sanitizedJson);
                    
                    return res.status(200).json(parsedData);
                } catch (parseError) {
                    console.error('JSON Parse Error:', content);
                    return res.status(500).json({ error: 'AI returned invalid JSON format.' });
                }
            } else {
                return res.status(500).json({ error: 'AI returned an empty response.' });
            }
        } else {
            // Log the specific error from Google for debugging
            console.error('Google API Error Details:', geminiResult.error);
            return res.status(geminiResponse.status).json({ 
                error: geminiResult.error?.message || 'Error communicating with Gemini API' 
            });
        }

    } catch (error) {
        console.error('CRITICAL SERVER ERROR:', error);
        return res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
};
