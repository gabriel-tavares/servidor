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
    const { html } = req.body;

    if (!html || typeof html !== "string" || html.length < 10) {
      return res.status(400).json({ error: "HTML inválido ou muito curto." });
    }

    console.log("📤 HTML recebido:", html.slice(0, 100), "...");

    // 1. Criar thread
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

    // 2. Enviar HTML como mensagem
    const mensagem = `
A seguir está a estrutura HTML de uma interface digital. 
Analise seu conteúdo com base nas heurísticas de usabilidade (como Nielsen, Shneiderman, etc).
Indique acertos e problemas usando a estrutura: 
1 - Título, 2 - Descrição, 3 - Sugestão, 4 - Justificativa, 5 - Severidade.

HTML:
${html}
`;

    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        role: "user",
        content: [
          {
            type: "text",
            text: mensagem
          }
        ]
      })
    });

    // 3. Iniciar execução do assistant
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
  res.send("✅ Backend com Assistants API v2 (HTML input) rodando!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
