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

    const APP_KEY = process.env.BETFAIR_APP_KEY;
    const VENDOR_USERNAME = process.env.BETFAIR_VENDOR_USERNAME;
    const VENDOR_PASSWORD = process.env.BETFAIR_VENDOR_PASSWORD;
    const VENDOR_ID = process.env.BETFAIR_CLIENT_ID;
    const VENDOR_SECRET = process.env.BETFAIR_CLIENT_SECRET;

    // Log env presence (no secrets)
    console.log("[proxy] ENV — APP_KEY present:", !!APP_KEY);
    console.log("[proxy] ENV — VENDOR_USERNAME present:", !!VENDOR_USERNAME);
    console.log("[proxy] ENV — VENDOR_PASSWORD present:", !!VENDOR_PASSWORD);
    console.log("[proxy] ENV — CLIENT_ID present:", !!VENDOR_ID);
    console.log("[proxy] ENV — CLIENT_SECRET present:", !!VENDOR_SECRET);

    // Step 1: Vendor login to get session token
    console.log("[proxy] Step 1: Vendor login...");
    const loginBody = new URLSearchParams();
    loginBody.append("username", VENDOR_USERNAME);
    loginBody.append("password", VENDOR_PASSWORD);

    const loginHeaders = {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Application": APP_KEY,
    };
    console.log("[proxy] login headers:", JSON.stringify(loginHeaders));
    console.log("[proxy] login body:", `username=${VENDOR_USERNAME ? "(set)" : "(MISSING)"}&password=${VENDOR_PASSWORD ? "(set)" : "(MISSING)"}`);

    const loginRes = await fetch("https://identitysso.betfair.com/api/login", {
      method: "POST",
      headers: loginHeaders,
      body: loginBody.toString(),
    });

    const loginText = await loginRes.text();
    console.log("[proxy] vendor login status:", loginRes.status);
    console.log("[proxy] vendor login content-type:", loginRes.headers.get("content-type"));
    console.log("[proxy] vendor login raw (200):", loginText.substring(0, 200));

    let loginData;
    try {
      loginData = JSON.parse(loginText);
    } catch {
      return res.status(502).json({
        success: false,
        error: "Vendor login returned non-JSON",
        status: loginRes.status,
        preview: loginText.substring(0, 300),
      });
    }

    if (loginData.status !== "SUCCESS" || !loginData.token) {
      return res.status(401).json({
        success: false,
        error: `Vendor login failed: ${loginData.error || loginData.status}`,
      });
    }

    const vendorSession = loginData.token;
    console.log("[proxy] Vendor session obtained, token preview:", vendorSession.substring(0, 10));

    // Step 2: Exchange auth code for user access token
    console.log("[proxy] Step 2: Token exchange...");
    const exchangeBody = {
      client_id: VENDOR_ID,
      grant_type: "AUTHORIZATION_CODE",
      code,
      client_secret: VENDOR_SECRET,
    };

    const exchangeRes = await fetch(
      "https://api.betfair.com/exchange/account/rest/v1.0/token/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Application": APP_KEY,
          "X-Authentication": vendorSession,
        },
        body: JSON.stringify(exchangeBody),
      }
    );

    const exchangeText = await exchangeRes.text();
    console.log("[proxy] token exchange status:", exchangeRes.status);
    console.log("[proxy] token exchange content-type:", exchangeRes.headers.get("content-type"));
    console.log("[proxy] token exchange raw (300):", exchangeText.substring(0, 300));

    let exchangeData;
    try {
      exchangeData = JSON.parse(exchangeText);
    } catch {
      return res.status(502).json({
        success: false,
        error: "Token exchange returned non-JSON",
        status: exchangeRes.status,
        preview: exchangeText.substring(0, 300),
      });
    }

    // Extract token fields — Betfair may nest under result or return flat
    const access_token = exchangeData.access_token || exchangeData.result?.access_token || exchangeData.token;
    const token_type = exchangeData.token_type || exchangeData.result?.token_type || "BEARER";
    const refresh_token = exchangeData.refresh_token || exchangeData.result?.refresh_token || null;
    const expires_in = exchangeData.expires_in || exchangeData.result?.expires_in || null;

    console.log("[proxy] access_token present:", !!access_token);
    console.log("[proxy] token_type:", token_type);
    console.log("[proxy] refresh_token present:", !!refresh_token);
    if (access_token) {
      console.log("[proxy] token preview:", access_token.substring(0, 10));
    }

    if (!access_token) {
      return res.status(exchangeRes.status).json({
        success: false,
        error: exchangeData.error || "No access_token in exchange response",
        raw: exchangeData,
      });
    }

    res.json({ access_token, token_type, refresh_token, expires_in });
  } catch (error) {
    console.error("[proxy] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Betfair token proxy running on ${port}`);
});
