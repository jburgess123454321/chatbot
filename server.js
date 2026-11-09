import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { notify } from './notify.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The assistant's rules and tone live in a plain text file so they can be edited without touching code
const instructions = fs.readFileSync(path.join(__dirname, 'Chatbot Instructions.txt'), 'utf8');

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

    // Private dining, celebration and Christmas party questions always get the enquiry form
    const wantsEnquiry = /private din|river house|christmas part|christmas do|work do|private (party|event|room|function|hire)|celebrat|birthday party|anniversary|gathering|exclusive use|function room/i.test(message) &&
      !/away day|meeting|delegate|conference|corporate|training|\broom\b|\bstay\b|\bnights?\b|lodge|table for/i.test(message);
    const systemText = wantsEnquiry
      ? instructions + '\n\nFOR THIS MESSAGE: the private dining enquiry form will be shown automatically under your reply. Mention it once ("pop your details in the form below"). Do not ask whether to show it and do not add any tag.'
      : instructions;

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
              text: systemText
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

    let answer =
      response.output_text?.trim() ||
      'Sorry, I could not generate a reply.';
    answer = answer.replace(/\s*【[^】]*】/g, '').replace(/\s+([.,])/g, '$1'); // remove file search source tags
    answer = answer.replace(/\s*—\s*/g, ', '); // house style: no em dashes

    // [[BOOKING]] / [[BOOKING:package]] asks the chat window for its room date picker,
    // [[TABLE]] / [[TABLE:tea]] for its table picker, and [[ENQUIRY]] for the private dining form
    let booking = null;
    let table = null;
    let enquiry = null;
    const bookingTag = answer.match(/\[\[\s*BOOKING(?:\s*:\s*([a-z0-9]+))?\s*\]\]/i);
    const tableTag = answer.match(/\[\[\s*TABLE(?:\s*:\s*([a-z0-9]+))?\s*\]\]/i);
    const enquiryTag = answer.match(/\[\[\s*ENQUIRY\s*\]\]/i);
    if (bookingTag) booking = { package: (bookingTag[1] || 'room').toLowerCase() };
    else if (tableTag) table = { kind: (tableTag[1] || 'table').toLowerCase() };
    else if (enquiryTag || wantsEnquiry) enquiry = { type: 'private-dining' };
    if (enquiry) {
      // The form is already showing, so drop any line offering to show it
      answer = answer.replace(/[^.?!\n]*(would you like|shall i|do you want|let me know if you'?d like)[^.?!\n]*\b(form|add|show)\b[^.?!\n]*[?.]\s*/gi, '').trim();
    }
    if (bookingTag || tableTag || enquiryTag) {
      answer = answer.replace(/\s*\[\[[^\]]*\]\]/g, '').trim();
      // If the date picker is already mentioned, drop a repeated closing line about it
      const paragraphs = answer.split(/\n\s*\n/);
      if (paragraphs.length > 1 && /date picker/i.test(paragraphs[paragraphs.length - 1]) &&
          /date picker/i.test(paragraphs.slice(0, -1).join(' '))) {
        answer = paragraphs.slice(0, -1).join('\n\n');
      }
    }

    console.log("BOT:", answer, booking ? '(date picker: ' + booking.package + ')' : '', table ? '(table picker: ' + table.kind + ')' : '', enquiry ? '(enquiry form)' : '');
    notify(message, answer, req.get('referer'));

    return res.json({ answer, booking, table, enquiry });
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
