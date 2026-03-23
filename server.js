import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is missing in your .env file.');
  process.exit(1);
}

if (!process.env.OPENAI_VECTOR_STORE_ID) {
  console.error('OPENAI_VECTOR_STORE_ID is missing in your .env file.');
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// CORS (allows your website to talk to this server)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.send('Chatbot server is running.');
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'A message is required.' });
    }

    console.log("USER:", message); // 👈 LOG USER MESSAGE

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
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

Your job is to answer guest questions clearly, briefly, and helpfully.

Rules:
- Use the vector store knowledge base to answer.
- If the answer is not clearly supported, say you are not certain and suggest the guest contacts the team directly.
- Never invent room availability, table availability, prices, opening times, policies, or menu details.
- Keep the tone warm, polished, and conversational.
- Do not use exclamation marks.
- Keep most replies under 120 words.
- Where useful, suggest the next best action such as calling, emailing, or visiting the booking page.`
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

    const answer =
      response.output_text?.trim() ||
      'Sorry, I could not generate a reply.';

    console.log("BOT:", answer); // 👈 LOG BOT RESPONSE

    return res.json({ answer });

  } catch (error) {
    console.error('Chat error:', error);

    if (error?.status === 429) {
      return res.status(429).json({
        error: 'The chat is temporarily unavailable. Please try again shortly.'
      });
    }

    return res.status(500).json({
      error: 'Something went wrong while generating the reply.'
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
