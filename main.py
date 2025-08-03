from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain.chains import RetrievalQA, ConversationChain
from langchain.memory import ConversationBufferMemory
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.docstore.document import Document

import fitz 
import docx2txt
import io
import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vectorstore = None
memory = ConversationBufferMemory()
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def extract_text_from_pdf(contents: bytes) -> str:
    try:
        with fitz.open(stream=contents, filetype="pdf") as doc:
            return "\n".join([page.get_text() for page in doc])
    except Exception as e:
        logger.error("PDF extraction failed: %s", e)
        return ""

def extract_text_from_docx(contents: bytes) -> str:
    try:
        with io.BytesIO(contents) as f:
            return docx2txt.process(f)
    except Exception as e:
        logger.error("DOCX extraction failed: %s", e)
        return ""


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/chat")
async def chat(request: Request):
    global vectorstore, memory
    data = await request.json()
    message = data.get("message")
    use_doc_context = data.get("use_document_context", False)  

    logger.info("Received message: %s", message)
    logger.info("Use document context: %s", use_doc_context)

    try:
        if use_doc_context and vectorstore:
           
            qa = RetrievalQA.from_chain_type(
                llm=OllamaLLM(model="llama3"),
                chain_type="stuff",
                retriever=vectorstore.as_retriever(),
                memory=memory 
            )
            answer = qa.run(message)
        else:
            conversation = ConversationChain(
                llm=OllamaLLM(model="llama3"),
                memory=memory
            )
            answer = conversation.predict(input=message)

        return {"response": answer}

    except Exception as e:
        logger.error("Error during chat: %s", e)
        return {"response": "Something went wrong while processing your message."}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    global vectorstore

    try:
        contents = await file.read()
        filename = file.filename.lower()
        logger.info(f"Uploading file: {filename}, Size: {len(contents)} bytes")

        if len(contents) > MAX_FILE_SIZE:
            return {"response": "File too large. Please upload a file under 5MB."}

        if file.content_type not in [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain"
        ]:
            return {"response": "Invalid file type. Please upload a PDF, DOCX, or TXT file."}

        if filename.endswith(".pdf"):
            text = extract_text_from_pdf(contents)
        elif filename.endswith(".docx"):
            text = extract_text_from_docx(contents)
        elif filename.endswith(".txt"):
            text = contents.decode("utf-8")
        else:
            return {"response": "Unsupported file format."}

        if not text.strip():
            return {"response": "No text found in file."}

        
        docs = [Document(page_content=text, metadata={"source": filename})]
        splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=100)
        chunks = splitter.split_documents(docs)

        try:
            embeddings = OllamaEmbeddings(model="llama3")
        except Exception as e:
            logger.warning("Embedding model error, using fallback. Reason: %s", e)
            return {"response": "Embedding model not available. Please pull it with `ollama pull llama3`."}

        vectorstore = FAISS.from_documents(chunks, embeddings)

        return {"response": f"File '{file.filename}' uploaded and processed successfully!"}

    except Exception as e:
        logger.error("Upload failed: %s", e)
        return {"response": "Failed to process the uploaded file."}

@app.post("/api/clear")
async def clear_conversation():
    global memory
    memory.clear()
    return {"response": "Conversation history cleared."}