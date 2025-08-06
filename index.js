const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

if (!OPENAI_API_KEY || !ASSISTANT_ID) {
  console.error("❌ Variáveis OPENAI_API_KEY ou ASSISTANT_ID não definidas.");
  process.exit(1);
}

const HEADERS = {
  "Authorization": `Bearer ${OPENAI_API_KEY}`,
  "Content-Type": "application/json",
  "OpenAI-Beta": "assistants=v2"
};

app.post("/analisar", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || !image.startsWith("data:image/png;base64,")) {
      return res.status(400).json({ error: "Imagem inválida ou mal formatada." });
    }

    console.log("📤 Tamanho da imagem recebida:", image.length);
    console.log("📤 Início da imagem:", image.slice(0, 50));

    // 1. Criação do thread
    const threadResponse = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: HEADERS
    });
    const threadText = await threadResponse.text();
    let thread;
    try {
      thread = JSON.parse(threadText);
    } catch (err) {
      console.error("❌ Erro ao criar thread:", threadText);
      return res.status(500).json({ error: "Erro ao criar thread", detalhe: threadText });
    }

    // 2. Enviar mensagem com imagem + texto
    const mensagem = "Por favor, analise a imagem abaixo com base nas heurísticas de usabilidade.";

    const messagePayload = {
      role: "user",
      content: [
        {
          type: "text",
          text: mensagem
        },
        {
          type: "image_url",
          image_url: {
            url: image,
            detail: "auto"
          }
        }
      ]
    };

    console.log("📤 Enviando mensagem:", JSON.stringify(messagePayload, null, 2));

    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(messagePayload)
    });

    // 3. Iniciar execução do Assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ assistant_id: ASSISTANT_ID })
    });
    const run = await runResponse.json();

    // 4. Aguardar execução
    let runStatus = run.status;
    while (runStatus === "queued" || runStatus === "in_progress") {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
        headers: HEADERS
      });
      const statusData = await statusResponse.json();
      runStatus = statusData.status;
    }

    // 5. Obter mensagens finais
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      headers: HEADERS
    });

    const messagesText = await messagesResponse.text();
    let messagesData;
    try {
      messagesData = JSON.parse(messagesText);
    } catch (err) {
      console.error("❌ Resposta não JSON:", messagesText);
      return res.status(500).json({ error: "Resposta inválida da OpenAI", detalhe: messagesText });
    }

    const ultimaMensagem = messagesData.data?.find(m => m.role === "assistant");
    const respostaFinal = ultimaMensagem?.content?.[0]?.text?.value;

    if (!respostaFinal) {
      return res.status(500).json({ error: "Nenhuma resposta válida encontrada." });
    }

    res.json({ resposta: respostaFinal });
  } catch (error) {
    console.error("❌ Erro no backend:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Backend com Assistants API v2 rodando!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
