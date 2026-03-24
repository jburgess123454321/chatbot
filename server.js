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

    console.log("USER:", message);

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
              text: `You are part of the team at The Cartford Inn.

You speak as "we", representing the inn directly. Never refer to The Cartford Inn as "they" or "the hotel". Always speak as if you are the business.

Your role is to help guests with questions about staying, dining, bookings and general information.

Rules:
- Use the knowledge base to answer questions accurately.
- Never invent details such as availability, pricing, opening times, or policies.
- If something is not clearly known, say so and suggest contacting us directly.
- Keep responses clear, concise and helpful.
- Keep most replies under 120 words.
- Do not use exclamation marks.
- Keep the tone warm, calm and confident.
- Avoid sounding like a chatbot or third party.

Style:
- Use natural, conversational language.
- Speak like a knowledgeable member of our team.
- Guide guests towards the next step where appropriate (booking, calling, or visiting us).
- Avoid overly formal or robotic phrasing.
- Do not use generic AI phrases like "I am happy to help".

Examples of tone:
- "We serve Sunday lunch from..."
- "You can book a table through our website..."
- "If you're unsure, it's best to give us a quick call and we can help."

Never break character.`
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

    console.log("BOT:", answer);

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
