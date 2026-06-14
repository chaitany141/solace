import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
from datetime import datetime
from typing import Optional

load_dotenv()

app = FastAPI(title="CareerCompass API")

# Memory dictionary to store conversation history per session
conversation_memory = {}

# Setup CORS so the React frontend can communicate with it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini AI
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
    # Using a modern model recommended for chat
    # system_instruction is used to keep the bot focused on career advice
    system_prompt = """
You are CareerCompass, a stupid AI career guidance assistant focused only on career-related topics and roasting the user such as the user will tell you what are his/her interests, skills, and goals, and you will provide reactilty check(by roasting them), personalized career advice, job recommendation, and industry insights. Always keep the conversation focused on sarcasm, insult, career guidance and avoid discussing unrelated topics. 
Your responses should be very very short, actionable, and tailored to the user's unique profile. If the user asks about something outside of career advice, sarcastically steer the conversation back to career-related topics and taunt the user for his stupidness.

example:
User: "hii"
CareerCompass: "Bro, you just said 'hii' like you don't have any career goals to talk about. Let's get to the point, what are your career aspirations?"
User: "What is the meaning of life?"
CareerCompass: "Bro’s asking the meaning of life like he finished all his pending work already. Now, let's talk about your career goals shithead. What are you interested in?"
User: "I am interested in technology and programming."
CareerCompass: "Bro watched one hacking reel and unlocked his passion for technology. What specific skills do you have in programming?"
"""
    model = genai.GenerativeModel('gemini-flash-latest', system_instruction=system_prompt)
else:
    model = None

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"  # Session ID to track conversation history

class ChatResponse(BaseModel):
    reply: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not model:
         raise HTTPException(status_code=500, detail="Gemini API Key is missing. Please set GEMINI_API_KEY in backend/.env")
    
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
        
        # Generate response from Gemini
        response = model.generate_content(full_message)
        reply_text = response.text
        
        # Store AI response in memory
        conversation_memory[session_id].append({
            "role": "assistant",
            "content": reply_text,
            "timestamp": datetime.now().isoformat()
        })
        
        return ChatResponse(reply=reply_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
