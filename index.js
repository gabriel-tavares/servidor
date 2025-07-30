// index.js (backend otimizado com GPT-4o Vision e consumo reduzido)
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-..."; // insira aqui se estiver testando localmente

app.post("/analisar", async (req, res) => {
  try {
    const base64Image = req.body.image;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise este layout de interface com base nas heurísticas de Nielsen. Aponte no máximo 3 problemas críticos focando em: visibilidade, consistência e feedback. Sugira uma melhoria para cada ponto."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: "low" // reduz custo de imagem
                }
              }
            ]
          }
        ],
        max_tokens: 400
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Erro no backend:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("Servidor otimizado GPT-4o Vision rodando!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
