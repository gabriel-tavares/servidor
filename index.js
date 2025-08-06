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

const HEADERS_CHAT = {
  "Authorization": `Bearer ${OPENAI_API_KEY}`,
  "Content-Type": "application/json"
};

const HEADERS_ASSISTANT = {
  ...HEADERS_CHAT,
  "OpenAI-Beta": "assistants=v2"
};

const modeloVision = "gpt-4o"; // ou gpt-4-vision-preview

app.post("/analisar", async (req, res) => {
  try {
    const { image, metodo  } = req.body;

    if (!image || !image.startsWith("data:image/png;base64,")) {
      return res.status(400).json({ error: "Imagem inválida ou mal formatada." });
    }

    // 1. Descrever a imagem com GPT-4 Vision
    const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: HEADERS_CHAT,
      body: JSON.stringify({
        model: modeloVision,
        messages: [
          {
            role: "system",
            content: "Você é um analista UX. Descreva de forma neutra o conteúdo visual da imagem como se fosse uma interface de aplicativo ou sistema."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "O que esta interface apresenta?"
              },
              {
                type: "image_url",
                image_url: {
                  url: image,
                  detail: "auto"
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.5
      })
    });

    const visionData = await visionResponse.json();
    const descricaoVisual = visionData.choices?.[0]?.message?.content;

    if (!descricaoVisual) {
      return res.status(500).json({ error: "Erro na análise visual", detalhe: visionData });
    }

    console.log("🧠 Descrição visual:", descricaoVisual);

    // 2. Criar thread do Assistant
    const threadResponse = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: HEADERS_ASSISTANT
    });

    const thread = await threadResponse.json();

    // 3. Enviar a descrição visual para o Assistant
    const mensagemParaAssistant = {
      role: "user",
      content: [
        {
          type: "text",
          text: `Analise a seguinte interface com base no modelo "${metodo}":

${descricaoVisual}

Responda no seguinte formato:
1 - Título
2 - Descrição
3 - Sugestão
4 - Justificativa
5 - Severidade: leve, moderada, crítica ou positiva.`
        }
      ]
    };

    await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: "POST",
      headers: HEADERS_ASSISTANT,
      body: JSON.stringify(mensagemParaAssistant)
    });

    // 4. Executar o Assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: "POST",
      headers: HEADERS_ASSISTANT,
      body: JSON.stringify({ assistant_id: ASSISTANT_ID })
    });

    const run = await runResponse.json();

    // 5. Aguardar execução
    let runStatus = run.status;
    while (runStatus === "queued" || runStatus === "in_progress") {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const statusCheck = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
        headers: HEADERS_ASSISTANT
      });
      const statusData = await statusCheck.json();
      runStatus = statusData.status;
    }

    // 6. Obter resposta
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      headers: HEADERS_ASSISTANT
    });

    const messagesData = await messagesResponse.json();

// Encontra a última mensagem do assistant com conteúdo
const ultimaMensagem = messagesData.data.reverse().find(
  (msg) => msg.role === "assistant" && msg.content?.[0]?.type === "text"
);

if (!ultimaMensagem) {
  return res.status(500).json({ error: "Nenhuma resposta do assistant encontrada." });
}

let respostaFinal;
try {
  const raw = ultimaMensagem.content?.[0]?.text?.value || "[]";
  respostaFinal = JSON.parse(raw);
} catch (e) {
  console.error("Erro ao fazer parse do JSON:", e);
  if (!res.headersSent) {
    return res.status(500).json({ error: "Resposta da IA não está em formato JSON válido." });
  }
}

// Se houver citações (file_citations), busque nomes dos arquivos
const citations = ultimaMensagem.content?.[0]?.text?.annotations?.filter(a => a.type === "file_citation") || [];
const referencias: string[] = [];

for (const citation of citations) {
  const fileId = citation.file_citation?.file_id;
  if (fileId) {
    const fileResponse = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      headers: HEADERS_ASSISTANT
    });
    const fileData = await fileResponse.json();
    if (fileData?.filename) {
      referencias.push(`📚 Fonte: ${fileData.filename}`);
    }
  }
}

if (!res.headersSent) {
  res.json({ resposta: respostaFinal, referencias });
}


app.get("/", (req, res) => {
  res.send("✅ Backend com GPT-4 Vision + Assistant v2 rodando!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
