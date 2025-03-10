require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');

// Set up Express app
const app = express();
app.use(bodyParser.json());

// OpenAI API setup
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

// Instagram API Credentials from environment variables
const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
const instagramBusinessId = process.env.INSTAGRAM_BUSINESS_ID;
const verifyToken = process.env.VERIFY_TOKEN;

// Webhook verification endpoint (Instagram verifies this when setting up)
app.get('/webhook', (req, res) => {
  const challenge = req.query['hub.challenge'];
  const token = req.query['hub.verify_token'];
  
  if (token === verifyToken) {
    return res.send(challenge);
  } else {
    return res.status(403).send('Verification token mismatch');
  }
});

// Webhook to handle incoming messages
app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log("Received data:", data);

  // Get messaging events from Instagram
  const messagingEvents = data.entry[0].messaging;

  for (const event of messagingEvents) {
    const senderId = event.sender.id;
    const messageText = event.message.text;

    // Process the incoming message
    let responseText = await processMessage(messageText);

    // Send the response to the user
    await sendInstagramMessage(senderId, responseText);
  }

  res.sendStatus(200); // Respond to Instagram with a 200 OK
});

// Function to send a message back to the user on Instagram
async function sendInstagramMessage(userId, message) {
  const url = `https://graph.facebook.com/v15.0/${instagramBusinessId}/messages`;
  const data = {
    recipient: { id: userId },
    message: { text: message },
  };

  try {
    const response = await axios.post(url, data, {
      params: {
        access_token: accessToken,
      },
    });
    console.log("Message sent successfully:", response.data);
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

// Function to process incoming messages
async function processMessage(message) {
  if (message.includes('price') || message.includes('available')) {
    const productName = "Product A"; // This can be dynamic based on the message content
    return await queryProductInfo(productName);
  } else {
    return await generateGPTResponse(message);
  }
}

// Function to query product info (Placeholder for actual stock data)
async function queryProductInfo(productName) {
  const stockInfo = {
    'Product A': { price: 100, available: true },
    'Product B': { price: 50, available: false },
  };

  if (stockInfo[productName]) {
    const product = stockInfo[productName];
    return product.available
      ? `The price of ${productName} is $${product.price}. It is available.`
      : `Sorry, ${productName} is out of stock.`;
  } else {
    return `Sorry, I couldn't find information for ${productName}.`;
  }
}

// Function to generate a response using OpenAI (GPT-4)
async function generateGPTResponse(message) {
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: message,
      max_tokens: 150,
    });

    return response.data.choices[0].text.trim();
  } catch (error) {
    console.error("Error with OpenAI API:", error);
    return "Sorry, I couldn't process your request at the moment.";
  }
}

// Start the Express server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
