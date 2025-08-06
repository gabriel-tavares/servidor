const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(express.json({ limit: '10mb' }));
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

    // ✅ Log para garantir imagem válida
    console.log("🖼️ Imagem recebida:", image?.slice(0, 50), "...");

    // Criação do thread
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
      return res.status(500).json({ error: "Falha ao criar thread", detalhe: threadText });
    }

    // Mensagem simples para IA processar imagem
    const mensagem = "Analise a interface visual na imagem abaixo com base em heurísticas de usabilidade.";

    // Envio da mensagem + imagem
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        role: "user",
        content: [
          { type: "text", text: mensagem },
          {
            type: "image_url",
            image_url: {
              url: image,
              detail: "low"
            }
          }
        ]
      })
    });

    // Execução do assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ assistant_id: ASSISTANT_ID })
    });

    const run = await runResponse.json();

    // Aguardar execução
    let runStatus = run.status;
    while (runStatus === "queued" || runStatus === "in_progress") {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
        headers: HEADERS
      });
      const statusData = await statusResponse.json();
      runStatus = statusData.status;
    }

    // Buscar mensagens finais
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      headers: HEADERS
    });

    const messagesText = await messagesResponse.text();
    let messagesData;
    try {
      messagesData = JSON.parse(messagesText);
    } catch (err) {
      console.error("❌ Resposta de mensagens não é JSON:", messagesText);
      return res.status(500).json({ error: "Resposta inválida da OpenAI", detalhe: messagesText });
    }

    if (!messagesData.data || !Array.isArray(messagesData.data)) {
      console.error("❌ Erro de estrutura:", messagesData);
      return res.status(500).json({ error: "Estrutura inesperada da resposta", detalhe: messagesData });
    }

    const ultimaMensagem = messagesData.data.find(m => m.role === "assistant");

    if (!ultimaMensagem) {
      return res.status(500).json({ error: "Nenhuma resposta do assistant encontrada." });
    }

    const textoFinal = ultimaMensagem?.content?.[0]?.text?.value;

    if (!textoFinal) {
      return res.status(500).json({ error: "Resposta do assistant veio vazia ou malformada." });
    }

    res.json({ resposta: textoFinal });
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
