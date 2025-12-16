// api/generate-quiz.js
const fetch = require('node-fetch'); // Required for making HTTP requests in Node.js environments

// This is the main handler for your Vercel Serverless Function
module.exports = async (req, res) => {
    // Ensure the request method is POST, as expected by the frontend
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. Only POST requests are accepted.' });
    }

    // Get your Gemini API key from Vercel's environment variables.
    // This variable (GEMINI_API_KEY) must be configured in your Vercel project settings.
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // Check if the API key is provided. If not, return a server error.
    if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set in Vercel environment variables!');
        return res.status(500).json({ error: 'Server configuration error: API key missing. Please ensure GEMINI_API_KEY is set in Vercel project settings.' });
    }

    try {
        // Extract 'topic' and 'numQuestions' from the request body sent by your frontend.
        const { topic, numQuestions } = req.body;

        // Basic validation for required parameters
        if (!topic || !numQuestions) {
            return res.status(400).json({ error: 'Topic and number of questions are required in the request body.' });
        }

        // Construct the prompt string that will be sent to the Gemini API
        // Added instruction for explanation.
        const prompt = `Generate ${numQuestions} objective questions about "${topic}". Each question should have exactly 4 options (A, B, C, D), one correct answer, and a short, concise explanation for why the correct answer is correct. Provide the output as a JSON array of objects. Each object should have 'questionText', 'options' (an array of strings), 'correctAnswer' (the string of the correct option), and 'explanation' (a string explaining the correct answer). Ensure the options are clearly distinct and the question is clear. For example:
[
  {
    "questionText": "What is the capital of France?",
    "options": ["Berlin", "Madrid", "Paris", "Rome"],
    "correctAnswer": "Paris",
    "explanation": "Paris is the largest city and capital of France, known for its art, fashion, and culture."
  }
]`;

        // Define the payload structure required by the Gemini API
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            "questionText": { "type": "STRING" },
                            "options": { "type": "ARRAY", "items": { "type": "STRING" } },
                            "correctAnswer": { "type": "STRING" },
                            "explanation": { "type": "STRING" } // Added explanation to the schema
                        },
                        required: ["questionText", "options", "correctAnswer", "explanation"] // Mark explanation as required
                    }
                }
            }
        };

        // Construct the full URL for the Gemini API endpoint
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        // Make the actual HTTP POST request to the Gemini API
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Parse the JSON response received from the Gemini API
        const geminiResult = await geminiResponse.json();

        // Check if the response from Gemini was successful (HTTP status 2xx)
        if (geminiResponse.ok) {
            // Validate the structure of the Gemini API's response
            if (geminiResult.candidates && geminiResult.candidates.length > 0 &&
                geminiResult.candidates[0].content && geminiResult.candidates[0].content.parts &&
                geminiResult.candidates[0].content.parts.length > 0) {
                const jsonString = geminiResult.candidates[0].content.parts[0].text;
                // Parse the JSON string from Gemini and send it directly back to your frontend.
                // This assumes Gemini correctly returns a JSON array of questions.
                res.status(200).json(JSON.parse(jsonString));
            } else {
                // If Gemini's response structure is unexpected
                console.error('Gemini API returned an unexpected structure:', JSON.stringify(geminiResult));
                res.status(500).json({ error: 'No valid content found in Gemini API response or unexpected structure.' });
            }
        } else {
            // If Gemini API returns an error status (e.g., 400, 403, 500), forward its error message.
            console.error('Error from Gemini API:', geminiResult.error?.message || 'Unknown error');
            res.status(geminiResponse.status).json({ error: geminiResult.error?.message || 'Unknown Gemini API error' });
        }

    } catch (error) {
        // Catch any network or parsing errors that occur during the process
        console.error('Error in Vercel serverless function during quiz generation:', error);
        res.status(500).json({ error: 'Internal server error during quiz generation.' });
    }
};
