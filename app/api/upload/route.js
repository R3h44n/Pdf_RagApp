import { Pinecone } from "@pinecone-database/pinecone";
import { NextResponse } from "next/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

const index = pc.index('ragmodel');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req){
    const data = await req.formData();

    const file = data.get("file");
    const fileType = ["application/pdf"];

    if(!file){
        return {Message: "file cannot be uploaded"}
    }

    if(!fileType.includes(file.type)){
        return NextResponse.json({error: "file is not pdf"})
    }

    //loads the file
    const loader = new PDFLoader(file);

    //loads the file into document
    const docs = await loader.load();

    //breaks the pdf document into smaller pieces
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });
    const splitDocs = await splitter.splitDocuments(docs);
    const textChunks = splitDocs.map(doc => doc.pageContent);

    //Convert text of chunks to embeddings, so we can create vectrors
    const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: textChunks,
    });

    // Creating vectors, so we can upsert it to pinecone database
    const vectors = embedding.data.map((item, idx) => ({
        id: `${file.name}-${idx}`,
        values: item.embedding,
        metadata: {
        text: textChunks[idx],
        source: file.name,
        page: splitDocs[idx].metadata.loc?.pageNumber,
        },
    }));

    await index.upsert(vectors);
    
    return NextResponse.json({message: "uploaded", chunks: vectors.length})
};
