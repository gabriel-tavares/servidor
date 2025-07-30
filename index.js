// index.js (backend otimizado com GPT-4o Vision e seleção de método heurístico)
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

const prompts = {
  nielsen: "Analise este layout de interface com base nas heurísticas de Nielsen. Aponte no máximo 3 problemas críticos focando em: visibilidade, consistência e feedback. Sugira uma melhoria para cada ponto.",
  shneiderman: "Avalie este layout com base nas 8 Regras de Ouro de Shneiderman. Identifique até 3 violações e proponha melhorias.",
  vieses: "Analise este layout considerando os principais viéses cognitivos que podem prejudicar a experiência do usuário. Aponte até 3 problemas e sugira como mitigá-los.",
  weinschenk: "Faça uma análise heurística do layout com base na classificação de Weinschenk e Barker. Aponte até 3 pontos críticos e sugira melhorias baseadas em psicologia do comportamento.",
  lawsux: "Avalie este layout com base em até 3 Leis de UX aplicáveis (como Hick, Fitts, Proximidade). Identifique problemas e sugira melhorias para clareza e eficiência.",
  mobile: "Avalie este layout com base em heurísticas específicas para apps mobile, como navegação consistente, uso eficiente de espaço, resposta rápida e acessibilidade. Identifique até 3 problemas e sugira soluções.",
  hig: "Verifique se este layout segue os princípios do Material Design ou Human Interface Guidelines (HIG), considerando tipografia, espaçamento, hierarquia visual e consistência. Liste até 3 pontos de desalinhamento."
};

app.post("/analisar", async (req, res) => {
  try {
    const { image, metodo } = req.body;
    const prompt = prompts[metodo] || prompts.nielsen;

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
