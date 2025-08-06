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

    console.log("📤 Tamanho da imagem:", image.length);
    console.log("📤 Prefixo da imagem:", image.slice(0, 50));

    // 1. Criar thread
    const threadResponse = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: HEADERS
    });

    const thread = await threadResponse.json();

    // 2. Enviar mensagem só com a imagem (sem texto)
    const mensagemImagem = {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: image,
            detail: "auto"
          }
        }
      ]
    };

    await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(mensagemImagem)
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
      const statusCheck = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
        headers: HEADERS
      });
      const statusData = await statusCheck.json();
      runStatus = statusData.status;
    }

    // 5. Obter resposta da IA
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      headers: HEADERS
    });

    const messagesData = await messagesResponse.json();

    const ultimaMensagem = messagesData.data?.find(m => m.role === "assistant");
    const respostaFinal = ultimaMensagem?.content?.[0]?.text?.value;

    if (!respostaFinal) {
      return res.status(500).json({ error: "Nenhuma resposta encontrada da IA." });
    }

    res.json({ resposta: respostaFinal });
  } catch (error) {
    console.error("❌ Erro no backend:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Backend Assistant v2 com image_url funcionando!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
