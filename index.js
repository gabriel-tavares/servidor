// index.js (backend otimizado com GPT-4o Vision e seleção de método heurístico)
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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-..."; // insira aqui se estiver testando localmente

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
    const prompt = carregarPrompt(metodo);

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
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${image}`,
                  detail: "low"
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
