const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

if (!OPENAI_API_KEY || !ASSISTANT_ID) {
  console.error("❌ OPENAI_API_KEY ou ASSISTANT_ID não definidos.");
  process.exit(1);
}

function carregarPrompt(metodo) {
  const arquivo = path.join(__dirname, "prompts", `${metodo}.txt`);
  try {
    return fs.readFileSync(arquivo, "utf-8");
  } catch (err) {
    console.warn(`⚠️ Prompt '${metodo}' não encontrado. Usando 'nielsen.txt' como fallback.`);
    return fs.readFileSync(path.join(__dirname, "prompts", "nielsen.txt"), "utf-8");
  }
}

app.post("/analisar", async (req, res) => {
  try {
    const { image, metodo } = req.body;

    console.log("🖼️ Tamanho da imagem recebida:", image.length);
    console.log("🖼️ Início da imagem:", image.slice(0, 50));

    const headers = {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2"
    };

    const threadResponse = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers
    });
    const thread = await threadResponse.json();

    const prompt = carregarPrompt(metodo);
    const instrucoesExtra = `
Você deve utilizar prioritariamente a base de conhecimento anexada ao assistente para realizar todo o raciocínio, análise e pesquisa necessárias à tarefa. 
Apenas no caso de não encontrar informações suficientes ou relevantes nessa base, estará autorizado a realizar pesquisas complementares na internet.
    `;
    const mensagem = `${prompt}\n\n${instrucoesExtra}`;

    await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        role: "user",
        content: [
          { type: "text", text: mensagem },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${image}`,
              detail: "low"
            }
          }
        ]
      })
    });

    const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ assistant_id: ASSISTANT_ID })
    });
    const run = await runResponse.json();

    let runStatus = run.status;
    while (runStatus === "queued" || runStatus === "in_progress") {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
        headers
      });
      const statusData = await statusResponse.json();
      runStatus = statusData.status;
    }

    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      headers
    });

    const messagesData = await messagesResponse.json();

    if (!messagesData.data || !Array.isArray(messagesData.data)) {
      console.error("❌ Erro na resposta da OpenAI:", messagesData);
      return res.status(500).json({
        error: "Erro ao recuperar resposta do assistant.",
        detalhe: messagesData
      });
    }

    const ultimaMensagem = messagesData.data.find(m => m.role === "assistant");

    if (!ultimaMensagem) {
      return res.status(500).json({ error: "Nenhuma resposta do assistant encontrada." });
    }

    const textoFinal = ultimaMensagem?.content?.[0]?.text?.value;

    if (!textoFinal) {
      return res.status(500).json({ error: "A resposta do assistant veio vazia ou malformada." });
    }
    
    res.json({ resposta: textoFinal });
  } catch (error) {
    console.error("Erro no backend:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Backend com Assistant OpenAI rodando com v2!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

