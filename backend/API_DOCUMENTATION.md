# Backend API Documentation

## Overview

The backend is a Flask REST API that provides learning assistance functionality. It uses a centralized step manager to track progress through lessons and a LangChain-based learning agent to generate contextual help messages based on screenshots and user queries.

**Base URL:** `http://localhost:5000`

---

## Core Components

### 1. Step Manager (`utils/step_manager.py`)
- **Purpose:** Centralized state management for tracking current lesson and step progress
- **Data Source:** Loads lesson data from `generated_course.json`
- **State:** In-memory, thread-safe state storage
- **Key Features:**
  - Tracks current `lesson_id` and `step_order`
  - Loads step information (name, description, finish_criteria)
  - Advances to next step automatically
  - Manages popup state

### 2. Learning Agent (`utils/learning_agent.py`)
- **Purpose:** AI-powered help message generation using LangChain
- **Model:** OpenAI GPT-4o (vision model)
- **Functionality:**
  - Analyzes screenshots
  - Generates contextual help tips based on user queries
  - Uses current step description as context

---

## API Endpoints

### Health & Status

#### `GET /`
**Description:** Root endpoint - server status

**Response:**
```json
{
  "message": "Flask backend is running!",
  "status": "success",
  "version": "1.0.0"
}
```

#### `GET /health`
**Description:** Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "service": "calhacks2025-backend"
}
```

---

### Step Management

#### `GET /api/current-step`
**Description:** Get the current step information

**Request:**
- Method: `GET`
- Query params: None

**Response (200):**
```json
{
  "status": "success",
  "lesson_id": 1,
  "step_order": 3,
  "step_info": {
    "name": "Step Name",
    "description": "Step description text",
    "finish_criteria": "Criteria for completing this step",
    "lesson_id": 1,
    "step_order": 3
  },
  "popup_sent": true
}
```

**Response (200) - No step set:**
```json
{
  "status": "success",
  "message": "No current step set",
  "lesson_id": null,
  "step_order": null
}
```

---

#### `POST /api/start-step`
**Description:** Initialize or set a step. Returns step description for display.

**Request:**
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body (all fields optional):
```json
{
  "lesson_id": 1,
  "step_order": 1
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Step initialized",
  "lesson_id": 1,
  "step_order": 1,
  "step_name": "Create a Figma Account",
  "step_description": "Go to www.figma.com, click 'Get started', enter your details, and complete a quick verification activity"
}
```

**Response (400) - Step not found:**
```json
{
  "status": "error",
  "message": "Step 1 not found for lesson 1"
}
```

**Notes:**
- If `lesson_id` or `step_order` not provided, uses current state or defaults (lesson_id=1, step_order=1)
- Marks popup as sent for the step
- Returns `step_description` in response for client to display

---

#### `POST /api/advance-step`
**Description:** Advance to the next step in the current lesson. Returns the new step information.

**Request:**
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body: `{}` (empty JSON object)

**Response (200) - Advanced:**
```json
{
  "status": "success",
  "message": "Advanced to next step",
  "lesson_id": 1,
  "step_order": 4,
  "step_info": {
    "name": "Next Step Name",
    "description": "Next step description text",
    "finish_criteria": "Criteria for completing this step",
    "lesson_id": 1,
    "step_order": 4
  }
}
```

**Response (200) - Lesson completed:**
```json
{
  "status": "success",
  "message": "Lesson completed!",
  "lesson_id": 1,
  "lesson_completed": true
}
```

**Response (400) - No current step:**
```json
{
  "status": "error",
  "message": "No current step to advance from"
}
```

**Notes:**
- Automatically increments `step_order` by 1
- Resets `popup_sent` flag for the new step
- Returns description of the step it moved to

---

### Screenshot & Help Generation

#### `POST /screenshot`
**Description:** Analyze screenshot and generate contextual help message

**Request:**
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "image": "base64_encoded_screenshot",
  "user_query": "optional user question",
  "lesson_id": "optional - overrides current step",
  "step_order": "optional - overrides current step"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Generated help message addressing the screenshot and query",
  "lesson_id": 1,
  "step_order": 3,
  "step_name": "Step Name"
}
```

**Response (400):**
```json
{
  "message": "No image data provided",
  "status": "error"
}
```

**Notes:**
- Uses current step from step_manager if `lesson_id`/`step_order` not provided
- Automatically initializes step if none is set
- Generates help message using LangChain learning agent

---

#### `POST /api/help-tip`
**Description:** Generate a help tip based on user's query and screenshot (requires user query)

**Request:**
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "image": "base64_encoded_screenshot",
  "user_query": "User's question or request for help",
  "lesson_id": "optional",
  "step_order": "optional"
}
```

**Response (200):**
```json
{
  "status": "success",
  "help_tip": "Generated help tip addressing the user's specific question",
  "user_query": "Where is the button?",
  "lesson_id": 1,
  "step_order": 3,
  "step_name": "Step Name",
  "step_description": "Step description text"
}
```

**Response (400):**
```json
{
  "message": "No user query provided",
  "status": "error"
}
```

**Notes:**
- `user_query` is required (unlike `/screenshot` where it's optional)
- Uses current step context from step_manager
- Generates contextual help that addresses the specific user question

---

### Lesson Plans

#### `POST /api/generate-lesson-plan`
**Description:** Generate and upload lesson plan to database

**Request:**
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "topic": "Lesson topic"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Successfully generated and uploaded 5 lessons",
  "generated_lesson_plan": [...]
}
```

