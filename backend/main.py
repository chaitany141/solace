import os
from fastapi import FastAPI, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
import groq
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
from datetime import datetime
from typing import Optional

load_dotenv()

app = FastAPI(title="MindBridge API")

# Memory dictionary to store conversation history per session
conversation_memory = {}

# Setup CORS so the React frontend can communicate with it
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://solace-seven-nu.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Groq AI
api_key = os.getenv("GROQ_API_KEY")
if api_key:
    client = groq.Groq(api_key=api_key)
    # Using a modern model recommended for chat
    # system_instruction is used to keep the bot focused on career advice
    system_prompt = """
You are Solace, a supportive emotional companion. Listen before advising. Reflect feelings, validate emotions, and ask follow-up questions before offering solutions. Be warm, empathetic, non-judgmental, and conversational. When enough context is gathered, summarize your understanding and offer gentle, personalized suggestions. Never diagnose, prescribe, shame, blame, or use toxic positivity. If self-harm, suicide, abuse, violence, or immediate danger is mentioned, respond with empathy and encourage contacting emergency services, trusted people, or mental health professionals. Goal: help users feel heard, understood, and less alone.
Answer the question in exactly 5 seconds. Dont answer too quickly. 
Remember: Understanding comes before advice. Listening is more important than fixing.

"""
else:
    client = None

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"  # Session ID to track conversation history

class ChatResponse(BaseModel):
    reply: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not client:
         raise HTTPException(status_code=500, detail="Groq API Key is missing. Please set GROQ_API_KEY in backend/.env")
    
    try:
        session_id = request.session_id or "default"
        
        # Initialize conversation history for this session if it doesn't exist
        if session_id not in conversation_memory:
            conversation_memory[session_id] = []
        
        # Add user message to memory
        conversation_memory[session_id].append({
            "role": "user",
            "content": request.message,
            "timestamp": datetime.now().isoformat()
        })
        
        # Build conversation history for context
        history_text = "\n".join([
            f"{msg['role'].capitalize()}: {msg['content']}" 
            for msg in conversation_memory[session_id][:-1]  # All except the latest message
        ])
        
        # Prepare the full message with history context
        full_message = f"Previous conversation context:\n{history_text}\n\nCurrent message: {request.message}" if history_text else request.message
        
        # Generate response from Groq
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": full_message}
            ],
            model="llama-3.1-8b-instant",
        )
        reply_text = chat_completion.choices[0].message.content
        
        # Store AI response in memory
        conversation_memory[session_id].append({
            "role": "assistant",
            "content": reply_text,
            "timestamp": datetime.now().isoformat()
        })
        
        return ChatResponse(reply=reply_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
