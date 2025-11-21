require("dotenv").config();
const express = require("express");

const app = express();
app.use(express.static("public"));
app.use(express.json());

app.post("/session-webrtc", async (req, res) => {
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
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed");
  }
});

app.listen(3000, () => console.log("Server running at http://localhost:3000"));
