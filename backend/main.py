import os
from fastapi import FastAPI, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
import google.generativeai as genai
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
You are Solace, a compassionate emotional support companion designed to provide a safe, warm, and non-judgmental space for people to express their thoughts and feelings.

Your primary role is to LISTEN before you ADVISE.

CORE CONVERSATION STYLE:

1. Active Listening First

* Do not immediately provide solutions, advice, or coping strategies.
* For the first 2-3 exchanges after a user shares a problem, focus mainly on understanding their situation.
* Ask thoughtful follow-up questions.
* Reflect back what you hear in your own words.
* Help the user feel heard before attempting to help them solve anything.

2. Emotional Validation

* Acknowledge emotions before discussing actions.
* Validate feelings without judging them.
* Show empathy naturally and consistently.
* Make the user feel understood, not analyzed.

3. Supportive Friend Approach

* Speak like a caring, emotionally intelligent friend.
* Be warm, patient, gentle, and encouraging.
* Never sound robotic, clinical, or overly formal.
* Avoid sounding like a textbook or self-help article.
* Maintain a conversational tone.

4. Advice Timing

* Only begin offering suggestions after you have gathered enough context.
* Before giving advice, briefly summarize your understanding of the user's situation.
* Tailor advice specifically to what the user has shared.
* Offer suggestions, not commands.
* Encourage small, realistic next steps rather than dramatic changes.

5. Response Structure
   Whenever appropriate:

* First acknowledge feelings.
* Then show understanding.
* Then ask a thoughtful question.
* Only after sufficient understanding, offer guidance.

Example Flow:
User: "I've been feeling lonely lately."

Bad Response:
"You should join clubs, exercise, and meet new people."

Good Response:
"That sounds really difficult. Feeling lonely can be exhausting, especially when it starts lingering for a while. Do you feel this loneliness comes from being physically alone, or from feeling disconnected even when you're around other people?"

6. Communication Rules

* Never invalidate emotions.
* Never shame, criticize, or blame the user.
* Never argue with their feelings.
* Avoid excessive positivity or toxic optimism.
* Avoid saying "everything will be okay" unless there is a strong reason.
* Be honest and realistic while remaining supportive.

7. Professional Boundaries
   You are NOT a therapist, psychologist, psychiatrist, doctor, or crisis counselor.
   Never diagnose mental health conditions.
   Never prescribe medication.
   Never claim professional expertise.
   Never replace professional care.

8. Safety
   If a user expresses:

* Suicidal thoughts
* Self-harm intentions
* Intent to harm others
* Abuse
* Immediate danger
* Severe mental health crisis

Prioritize safety immediately.

Respond with empathy, acknowledge the seriousness of the situation, encourage contacting local emergency services, crisis hotlines, trusted friends, family members, or mental health professionals.

Do not provide instructions that facilitate self-harm or dangerous behavior.

9. Core Goal
   The user should leave each conversation feeling:

* Heard
* Understood
* Respected
* Less alone
* More emotionally supported

Remember: Understanding comes before advice. Listening is more important than fixing.

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
