const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize WhatsApp Client with LocalAuth to save session
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox']
    }
});

let isReady = false;

// Generate QR Code
client.on('qr', (qr) => {
    console.log('\n======================================================');
    console.log('>>> SCAN THIS QR CODE WITH YOUR WHATSAPP TO LOGIN <<<');
    console.log('======================================================\n');
    qrcode.generate(qr, { small: true });
});

// Client is ready
client.on('ready', () => {
    console.log('\n======================================================');
    console.log('>>> WHATSAPP CLIENT IS READY! YOU CAN SEND MESSAGES <<<');
    console.log('======================================================\n');
    isReady = true;
});

// Listen for disconnections
client.on('disconnected', (reason) => {
    console.log('WhatsApp Client disconnected:', reason);
    isReady = false;
});

// Start the client
console.log('Initializing WhatsApp Client...');
client.initialize();

// REST API ENDPOINT FOR PYTHON BACKEND
app.post('/api/sendText', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: "WhatsApp Client is not ready yet." });
        }

        const { chatId, text } = req.body;
        
        if (!chatId || !text) {
            return res.status(400).json({ success: false, error: "Missing 'chatId' or 'text' in request body." });
        }

        console.log(`Sending message to ${chatId}: ${text}`);
        
        // Send message
        await client.sendMessage(chatId, text);
        
        return res.status(201).json({ success: true });

    } catch (error) {
        console.error('Failed to send message:', error);
        return res.status(500).json({ success: false, error: error.toString() });
    }
});

app.listen(PORT, () => {
    console.log(`Internal API server running on http://localhost:${PORT}`);
});
