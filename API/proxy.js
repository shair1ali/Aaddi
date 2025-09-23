import { FormData, Blob } from "node:buffer";

export const config = { api: { bodyParser: false } };

export default async function handler(req,res){
  const BOT_TOKEN = process.env.BOT_TOKEN;

  try {
    // --- JSON (text/location)
    if(req.headers["content-type"]?.includes("application/json")){
      let body="";
      await new Promise((resolve,reject)=>{
        req.on("data",(c)=>body+=c);
        req.on("end",()=>resolve());
        req.on("error",reject);
      });
      const data=JSON.parse(body);

      let url="";
      if(data.type==="text") url=`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      else if(data.type==="location") url=`https://api.telegram.org/bot${BOT_TOKEN}/sendLocation`;
      else return res.status(400).send("Invalid JSON type");

      const tgRes=await fetch(url,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify(data)
      });
      return res.status(200).send(await tgRes.text());
    }

    // --- FILES (photo/voice)
    if(req.method==="POST"){
      const chunks=[];
      req.on("data",(chunk)=>chunks.push(chunk));
      req.on("end",async ()=>{
        const buffer=Buffer.concat(chunks);
        const boundary=req.headers["content-type"].split("boundary=")[1];
        const parts=buffer.toString("binary").split(`--${boundary}`);

        let chat_id,type,fileBuffer,fileName;
        for(const part of parts){
          if(part.includes('name="chat_id"')) chat_id=part.split("\r\n\r\n")[1]?.trim();
          if(part.includes('name="type"')) type=part.split("\r\n\r\n")[1]?.trim();
          if(part.includes("filename=")){
            const match=part.match(/filename="(.+)"/);
            fileName=match?match[1]:"file";
            const raw=part.split("\r\n\r\n")[1];
            if(raw) fileBuffer=Buffer.from(raw,"binary");
          }
        }

        if(!chat_id||!type||!fileBuffer) return res.status(400).send("Invalid upload");

        let url="";
        if(type==="photo") url=`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
        else if(type==="voice"||type==="audio") url=`https://api.telegram.org/bot${BOT_TOKEN}/sendVoice`;
        else return res.status(400).send("Invalid type");

        const fd=new FormData();
        fd.append("chat_id",chat_id);
        fd.append(type==="photo"?"photo":"voice", new Blob([fileBuffer]), fileName);

        const tgRes=await fetch(url,{method:"POST", body:fd});
        return res.status(200).send(await tgRes.text());
      });
    }
  } catch(err){
    console.error("Proxy error:",err);
    res.status(500).json({error:"Proxy failed"});
  }
}
