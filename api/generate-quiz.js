module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'API key missing.' });
    }

    try {
        const { topic, numQuestions } = req.body;

        // 1. Strict Prompt for JSON
        const prompt = `Generate ${numQuestions} multiple-choice questions about "${topic}". 
        Return ONLY a JSON array. Each object MUST have: 
        "questionText", "options" (array of 4 strings), "correctAnswer", and "explanation".`;

        // 2. Updated Payload
        // We moved response_mime_type inside the configuration correctly
        const payload = {
            contents: [{ 
                parts: [{ text: prompt }] 
            }],
            generationConfig: {
                // This ensures the model only speaks JSON
                responseMimeType: "application/json"
            }
        };

        // 3. The "v1beta" endpoint is required for responseMimeType to work reliably in the free tier
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const geminiResult = await geminiResponse.json();

        if (geminiResponse.ok) {
            const content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (content) {
                // Parse the JSON string returned by Gemini
                const quizData = JSON.parse(content);
                return res.status(200).json(quizData);
            } else {
                return res.status(500).json({ error: 'AI returned no content' });
            }
        } else {
            // Detailed error logging
            console.error('Gemini API Error:', geminiResult);
            return res.status(geminiResponse.status).json({ 
                error: geminiResult.error?.message || 'Gemini API Error' 
            });
        }

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
