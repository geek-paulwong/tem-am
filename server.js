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

          // instructions: "Always respond in English, even if the user speaks another language.",

          instructions: `
            Always respond in English.
            If the user mentions "latest photos", call addPhotosToTop with 5 URLs.
          `,

          // 🔹 ADD THE TOOLS HERE
          // tools: [
          //   {
          //     type: "function",
          //     function: {
          //       name: "addPhotosToTop",
          //       description: "Adds photos on top of the PHOTOS grid",
          //       parameters: {
          //         type: "object",
          //         properties: {
          //           photos: { type: "array", items: { type: "string" } }
          //         },
          //         required: ["photos"]
          //       }
          //     }
          //   }
          // ],

          // 🔹 ADD THIS OBJECT TO FINE-TUNE VAD
          turn_detection: {
            type: "server_vad",
            threshold: 0.8,           // 🔹 lower = more sensitive to quiet speech
            prefix_padding_ms: 200,    // padding before speech is considered
            silence_duration_ms: 150,  // 🔹 shorter silence = faster turn detection
            create_response: true,
            interrupt_response: true
          }
        }),
      }
    );

    const data = await response.json();
    // 🔹 Full debug dump of the session response
    // console.log("[DEBUG] Full OpenAI session response:", JSON.stringify(data, null, 2));

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
    const response = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/sdp"
      },
      body: sdpOffer // raw SDP string
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[ERROR] OpenAI call failed:", response.status, text);
      return res.status(500).send(text);
    }

    const answerSdp = await response.text(); // <--- raw SDP
    res.type("application/sdp").send(answerSdp);

  } catch (err) {
    console.error("[ERROR] Failed to send offer to OpenAI:", err);
    res.status(500).send("Server error");
  }
});

app.listen(3000, () => console.log("[INFO] Server running at http://localhost:3000"));
