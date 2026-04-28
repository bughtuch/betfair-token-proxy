import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
  origin: "https://www.tennistraderai.com"
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ ok: true, service: "betfair-token-proxy" });
});

app.post("/betfair-token", async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: "Missing code" });
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.BETFAIR_CLIENT_ID,
      client_secret: process.env.BETFAIR_CLIENT_SECRET
    });

    const response = await fetch("https://identitysso.betfair.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Betfair token proxy running on ${port}`);
});
