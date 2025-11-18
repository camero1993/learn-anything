import os
import sys
import base64
import logging

from flask import Flask, jsonify, request
from flask_cors import CORS
from utils.learning_agent import handle_screenshot
from utils.database_context import db_context
from utils.step_manager import step_manager

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
CORS(app)  # Allow React to make requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import routes
from routes import api_routes
from routes.lesson_plans import lesson_plans_bp
from routes.media_routes import media_bp
from routes.test_db import test_db_bp

# Register blueprints
app.register_blueprint(api_routes.bp)
app.register_blueprint(test_db_bp, url_prefix="/api")
app.register_blueprint(lesson_plans_bp, url_prefix='/api')
app.register_blueprint(media_bp, url_prefix='/api')

@app.route('/screenshot', methods=['POST'])
def screenshot():
    """
    Handle screenshot analysis with centralized step management.
    Uses step_manager to track current step and generate contextual help messages.
    """
    try:
        # Get the request data
        data = request.get_json()

        if not data or 'image' not in data:
            return jsonify({
                "message": "No image data provided",
                "status": "error"
            }), 400

        # Extract the base64 image data from the request
        base64_image = data['image']
        user_query = data.get('user_query', '')  # Optional user question

        # Optional: Log metadata if provided
        if 'metadata' in data:
            print(f"Screenshot metadata: {data['metadata']}")

        # Get current step from centralized step manager
        lesson_id, step_order = step_manager.get_current_step()
        
        # If no current step, initialize with defaults or provided values
        if lesson_id is None or step_order is None:
            provided_lesson_id = data.get('lesson_id')
            provided_step_order = data.get('step_order')
            lesson_id, step_order = step_manager.initialize(
                int(provided_lesson_id) if provided_lesson_id else None,
                int(provided_step_order) if provided_step_order else None
            )

        # Get step information
        step_info = step_manager.get_step_info()
        if not step_info:
            return jsonify({
                "message": f"Step {step_order} not found for lesson {lesson_id}",
                "status": "error"
            }), 400

        step_description = step_info.get('description', '')
        
        # Generate help message using the learning agent
        help_message = handle_screenshot(
            base64_image,
            step_description,
            user_query
        )

        return jsonify({
            "status": "success",
            "message": help_message,
            "lesson_id": lesson_id,
            "step_order": step_order,
            "step_name": step_info.get('name', '')
        })

    except Exception as e:
        logger.error(f"Error in screenshot endpoint: {e}")
        return jsonify({
            "message": f"Error processing screenshot: {str(e)}",
            "status": "error"
        }), 500

