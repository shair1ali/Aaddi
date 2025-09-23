import { FormData, Blob } from "node:buffer";

export const config = {
  api: {
    bodyParser: false, // disable default body parsing (important!)
  },
};

export default async function handler(req, res) {
  const BOT_TOKEN = process.env.BOT_TOKEN;

  try {
    // --- TEXT / LOCATION ---
    if (req.headers["content-type"]?.includes("application/json")) {
      const data = await new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => resolve(JSON.parse(body)));
        req.on("error", reject);
      });

      let url;
      if (data.type === "text") {
        url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      } else if (data.type === "location") {
        url = `https://api.telegram.org/bot${BOT_TOKEN}/sendLocation`;
      } else {
        return res.status(400).send("Invalid JSON type");
      }

      const tgRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      return res.status(200).send(await tgRes.text());
    }

    // --- PHOTO / AUDIO ---
    if (req.method === "POST") {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", async () => {
        const buffer = Buffer.concat(chunks);

        // Boundary نکالو
        const boundary = req.headers["content-type"].split("boundary=")[1];
        const rawParts = buffer.toString("binary").split(`--${boundary}`);

        let chat_id, type, fileBuffer, fileName;

        for (const part of rawParts) {
          if (part.includes('name="chat_id"')) {
            chat_id = part.split("\r\n\r\n")[1]?.trim();
          }
          if (part.includes('name="type"')) {
            type = part.split("\r\n\r\n")[1]?.trim();
          }
          if (part.includes("filename=")) {
            const match = part.match(/filename="(.+)"/);
            fileName = match ? match[1] : "file";
            const raw = part.split("\r\n\r\n")[1];
            if (raw) fileBuffer = Buffer.from(raw, "binary");
          }
        }

        if (!chat_id || !type || !fileBuffer) {
          return res.status(400).send("Invalid upload");
        }

        let url;
        if (type === "photo") {
          url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
        } else if (type === "audio") {
          url = `https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`;
        } else {
          return res.status(400).send("Invalid type");
        }

        const fd = new FormData();
        fd.append("chat_id", chat_id);
        fd.append(type, new Blob([fileBuffer]), fileName);

        const tgRes = await fetch(url, { method: "POST", body: fd });
        return res.status(200).send(await tgRes.text());
      });
    }
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy failed" });
  }
}
