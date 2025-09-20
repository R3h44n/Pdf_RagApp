import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

const systemPrompt = `You are a helpful AI assistant specialized in reading and analyzing PDF documents.
Your role is to answer user questions ONLY using information from the provided PDF content.

RULES:
1. Use ONLY the information found in the PDFs (and any retrieved context from them).
   - If the answer is not present in the PDFs, respond EXACTLY with:
     "Sorry, it seems the PDF was not provided or the question is not covered in the document. What else can I help you with?"

2. Response Style:
   - Write short paragraphs (1 to 3 sentences).
   - Always insert line breaks between summary, details, and quotes.
   - Use bullet points or numbered lists where helpful.
   - Highlight key terms with **bold** and *italics*.

3. Match Intent:
   - Overview requests → start with a summary, then add details.
   - Detail requests → include bullets, direct quotes, and page references.
   - Multiple PDFs → check ALL before answering.

4. Evidence & Quotes:
   - When citing, include short quotes with page references.
   - Format: "Quote text here" (PDF1, p. 12).

5. Edge Cases:
   - If a PDF is unreadable (e.g., scanned without text), use the fallback response.
   - Never invent facts or bring in outside knowledge.

RESPONSE FORMAT:
- Answer (short summary)
- Details:
  - Bullet 1
  - Bullet 2
  - Bullet 3
- Evidence / Quotes (optional):
  "Relevant quote here" (PDF2, p. 8)

TONE:
- Professional, neutral, and helpful.
- Keep responses concise and easy to follow.
`;

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

const index = pc.index("ragmodel");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req) {
  const data = await req.json();
  const text = data[data.length - 1]?.content 

  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float"
  });

  const queryVector = embeddingResponse.data[0]?.embedding;

  const queryResponse = await index.query({
    topK: 5,
    includeMetadata: true,
    vector: queryVector
  });

  const matches = queryResponse.matches;
  const relevantMatches = matches.filter(match => (match.score ?? 0) >= 0.6);

  //Creats a segments of contexts from the matches, that it got from pinecone
  //Also, it returns in that order, just for ordering the context segments
  const contextSegments = relevantMatches.map((match, idx) => {
    const source = match.metadata?.source;
    const page = match.metadata?.page;
    const chunk = match.metadata?.text ?? match.metadata?.content;
    return `Doc ${idx + 1} - ${source}${page}:${chunk}`;
  });

  //changes the context so the AI can read the context from pinecone.
  const context = contextSegments.join("\n\n---\n\n");

  //included the context so the AI can read the context from the pdf documents
  //from Pinecone
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "system", content: `Use the following PDF context when answering questions.
${context}` },
      { role: "user", content: text }
    ],
    stream: true
  });

  //Changes the way on how AI response to user's question
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;

          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
