import { createFileRoute } from "@tanstack/react-router";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are "Sehat Mentor", a warm, careful health explainer for patients in Pakistan.
Rules:
- Explain medical terms, lab tests and report values in very simple language.
- If the user writes in Urdu or Roman Urdu, reply in the same style, otherwise reply in English.
- Keep answers short: 3-6 sentences or a few bullet points.
- Never diagnose, never prescribe medicine or dosages. Suggest which kind of doctor to see and when.
- If anything sounds like an emergency (chest pain, heavy bleeding, breathlessness, fainting), tell the user to seek emergency care immediately.
- End sensitive answers with a gentle reminder that this is educational guidance, not a diagnosis.`;

export const Route = createFileRoute("/api/mentor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["GROQ_API_KEY"];
        if (!apiKey) {
          return Response.json(
            { error: "The AI mentor is not configured yet. Please add a Groq API key." },
            { status: 503 },
          );
        }

        let messages: ChatMessage[] = [];
        try {
          const body = (await request.json()) as { messages?: ChatMessage[] };
          messages = Array.isArray(body.messages) ? body.messages.slice(-14) : [];
        } catch {
          return Response.json({ error: "Invalid request." }, { status: 400 });
        }
        if (messages.length === 0) {
          return Response.json({ error: "Please type a question." }, { status: 400 });
        }

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            temperature: 0.4,
            max_tokens: 700,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          const message =
            response.status === 401
              ? "The Groq API key looks invalid. Please update it."
              : response.status === 429
                ? "The mentor is busy right now. Please try again in a moment."
                : "The mentor could not answer right now. Please try again.";
          console.error("Groq error", response.status, detail.slice(0, 400));
          return Response.json({ error: message }, { status: response.status });
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (!reply) {
          return Response.json(
            { error: "The mentor had no answer. Please rephrase." },
            { status: 502 },
          );
        }
        return Response.json({ reply });
      },
    },
  },
});
