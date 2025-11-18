import os
import json
import logging
from typing import Dict, Optional, Tuple, Any
from threading import Lock

logger = logging.getLogger(__name__)

# Thread-safe in-memory state storage for single user
# Structure: {'lesson_id': int, 'step_order': int, 'popup_sent': bool}
_state: Dict[str, Any] = {}
_state_lock = Lock()

# Cache for loaded course data
_course_data: Optional[list] = None
_course_data_lock = Lock()


class StepManager:
    """
    Centralized step manager for tracking and managing progress through lessons.
    Loads lesson data from generated_course.json file.
    Single-user local app - no user_id needed.
    Thread-safe and provides a single source of truth for current step state.
    """
    
    def __init__(self):
        self.default_lesson_id = int(os.getenv("DEFAULT_LESSON_ID", "1"))
        self.course_file_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "generated_course.json"
        )
        self._load_course_data()
    
    def _load_course_data(self) -> None:
        """Load course data from generated_course.json file."""
        global _course_data
        try:
            with _course_data_lock:
                if _course_data is None:
                    if os.path.exists(self.course_file_path):
                        with open(self.course_file_path, 'r', encoding='utf-8') as f:
                            _course_data = json.load(f)
                        logger.info(f"Loaded course data from {self.course_file_path}")
                    else:
                        logger.warning(f"Course file not found: {self.course_file_path}")
                        _course_data = []
        except Exception as e:
            logger.error(f"Error loading course data: {e}")
            _course_data = []
    
    def _get_lesson_steps_from_json(self, lesson_id: int) -> Dict[int, Dict[str, str]]:
        """
        Get all steps for a lesson from the loaded JSON data.
        
        Args:
            lesson_id: The lesson ID (1-indexed, matches 'lesson_id' field in JSON)
            
        Returns:
            Dict[int, Dict[str, str]]: {step_order: {'name': str, 'description': str, 'finish_criteria': str}}
        """
        with _course_data_lock:
            if _course_data is None:
                self._load_course_data()
            
            if not _course_data:
                return {}
            
            # Find lesson by lesson_id
            lesson = None
            for l in _course_data:
                if l.get('lesson_id') == lesson_id:
                    lesson = l
                    break
            
            if not lesson or 'steps' not in lesson:
                return {}
            
            # Use JSON structure directly (field names now match)
            lesson_data: Dict[int, Dict[str, str]] = {}
            for step in lesson.get('steps', []):
                step_order = step.get('step_order')
                if step_order is not None:
                    lesson_data[step_order] = {
                        'name': step.get('name', ''),
                        'description': step.get('description', ''),
                        'finish_criteria': step.get('finish_criteria', '')
                    }
            
            logger.info(f"Loaded {len(lesson_data)} steps for lesson {lesson_id} from JSON")
            return lesson_data
    
    def get_current_step(self) -> Tuple[Optional[int], Optional[int]]:
        """
        Get the current lesson_id and step_order.
        
        Returns:
            Tuple of (lesson_id, step_order) or (None, None) if not set
        """
        with _state_lock:
            lesson_id = _state.get('lesson_id')
            step_order = _state.get('step_order')
            return lesson_id, step_order
    
    def set_current_step(self, lesson_id: int, step_order: int) -> bool:
        """
        Set the current step.
        
        Args:
            lesson_id: Lesson ID to set
            step_order: Step order to set
            
        Returns:
            True if successful
        """
        with _state_lock:
            _state['lesson_id'] = lesson_id
            _state['step_order'] = step_order
            logger.info(f"Set step: lesson {lesson_id}, step {step_order}")
            return True
    
    def advance_to_next_step(self) -> Tuple[Optional[int], Optional[int], bool]:
        """
        Advance to the next step in the current lesson.
        
        Returns:
            Tuple of (lesson_id, next_step_order, has_next_step)
            Returns (None, None, False) if no current step or no next step exists
        """
        with _state_lock:
            lesson_id = _state.get('lesson_id')
            current_step = _state.get('step_order')
            
            if lesson_id is None or current_step is None:
                return None, None, False
            
            # Load lesson data to check if next step exists
            lesson_data = self._get_lesson_steps_from_json(lesson_id)
            next_step_order = current_step + 1
            
            if next_step_order in lesson_data:
                # Next step exists
                _state['step_order'] = next_step_order
                _state['popup_sent'] = False  # Reset popup flag
                logger.info(f"Advanced to step {next_step_order} in lesson {lesson_id}")
                return lesson_id, next_step_order, True
            else:
                # No next step - lesson completed
                logger.info(f"Completed lesson {lesson_id}")
                return lesson_id, None, False
    
    def go_to_previous_step(self) -> Tuple[Optional[int], Optional[int], bool]:
        """
        Go to the previous step in the current lesson.
        
        Returns:
            Tuple of (lesson_id, previous_step_order, has_previous_step)
            Returns (None, None, False) if no current step or no previous step exists
        """
        with _state_lock:
            lesson_id = _state.get('lesson_id')
            current_step = _state.get('step_order')
            
            if lesson_id is None or current_step is None:
                return None, None, False
            
            # Load lesson data to check if previous step exists
            lesson_data = self._get_lesson_steps_from_json(lesson_id)
            previous_step_order = current_step - 1
            
            if previous_step_order > 0 and previous_step_order in lesson_data:
                # Previous step exists
                _state['step_order'] = previous_step_order
                _state['popup_sent'] = False  # Reset popup flag
                logger.info(f"Went back to step {previous_step_order} in lesson {lesson_id}")
                return lesson_id, previous_step_order, True
            else:
                # No previous step - already at first step
                logger.info(f"Already at first step of lesson {lesson_id}")
                return lesson_id, None, False
    
    def get_step_info(self) -> Optional[Dict[str, Any]]:
        """
        Get full step information including description and finish criteria.
        
        Returns:
            Dict with step info: {'name', 'description', 'finish_criteria', 'lesson_id', 'step_order'}
            or None if step not found
        """
        lesson_id, step_order = self.get_current_step()
        
        if lesson_id is None or step_order is None:
            return None
        
        # Load lesson data
        lesson_data = self._get_lesson_steps_from_json(lesson_id)
        
        if step_order not in lesson_data:
            return None
        
        step_info = lesson_data[step_order].copy()
        step_info['lesson_id'] = lesson_id
        step_info['step_order'] = step_order
        
        return step_info
    
    def mark_popup_sent(self) -> bool:
        """
        Mark that popup has been sent for the current step.
        
        Returns:
            True if successful
        """
        with _state_lock:
            if 'lesson_id' not in _state:
                return False
            _state['popup_sent'] = True
            return True
    
    def has_popup_been_sent(self) -> bool:
        """
        Check if popup has been sent for the current step.
        
        Returns:
            True if popup has been sent, False otherwise
        """
        with _state_lock:
            return _state.get('popup_sent', False)
    
    def reset(self) -> bool:
        """
        Reset state (clear current step).
        
        Returns:
            True if successful
        """
        with _state_lock:
            _state.clear()
            logger.info("Reset step state")
            return True
    
    def initialize(self, lesson_id: Optional[int] = None, step_order: Optional[int] = None) -> Tuple[int, int]:
        """
        Initialize or get current step, using defaults if not set.
        
        Args:
            lesson_id: Lesson ID to initialize with (uses current or default if None)
            step_order: Step order to initialize with (uses current or 1 if None)
            
        Returns:
            Tuple of (lesson_id, step_order) that was set
        """
        current_lesson, current_step = self.get_current_step()
        
        # Use provided values, or current values, or defaults
        final_lesson_id = lesson_id if lesson_id is not None else (current_lesson if current_lesson is not None else self.default_lesson_id)
        final_step_order = step_order if step_order is not None else (current_step if current_step is not None else 1)
        
        self.set_current_step(final_lesson_id, final_step_order)
        return final_lesson_id, final_step_order


# Global singleton instance
step_manager = StepManager()
