import os
import logging

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableLambda

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Global variable to hold the chat model instance
chat_model = None

def _initialize_chat():
    """Initializes the chat model if it hasn't been already."""
    global chat_model
    if chat_model is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set.")
        chat_model = ChatOpenAI(model="gpt-4o", openai_api_key=api_key)

def handle_screenshot(screenshot_base64, step_description, user_query, conversation_history=None):
    """
    Analyzes a screenshot with contextual information from the current step, user query,
    and conversation history, and returns a helpful message.
    """
    try:
        # Ensure the chat model is initialized
        _initialize_chat()

        if conversation_history is None:
            conversation_history = []

        # System prompt to guide the AI
        system_prompt = (
            "You are an expert AI assistant providing help for a software tutorial. "
            "Your goal is to guide the user through the current step by analyzing their screenshot, "
            "their question, and the conversation history. Provide a concise, friendly, and actionable response (2-4 sentences) "
            "that directly addresses their question and helps them complete the current step."
        )

        # Format the conversation history for the prompt
        formatted_history = "\n".join([f"{msg['sender'].capitalize()}: {msg['text']}" for msg in conversation_history])

        # Construct the full prompt
        prompt_content = [
            {"type": "text", "text": system_prompt},
            {"type": "text", "text": f"--- CURRENT STEP ---\n{step_description}"},
        ]

        if formatted_history:
            prompt_content.append({"type": "text", "text": f"--- CONVERSATION HISTORY ---\n{formatted_history}"})

        prompt_content.extend([
            {"type": "text", "text": f"--- USER'S QUESTION ---\n{user_query}"},
            {"type": "text", "text": "\n--- CURRENT SCREENSHOT ---"},
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{screenshot_base64}"
                },
            },
        ])

        # Create the message for the model
        message = HumanMessage(content=prompt_content)
        
        # Use the global chat_model instance
        response = chat_model.invoke([message])
        
        # Extract the content from the response
        if hasattr(response, 'content'):
            return response.content
        else:
            return "Sorry, I couldn't generate a response. Please try again."
    
    except Exception as e:
        print(f"Error invoking OpenAI model: {e}")
        return f"An error occurred while generating a response: {str(e)}"
