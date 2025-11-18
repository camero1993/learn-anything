import json
import os

import requests
from dotenv import load_dotenv
from flask import Blueprint, jsonify, request

from lesson_generator import generate_full_course
from tools.bright_data_tool import scrape_to_txt

load_dotenv()

# Create a blueprint for lesson plan routes
lesson_plans_bp = Blueprint('lesson_plans', __name__)

# Supabase credentials
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

@lesson_plans_bp.route('/lessons', methods=['GET'])
def get_lessons():
    """
    Fetch all lessons from the generated_course.json file.
    """
    try:
        # Construct the absolute path to the JSON file
        # Assumes this route file is in backend/routes/
        current_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(current_dir, '..', 'generated_course.json')

        if not os.path.exists(file_path):
            return jsonify({"status": "error", "message": "generated_course.json not found."}), 404

        with open(file_path, 'r') as f:
            lessons_data = json.load(f)
        
        return jsonify({
            "status": "success",
            "count": len(lessons_data),
            "lessons": lessons_data
        })
    except Exception as e:
        return jsonify({"status": "error", "message": f"Error reading course data: {str(e)}"}), 500

@lesson_plans_bp.route('/generate-lesson-plan', methods=['POST'])
def generateLessonPlan():
    """Generate a new lesson plan based on input parameters"""
    try:
        data = request.get_json()
        lesson_topic = data.get('topic')
        print(lesson_topic)
        
        if not lesson_topic:
            return jsonify({"error": "No data provided"}), 400
        
        scrape_to_txt(lesson_topic)
        generate_full_course()

        # Load generated course
        with open('generated_course.json', 'r', encoding='utf-8') as f:
            course_data = json.load(f)

        print(f"Loaded {len(course_data)} lessons from JSON")

        generated_lesson_plan = []

        # Insert lessons and steps
        for lesson_data in course_data:
            try:
                # Insert lesson
                lesson_insert = {
                    'name': lesson_data['title'],
                    'description': lesson_data.get('description', ''),
                    'lesson_order': lesson_data.get('chapter', 1),
                    'is_finished': False
                }

                print(f"Inserting lesson: {lesson_insert['name']}")

                # POST to Supabase REST API
                response = requests.post(
                    f'{SUPABASE_URL}/rest/v1/lesson',
                    headers=headers,
                    json=lesson_insert
                )

                if response.status_code not in [200, 201]:
                    print(f"❌ Failed to create lesson: {response.text}")
                    continue

                lesson_response = response.json()
                lesson_id = lesson_response[0]['id']
                print(f"✅ Created lesson (ID: {lesson_id}): {lesson_insert['name']}")

                # Prepare lesson object for response
                lesson_obj = {
                    'id': lesson_id,
                    'name': lesson_insert['name'],
                    'description': lesson_insert['description'],
                    'lesson_order': lesson_insert['lesson_order'],
                    'is_finished': False,
                    'steps': []
                }

                # Insert steps for this lesson
                if lesson_data.get('steps'):
                    steps_to_insert = []
                    for step in lesson_data['steps']:
                        step_insert = {
                            'lesson_id': lesson_id,
                            'name': step.get('title', ''),
                            'description': step.get('instruction', ''),
                            'step_order': step.get('step', 1),
                            'finish_criteria': step.get('finished_criteria', '')
                        }
                        steps_to_insert.append(step_insert)

                    if steps_to_insert:
                        print(f"  Inserting {len(steps_to_insert)} steps...")

                        steps_response = requests.post(
                            f'{SUPABASE_URL}/rest/v1/step',
                            headers=headers,
                            json=steps_to_insert
                        )

                        if steps_response.status_code in [200, 201]:
                            steps_data = steps_response.json()
                            lesson_obj['steps'] = steps_data
                            print(f"  ✅ Created {len(steps_to_insert)} steps")
                        else:
                            print(f"  ❌ Failed to create steps: {steps_response.text}")

                generated_lesson_plan.append(lesson_obj)

            except Exception as e:
                print(f"❌ Error processing lesson '{lesson_data.get('title', 'unknown')}': {e}")
                continue

        print(f"🎉 Successfully uploaded course to Supabase!")

        # Return the generated lesson plan
        return jsonify({
            'status': 'success',
            'message': f'Successfully generated and uploaded {len(generated_lesson_plan)} lessons',
            'generated_lesson_plan': generated_lesson_plan
        }), 200

    except FileNotFoundError:
        return jsonify({
            'status': 'error',
            'message': 'generated_course.json file not found'
        }), 404
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error generating lesson plan: {str(e)}'
        }), 500
