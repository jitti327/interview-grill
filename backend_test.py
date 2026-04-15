#!/usr/bin/env python3

import requests
import json
import sys
import time
from datetime import datetime

class DevGrillAPITester:
    def __init__(self, base_url="https://dev-grill-ai.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = None
        self.round_id = None

    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name, method, endpoint, expected_status=200, data=None, timeout=30):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        self.tests_run += 1
        
        self.log(f"🔍 Testing {name}...")
        self.log(f"   {method} {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, timeout=timeout)
            elif method == 'POST':
                response = self.session.post(url, json=data, timeout=timeout)
            elif method == 'PUT':
                response = self.session.put(url, json=data, timeout=timeout)
            elif method == 'DELETE':
                response = self.session.delete(url, timeout=timeout)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}", "PASS")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "FAIL")
                self.log(f"   Response: {response.text[:200]}", "ERROR")
                return False, {}

        except requests.exceptions.Timeout:
            self.log(f"❌ {name} - Request timeout after {timeout}s", "FAIL")
            return False, {}
        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}", "FAIL")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test("Root API", "GET", "")

    def test_create_session(self):
        """Test creating a new interview session"""
        session_data = {
            "tech_stack": "React",
            "category": "frontend",
            "difficulty": "intermediate",
            "num_questions": 5
        }
        
        success, response = self.run_test(
            "Create Session", 
            "POST", 
            "sessions", 
            200, 
            session_data
        )
        
        if success and 'id' in response:
            self.session_id = response['id']
            self.log(f"   Session ID: {self.session_id}")
            return True
        return False

    def test_get_session(self):
        """Test retrieving a session by ID"""
        if not self.session_id:
            self.log("❌ No session ID available for testing", "FAIL")
            return False
            
        return self.run_test(
            "Get Session", 
            "GET", 
            f"sessions/{self.session_id}"
        )[0]

    def test_list_sessions(self):
        """Test listing all sessions"""
        return self.run_test("List Sessions", "GET", "sessions")[0]

    def test_generate_question(self):
        """Test AI question generation"""
        if not self.session_id:
            self.log("❌ No session ID available for testing", "FAIL")
            return False
            
        question_data = {"session_id": self.session_id}
        
        # AI generation might take longer
        success, response = self.run_test(
            "Generate Question", 
            "POST", 
            "interview/question", 
            200, 
            question_data,
            timeout=60
        )
        
        if success and 'id' in response:
            self.round_id = response['id']
            self.log(f"   Round ID: {self.round_id}")
            self.log(f"   Question: {response.get('question', 'N/A')[:100]}...")
            return True
        return False

    def test_evaluate_answer(self):
        """Test AI answer evaluation"""
        if not self.session_id or not self.round_id:
            self.log("❌ No session/round ID available for testing", "FAIL")
            return False
            
        answer_data = {
            "session_id": self.session_id,
            "round_id": self.round_id,
            "answer": "React is a JavaScript library for building user interfaces. It uses a component-based architecture and virtual DOM for efficient rendering. Key concepts include JSX, props, state, and hooks like useState and useEffect."
        }
        
        # AI evaluation might take longer
        success, response = self.run_test(
            "Evaluate Answer", 
            "POST", 
            "interview/evaluate", 
            200, 
            answer_data,
            timeout=60
        )
        
        if success:
            score = response.get('score', 'N/A')
            feedback = response.get('feedback', 'N/A')
            self.log(f"   Score: {score}/10")
            self.log(f"   Feedback: {feedback[:100]}...")
            return True
        return False

    def test_complete_session(self):
        """Test completing a session"""
        if not self.session_id:
            self.log("❌ No session ID available for testing", "FAIL")
            return False
            
        return self.run_test(
            "Complete Session", 
            "POST", 
            f"sessions/{self.session_id}/complete"
        )[0]

    def test_dashboard_overview(self):
        """Test dashboard overview endpoint"""
        return self.run_test("Dashboard Overview", "GET", "dashboard/overview")[0]

    def test_skill_radar(self):
        """Test skill radar endpoint"""
        return self.run_test("Skill Radar", "GET", "dashboard/skill-radar")[0]

    def test_score_trend(self):
        """Test score trend endpoint"""
        return self.run_test("Score Trend", "GET", "dashboard/trend")[0]

    def test_category_stats(self):
        """Test category stats endpoint"""
        return self.run_test("Category Stats", "GET", "dashboard/category-stats")[0]

    def run_all_tests(self):
        """Run all API tests in sequence"""
        self.log("🚀 Starting DevGrill AI API Tests")
        self.log(f"   Base URL: {self.base_url}")
        
        # Basic API tests
        self.test_root_endpoint()
        
        # Session management tests
        self.test_create_session()
        self.test_get_session()
        self.test_list_sessions()
        
        # AI interaction tests (these might take longer)
        if self.session_id:
            self.log("⏳ Testing AI features (may take 30-60 seconds)...")
            self.test_generate_question()
            self.test_evaluate_answer()
            self.test_complete_session()
        
        # Dashboard tests
        self.test_dashboard_overview()
        self.test_skill_radar()
        self.test_score_trend()
        self.test_category_stats()
        
        # Print summary
        self.log("=" * 50)
        self.log(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 All tests passed!", "SUCCESS")
            return 0
        else:
            failed = self.tests_run - self.tests_passed
            self.log(f"💥 {failed} test(s) failed", "ERROR")
            return 1

def main():
    tester = DevGrillAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())