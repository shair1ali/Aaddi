export default async function handler(req, res) {
  const BOT_TOKEN = process.env.BOT_TOKEN; // Vercel env variable میں سیٹ کریں
  let url = "";
  let formData;

  if (req.headers["content-type"]?.includes("application/json")) {
    const data = req.body;
    const chat_id = data.chat_id;

    if (data.type === "text") {
      url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      formData = { chat_id, text: data.text };
    } else if (data.type === "location") {
      url = `https://api.telegram.org/bot${BOT_TOKEN}/sendLocation`;
      formData = { chat_id, latitude: data.latitude, longitude: data.longitude };
    } else {
      return res.status(400).send("Invalid JSON type");
    }

    const tgRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    return res.status(200).send(await tgRes.text());
  }

  // File Uploads (photo/audio)
  if (req.method === "POST") {
    const busboy = await import("busboy");
    const bb = busboy.default({ headers: req.headers });
    let chat_id, type, fileBuffer, fileName;

    req.pipe(bb);

    bb.on("field", (name, val) => {
      if (name === "chat_id") chat_id = val;
      if (name === "type") type = val;
    });

    bb.on("file", (name, file, info) => {
      fileName = info.filename;
      const chunks = [];
      file.on("data", (d) => chunks.push(d));
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on("close", async () => {
      if (!chat_id || !type || !fileBuffer) {
        return res.status(400).send("Invalid upload");
      }

      if (type === "photo") {
        url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
      } else if (type === "audio") {
        url = `https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`;
      } else {
        return res.status(400).send("Invalid type");
      }

      const tgRes = await fetch(url, {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          fd.append("chat_id", chat_id);
          fd.append(type, new Blob([fileBuffer]), fileName);
          return fd;
        })(),
      });

      return res.status(200).send(await tgRes.text());
    });
  }
}