@app.route('/api/help-tip', methods=['POST'])
def get_help_tip():
    """
    Generate a help tip based on user's query and screenshot.
    Uses the current step context from step_manager.
    
    Expected JSON payload:
    {
        "image": "base64_encoded_screenshot",
        "user_query": "User's question or request for help"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "message": "No data provided",
                "status": "error"
            }), 400
        
        # Validate required fields
        if 'image' not in data:
            return jsonify({
                "message": "No image data provided",
                "status": "error"
            }), 400
        
        if 'user_query' not in data or not data.get('user_query', '').strip():
            return jsonify({
                "message": "No user query provided",
                "status": "error"
            }), 400
        
        # Extract data
        base64_image = data['image']
        user_query = data['user_query'].strip()
        conversation_history = data.get('conversation_history', []) # Extract conversation history
        
        # Get current step from centralized step manager
        lesson_id, step_order = step_manager.get_current_step()
        
        # If no current step, initialize with defaults or provided values
        if lesson_id is None or step_order is None:
            provided_lesson_id = data.get('lesson_id')
            provided_step_order = data.get('step_order')
            lesson_id, step_order = step_manager.initialize(
                int(provided_lesson_id) if provided_lesson_id else None,
                int(provided_step_order) if provided_step_order else None
            )
        
        # Get step information
        step_info = step_manager.get_step_info()
        if not step_info:
            return jsonify({
                "message": f"Step {step_order} not found for lesson {lesson_id}",
                "status": "error"
            }), 400
        
        step_description = step_info.get('description', '')
        
        # Generate help tip using the learning agent chain
        help_tip = handle_screenshot(
            base64_image,
            step_description,
            user_query,
            conversation_history # Pass history to the agent
        )
        
        return jsonify({
            "status": "success",
            "help_tip": help_tip,
            "user_query": user_query,
            "lesson_id": lesson_id,
            "step_order": step_order,
            "step_name": step_info.get('name', ''),
            "step_description": step_description
        })
        
    except Exception as e:
        logger.error(f"Error in get_help_tip endpoint: {e}")
        return jsonify({
            "message": f"Error generating help tip: {str(e)}",
            "status": "error"
        }), 500

@app.route('/')
def index():
    return jsonify({
        "message": "Flask backend is running!",
        "status": "success",
        "version": "1.0.0"
    })

@app.route('/health')
def health():
    return jsonify({
        "status": "healthy",
        "service": "calhacks2025-backend"
    })

## Step Management Endpoints

@app.route('/api/current-step', methods=['GET'])
def get_current_step():
    """
    Get the current step information.
    """
    try:
        lesson_id, step_order = step_manager.get_current_step()
        
        if lesson_id is None or step_order is None:
            return jsonify({
                "status": "success",
                "message": "No current step set",
                "lesson_id": None,
                "step_order": None
            })
        
        step_info = step_manager.get_step_info()
        
        return jsonify({
            "status": "success",
            "lesson_id": lesson_id,
            "step_order": step_order,
            "step_info": step_info,
            "popup_sent": step_manager.has_popup_been_sent()
        })
    except Exception as e:
        logger.error(f"Error in get_current_step: {e}")
        return jsonify({
            "status": "error",
            "message": f"Failed to get current step: {str(e)}"
        }), 500

@app.route('/api/advance-step', methods=['POST'])
def advance_step():
    """
    Advance to the next step in the current lesson.
    """
    try:
        lesson_id, next_step_order, has_next = step_manager.advance_to_next_step()
        
        if not has_next:
            if next_step_order is None and lesson_id:
                # Lesson completed
                return jsonify({
                    "status": "success",
                    "message": "Lesson completed!",
                    "lesson_id": lesson_id,
                    "lesson_completed": True
                })
            else:
                # No current step
                return jsonify({
                    "status": "error",
                    "message": "No current step to advance from"
                }), 400
        
        # Get new step info
        step_info = step_manager.get_step_info()
        
        return jsonify({
            "status": "success",
            "message": "Advanced to next step",
            "lesson_id": lesson_id,
            "step_order": next_step_order,
            "step_info": step_info
        })
    except Exception as e:
        logger.error(f"Error in advance_step: {e}")
        return jsonify({
            "status": "error",
            "message": f"Failed to advance step: {str(e)}"
        }), 500

@app.route('/api/previous-step', methods=['POST'])
def previous_step():
    """
    Go to the previous step in the current lesson.
    """
    try:
        lesson_id, previous_step_order, has_previous = step_manager.go_to_previous_step()
        
        if not has_previous:
            if previous_step_order is None and lesson_id:
                # Already at first step
                return jsonify({
                    "status": "success",
                    "message": "Already at first step of lesson",
                    "lesson_id": lesson_id,
                    "at_first_step": True
                })
            else:
                # No current step
                return jsonify({
                    "status": "error",
                    "message": "No current step to go back from"
                }), 400
        
        # Get new step info
        step_info = step_manager.get_step_info()
        
        return jsonify({
            "status": "success",
            "message": "Went back to previous step",
            "lesson_id": lesson_id,
            "step_order": previous_step_order,
            "step_info": step_info
        })
    except Exception as e:
        logger.error(f"Error in previous_step: {e}")
        return jsonify({
            "status": "error",
            "message": f"Failed to go to previous step: {str(e)}"
        }), 500

# Explicit start endpoint to trigger popup and set state before first screenshot
@app.route('/api/start-step', methods=['POST'])
def start_step():
    """
    Initialize or set a step. Uses centralized step manager.
    """
    try:
        data = request.get_json(silent=True) or {}
        lesson_id = data.get('lesson_id')
        step_order = data.get('step_order')

        # Initialize step using step manager
        final_lesson_id, final_step_order = step_manager.initialize(
            int(lesson_id) if lesson_id else None,
            int(step_order) if step_order else None
        )

        # Get step information
        step_info = step_manager.get_step_info()
        if not step_info:
            return jsonify({
                "status": "error",
                "message": f"Step {final_step_order} not found for lesson {final_lesson_id}"
            }), 400

        step_description = step_info.get('description', '')
        
        # Mark popup as sent
        step_manager.mark_popup_sent()

        return jsonify({
            "status": "success",
            "message": "Step initialized",
            "lesson_id": final_lesson_id,
            "step_order": final_step_order,
            "step_name": step_info.get('name', ''),
            "step_description": step_description
        })
    except Exception as e:
        logger.error(f"Error in start_step: {e}")
        return jsonify({
            "status": "error",
            "message": f"Failed to start step: {str(e)}"
        }), 500



if __name__ == '__main__':
    print("Starting Flask backend...")
    print("Backend will be available at: http://localhost:5000")
    app.run(debug=True, port=5000, host='127.0.0.1')
