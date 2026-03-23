import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// 🔑 Check API key
if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env');
  process.exit(1);
}

// 🔑 Check vector store
if (!process.env.OPENAI_VECTOR_STORE_ID) {
  console.error('Missing OPENAI_VECTOR_STORE_ID in .env');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔥 CHAT ENDPOINT
app.post('/api/chat', async (req, res) => {
  try {
    const message = req.body.message;

    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      tools: [
        {
          type: 'file_search',
          vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID]
        }
      ],
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: `You are the website assistant for The Cartford Inn.

Answer clearly, briefly, and helpfully.

Rules:
- Use the knowledge base
- If unsure, say you are not certain and suggest contacting the team
- Do not invent details
- Keep it concise and natural`
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: message
            }
          ]
        }
      ]
    });

    const reply =
      response.output_text ||
      'Sorry, I could not generate a reply.';

    res.json({ answer: reply });

  } catch (error) {
    console.error('Chat error:', error);

    res.status(500).json({
      error: 'Something went wrong'
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});