---

#### `GET /api/lessons`
**Description:** Fetch all lessons with their steps from database

**Response (200):**
```json
{
  "status": "success",
  "count": 5,
  "lessons": [...]
}
```

---

### Utility Endpoints

#### `GET /api/test`
**Description:** Test endpoint to verify API is working

**Response:**
```json
{
  "message": "API is working!",
  "status": "success",
  "endpoint": "/api/test"
}
```

#### `GET /api/data`
**Description:** Get sample data

#### `POST /api/data`
**Description:** Create new data item

#### `GET /api/files`
**Description:** List files in project directory

#### `GET /api/insert-db`
**Description:** Test database insertion

---

### Media Endpoints

#### `POST /api/send-image`
**Description:** Handle image upload

#### `POST /api/display-output`
**Description:** Handle display output requests

---

## Data Structures

### Step Information
```json
{
  "name": "Step Name",
  "description": "Step description/instructions",
  "finish_criteria": "Criteria for completing this step",
  "lesson_id": 1,
  "step_order": 3
}
```

### Lesson Structure (from generated_course.json)
```json
{
  "lesson_id": 1,
  "name": "Lesson Name",
  "description": "Lesson description",
  "steps": [
    {
      "step_order": 1,
      "name": "Step Name",
      "description": "Step instructions",
      "finish_criteria": "Completion criteria",
      "figma_feature": "Feature name (optional)"
    }
  ]
}
```

---

## Step Manager API

The step manager provides the following methods:

### `get_current_step() -> Tuple[Optional[int], Optional[int]]`
Returns current `(lesson_id, step_order)` or `(None, None)` if not set.

### `set_current_step(lesson_id: int, step_order: int) -> bool`
Sets the current step explicitly.

### `advance_to_next_step() -> Tuple[Optional[int], Optional[int], bool]`
Advances to next step. Returns `(lesson_id, next_step_order, has_next)`.
- If `has_next` is `False` and `next_step_order` is `None`, lesson is completed.

### `get_step_info() -> Optional[Dict[str, Any]]`
Returns full step information including name, description, finish_criteria.

### `initialize(lesson_id: Optional[int], step_order: Optional[int]) -> Tuple[int, int]`
Initializes step using provided values, current state, or defaults.

### `mark_popup_sent() -> bool`
Marks that popup has been sent for current step.

### `has_popup_been_sent() -> bool`
Checks if popup has been sent for current step.

### `reset() -> bool`
Clears all step state.

---

## Learning Agent API

### `handle_screenshot(screenshot: str, step_description: str, user_query: str = "") -> str`
Analyzes screenshot and generates help message.

**Parameters:**
- `screenshot`: Base64 encoded image
- `step_description`: Description of current step
- `user_query`: Optional user question

**Returns:**
- Help message string addressing the user's query and screenshot

**Process:**
1. Creates LangChain chain with screenshot and step context
2. Uses GPT-4o vision model to analyze screenshot
3. Generates contextual help message (2-4 sentences)
4. Returns message as string

---

## State Management

### In-Memory State
- **Storage:** Thread-safe dictionary
- **Structure:** `{'lesson_id': int, 'step_order': int, 'popup_sent': bool}`
- **Persistence:** In-memory only (lost on server restart)
- **Scope:** Single-user (local app)

### Course Data
- **Source:** `backend/generated_course.json`
- **Format:** Array of lessons with steps
- **Loading:** Loaded once on startup, cached in memory
- **Field Mapping:**
  - `lesson_id` → lesson identifier
  - `step_order` → step number within lesson
  - `name` → step name
  - `description` → step instructions
  - `finish_criteria` → completion criteria

---

## Workflow Examples

### Starting a Lesson
```bash
# 1. Initialize step
POST /api/start-step
{
  "lesson_id": 1,
  "step_order": 1
}

# Response includes step_description to display to user
```

### Getting Help
```bash
# 2. User asks for help with screenshot
POST /api/help-tip
{
  "image": "base64...",
  "user_query": "Where is the submit button?"
}

# Returns contextual help tip
```

### Advancing Steps
```bash
# 3. When step is completed, advance
POST /api/advance-step
{}

# Returns next step information including description
```

### Checking Current Step
```bash
# 4. Check current progress
GET /api/current-step

# Returns current lesson_id, step_order, and full step info
```

---

## Error Handling

All endpoints return consistent error format:
```json
{
  "status": "error",
  "message": "Error description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad request (missing/invalid parameters)
- `500`: Internal server error

---

## Configuration

### Environment Variables
- `OPENAI_API_KEY`: Required for learning agent functionality
- `DEFAULT_LESSON_ID`: Default lesson ID (defaults to 1)

### File Dependencies
- `backend/generated_course.json`: Course data source
- Must be valid JSON with structure matching expected format

---

## Dependencies

### Python Packages
- `Flask`: Web framework
- `Flask-CORS`: CORS support
- `langchain`: LangChain framework
- `langchain-openai`: OpenAI integration
- `python-dotenv`: Environment variable management

### External Services
- **OpenAI API:** For vision analysis and help generation
- **Supabase:** (Optional) For lesson plan generation endpoint

---

## Notes

- All endpoints are REST-only (no WebSocket)
- Step state is managed centrally via `step_manager`
- Learning agent uses LangChain chain (not graph)
- Course data loaded from JSON file (not database)
- Single-user local app (no user_id needed)

