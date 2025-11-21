require("dotenv").config();
const { fetch } = require("undici");
const express = require("express");

const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();
app.use(express.static("public"));
app.use(express.json());

app.post("/session-webrtc", async (req, res) => {
  console.log("[DEBUG] Received request for new WebRTC session...");

  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions?protocol=webrtc",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview",
          voice: "verse",
        }),
      }
    );

    const data = await response.json();
    // 🔹 Full debug dump of the session response
    console.log("[DEBUG] Full OpenAI session response:", JSON.stringify(data, null, 2));

    // Remove the old webrtc_offer check
    if (!data.client_secret?.value) {
      console.error("[ERROR] Invalid session response from OpenAI!");
      return res.status(500).json({ error: "Invalid session response" });
    }

    res.json(data);
  } catch (err) {
    console.error("[ERROR] Failed to create session:", err);
    res.status(500).send("Failed");
  }
});

// Parse raw text bodies (for SDP)
app.use("/start-offer", express.text({ type: "*/*" }));

// 🔹 Add this AFTER your /session-webrtc route
app.post("/start-offer", async (req, res) => {
  try {
    const sdpOffer = req.body; // raw SDP string from frontend

    // 🔹 Get ephemeral client secret from /session-webrtc
    const sessionResponse = await fetch("http://localhost:3000/session-webrtc", { method: "POST" });
    const sessionData = await sessionResponse.json();
    const clientSecret = sessionData.client_secret.value;

    // Forward the SDP offer to OpenAI Realtime endpoint
    const response = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp"
      },
      body: sdpOffer
    });

    res.sendStatus(response.status); // forward status to frontend
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send offer to OpenAI" });
  }
});

app.listen(3000, () => console.log("[INFO] Server running at http://localhost:3000"));
