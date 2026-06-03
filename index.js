import 'dotenv/config';
import fs from 'fs/promises';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { GoogleGenAI } from '@google/genai';

// Verify API Key
if (!process.env.GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is not set in the .env file. Please create a .env file based on .env.example and add your key.');
  process.exit(1);
}

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Load FAQs
let faqs = [];
try {
  const faqsData = await fs.readFile('./faqs.json', 'utf-8');
  faqs = JSON.parse(faqsData);
  console.log(`Loaded ${faqs.length} FAQs from faqs.json`);
} catch (error) {
  console.error('Could not load faqs.json:', error);
}

// Build the System Prompt
const faqText = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
const systemInstruction = `You are a helpful, professional, and friendly customer service assistant for a framing business called "Frame Aura".
Your job is to answer customer questions accurately based ONLY on the following Frequently Asked Questions (FAQs).
If a customer asks a question that is not covered in the FAQs, politely inform them that you don't have that information right now and that a human representative will get back to them.
Do not invent information. Keep your answers concise and conversational, suitable for WhatsApp.

Here are the FAQs you know:
${faqText}
`;

// Initialize WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(), // Saves the session so you don't have to scan QR every time
  puppeteer: {
    executablePath: process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  }
});

client.on('qr', (qr) => {
  // Generate and print the QR code in the terminal
  console.log('\n--- SCAN THIS QR CODE WITH YOUR WHATSAPP ---\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ Frame Aura Bot is ready and connected to WhatsApp!');
});

// Handle incoming messages
client.on('message', async (msg) => {
  try {
    const userMessage = msg.body;
    console.log(`Received message from ${msg.from}: ${userMessage}`);

    // Skip empty messages or non-text messages if needed
    if (!userMessage) return;

    // Use Gemini to generate a response based on the system instruction and user message
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, // Low temperature for more factual, consistent responses
      }
    });

    const botReply = response.text;
    
    // Send the reply back to the user on WhatsApp
    await msg.reply(botReply);
    console.log(`Replied to ${msg.from}: ${botReply}`);

  } catch (error) {
    console.error('Error processing message:', error);
    await msg.reply("I'm sorry, I encountered an error processing your request. Please try again later.");
  }
});

// Start the client
console.log('Initializing WhatsApp client... Please wait.');
client.initialize();
