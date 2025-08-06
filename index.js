const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("❌ Variável OPENAI_API_KEY não definida.");
  process.exit(1);
}

const HEADERS = {
  "Authorization": `Bearer ${OPENAI_API_KEY}`,
  "Content-Type": "application/json"
};

const modelo = "gpt-4o"; // ou gpt-4 / gpt-3.5-turbo

app.post("/analisar", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || !image.startsWith("data:image/png;base64,")) {
      return res.status(400).json({ error: "Imagem inválida ou mal formatada." });
    }

    const mensagens = [
      {
        role: "system",
        content: "Você é um especialista em UX. Analise imagens de interfaces digitais com base nas heurísticas de Nielsen, Shneiderman e Gerhardt-Powals. Use o formato: 1 - Título, 2 - Descrição, 3 - Sugestão, 4 - Justificativa, 5 - Severidade."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analise a interface visual da imagem abaixo."
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
    ];

    const completionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        model: modelo,
        messages: mensagens,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const completionData = await completionResponse.json();

    if (!completionData.choices || !completionData.choices[0]) {
      return res.status(500).json({ error: "Resposta inesperada da OpenAI", detalhe: completionData });
    }

    const respostaFinal = completionData.choices[0].message.content;

    res.json({ resposta: respostaFinal });
  } catch (error) {
    console.error("❌ Erro no backend:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Backend usando /chat/completions com imagem inline!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
