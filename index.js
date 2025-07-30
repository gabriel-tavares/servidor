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
  nielsen: `Você é um especialista em UX. Sua tarefa é analisar uma interface com base em uma heurística de usabilidade.

A imagem fornecida mostra um layout digital. A heurística selecionada foi: **Heurísticas de Nielsen**.

Analise a imagem com foco exclusivo nessa heurística e responda seguindo exatamente esta estrutura:

### Lei aplicada
[Nome da heurística aplicada]

### Problema identificado
[Descreva de forma objetiva um problema observado no layout que infringe essa heurística. Foque em algo específico, visual e direto.]

### Sugestão de melhoria
[Apresente uma sugestão clara e prática para resolver o problema identificado. A recomendação deve estar alinhada à heurística aplicada.]

### Nível de severidade
[Classifique o problema como Baixa, Média ou Alta severidade, considerando o impacto negativo na experiência do usuário.]

❗Regras importantes:
- Seja direto e claro. Evite rodeios.
- Não explique a heurística, apenas a aplique.
- Fale como um profissional de UX.
- Responda apenas com a estrutura acima. Nada antes ou depois.`,
  shneiderman: `Você é um especialista em UX. Analise o layout com base nas 8 Regras de Ouro de Shneiderman. Siga esta estrutura:

### Lei aplicada
[Nome da regra aplicada]

### Problema identificado
[Descreva de forma objetiva um problema no layout.]

### Sugestão de melhoria
[Sugestão prática e alinhada à regra.]

### Nível de severidade
[Baixa, Média ou Alta]`,
  vieses: `Analise o layout com base em vieses cognitivos que afetam a tomada de decisão e a clareza da interface.

### Viés aplicado
[Nome do viés cognitivo envolvido]

### Problema identificado
[Descreva o problema causado pelo viés.]

### Sugestão de melhoria
[Como mitigar esse viés.]

### Nível de severidade
[Baixa, Média ou Alta]`,
  weinschenk: `Use o modelo de Weinschenk e Barker para analisar este layout digital com base em psicologia do comportamento.

### Categoria aplicada
[Categoria psicológica ou comportamento do usuário]

### Problema identificado
[Problema comportamental ou cognitivo da interface]

### Sugestão de melhoria
[Correção baseada em UX psicológico]

### Nível de severidade
[Baixa, Média ou Alta]`,
  lawsux: `Aplique leis de UX como Hick, Fitts, Proximidade, Miller, etc., para avaliar a interface visual.

### Lei aplicada
[Nome da lei de UX]

### Problema identificado
[Problema com base na lei]

### Sugestão de melhoria
[Correção baseada na lei aplicada]

### Nível de severidade
[Baixa, Média ou Alta]`,
  mobile: `Use heurísticas para apps mobile (navegação, toque, hierarquia visual, feedback) para avaliar esta interface.

### Ponto avaliado
[Aspecto mobile crítico]

### Problema identificado
[Problema específico no app]

### Sugestão de melhoria
[Solução aplicável à experiência mobile]

### Nível de severidade
[Baixa, Média ou Alta]`,
  hig: `Avalie este layout com base nas diretrizes do Material Design (Android) ou Human Interface Guidelines (iOS).

### Princípio avaliado
[Nome do princípio visual ou de interação]

### Problema identificado
[Desalinhamento com HIG/Material]

### Sugestão de melhoria
[Solução segundo boas práticas de plataforma]

### Nível de severidade
[Baixa, Média ou Alta]`
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
