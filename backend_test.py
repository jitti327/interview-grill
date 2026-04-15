#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import time

class DevGrillAPITester:
    def __init__(self, base_url="https://dev-grill-ai.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None
        self.session_id = None
        self.round_id = None
        self.bookmark_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        return success

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/")
            success = response.status_code == 200 and "DevGrill AI API" in response.text
            return self.log_test("API Root", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("API Root", False, str(e))

    def test_register(self):
        """Test user registration"""
        try:
            timestamp = int(time.time())
            data = {
                "email": f"test_{timestamp}@devgrill.com",
                "password": "test123456",
                "name": f"Test User {timestamp}"
            }
            response = self.session.post(f"{self.base_url}/api/auth/register", json=data)
            success = response.status_code == 200
            if success:
                user_data = response.json()
                self.user_id = user_data.get("id")
            return self.log_test("User Registration", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("User Registration", False, str(e))

    def test_login_admin(self):
        """Test admin login"""
        try:
            data = {
                "email": "admin@devgrill.com",
                "password": "admin123"
            }
            response = self.session.post(f"{self.base_url}/api/auth/login", json=data)
            success = response.status_code == 200
            if success:
                user_data = response.json()
                self.user_id = user_data.get("id")
            return self.log_test("Admin Login", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Admin Login", False, str(e))

    def test_get_me(self):
        """Test get current user"""
        try:
            response = self.session.get(f"{self.base_url}/api/auth/me")
            success = response.status_code == 200
            if success:
                user_data = response.json()
                success = "email" in user_data
            return self.log_test("Get Current User", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Get Current User", False, str(e))

    def test_create_session(self):
        """Test session creation with timed mode"""
        try:
            data = {
                "tech_stack": "React",
                "category": "frontend",
                "difficulty": "intermediate",
                "num_questions": 5,
                "timed_mode": True,
                "time_per_question": 300
            }
            response = self.session.post(f"{self.base_url}/api/sessions", json=data)
            success = response.status_code == 200
            if success:
                session_data = response.json()
                self.session_id = session_data.get("id")
                # Verify timed mode fields are present
                success = (session_data.get("timed_mode") == True and 
                          session_data.get("time_per_question") == 300)
            return self.log_test("Create Session (Timed Mode)", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Create Session (Timed Mode)", False, str(e))

    def test_list_sessions(self):
        """Test listing sessions"""
        try:
            response = self.session.get(f"{self.base_url}/api/sessions")
            success = response.status_code == 200
            if success:
                sessions = response.json()
                success = isinstance(sessions, list)
            return self.log_test("List Sessions", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("List Sessions", False, str(e))

    def test_get_session(self):
        """Test getting session details"""
        if not self.session_id:
            return self.log_test("Get Session", False, "No session ID available")
        try:
            response = self.session.get(f"{self.base_url}/api/sessions/{self.session_id}")
            success = response.status_code == 200
            if success:
                data = response.json()
                success = "session" in data and "rounds" in data
            return self.log_test("Get Session", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Get Session", False, str(e))

    def test_generate_question(self):
        """Test question generation"""
        if not self.session_id:
            return self.log_test("Generate Question", False, "No session ID available")
        try:
            data = {"session_id": self.session_id}
            response = self.session.post(f"{self.base_url}/api/interview/question", json=data)
            success = response.status_code == 200
            if success:
                question_data = response.json()
                self.round_id = question_data.get("id")
                success = "question" in question_data and "topic" in question_data
            return self.log_test("Generate Question", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Generate Question", False, str(e))

    def test_evaluate_answer(self):
        """Test answer evaluation"""
        if not self.session_id or not self.round_id:
            return self.log_test("Evaluate Answer", False, "Missing session or round ID")
        try:
            data = {
                "session_id": self.session_id,
                "round_id": self.round_id,
                "answer": "This is a test answer for React components and state management."
            }
            response = self.session.post(f"{self.base_url}/api/interview/evaluate", json=data)
            success = response.status_code == 200
            if success:
                eval_data = response.json()
                success = "score" in eval_data and "feedback" in eval_data
            return self.log_test("Evaluate Answer", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Evaluate Answer", False, str(e))

    def test_create_bookmark(self):
        """Test bookmark creation"""
        if not self.session_id or not self.round_id:
            return self.log_test("Create Bookmark", False, "Missing session or round ID")
        try:
            data = {
                "session_id": self.session_id,
                "round_id": self.round_id
            }
            response = self.session.post(f"{self.base_url}/api/bookmarks", json=data)
            success = response.status_code == 200
            if success:
                bookmark_data = response.json()
                self.bookmark_id = bookmark_data.get("id")
                success = "question" in bookmark_data and "topic" in bookmark_data
            return self.log_test("Create Bookmark", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Create Bookmark", False, str(e))

    def test_list_bookmarks(self):
        """Test listing bookmarks"""
        try:
            response = self.session.get(f"{self.base_url}/api/bookmarks")
            success = response.status_code == 200
            if success:
                bookmarks = response.json()
                success = isinstance(bookmarks, list)
            return self.log_test("List Bookmarks", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("List Bookmarks", False, str(e))

    def test_dashboard_overview(self):
        """Test dashboard overview"""
        try:
            response = self.session.get(f"{self.base_url}/api/dashboard/overview")
            success = response.status_code == 200
            if success:
                data = response.json()
                success = "total_sessions" in data and "completed_sessions" in data
            return self.log_test("Dashboard Overview", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Dashboard Overview", False, str(e))

    def test_weak_topics(self):
        """Test weak topics endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/dashboard/weak-topics")
            success = response.status_code == 200
            if success:
                data = response.json()
                success = isinstance(data, list)
            return self.log_test("Weak Topics", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Weak Topics", False, str(e))

    def test_skill_radar(self):
        """Test skill radar endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/dashboard/skill-radar")
            success = response.status_code == 200
            if success:
                data = response.json()
                success = isinstance(data, list)
            return self.log_test("Skill Radar", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Skill Radar", False, str(e))

    def test_score_trend(self):
        """Test score trend endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/dashboard/trend")
            success = response.status_code == 200
            if success:
                data = response.json()
                success = isinstance(data, list)
            return self.log_test("Score Trend", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Score Trend", False, str(e))

    def test_session_comparison(self):
        """Test session comparison"""
        if not self.session_id:
            return self.log_test("Session Comparison", False, "No session ID available")
        try:
            # Use the same session for both parameters for testing
            response = self.session.get(f"{self.base_url}/api/comparison", 
                                      params={"session1": self.session_id, "session2": self.session_id})
            success = response.status_code == 200
            if success:
                data = response.json()
                success = "session_a" in data and "session_b" in data and "winner" in data
            return self.log_test("Session Comparison", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Session Comparison", False, str(e))

    def test_complete_session(self):
        """Test session completion"""
        if not self.session_id:
            return self.log_test("Complete Session", False, "No session ID available")
        try:
            response = self.session.post(f"{self.base_url}/api/sessions/{self.session_id}/complete")
            success = response.status_code == 200
            if success:
                data = response.json()
                success = data.get("session", {}).get("status") == "completed"
            return self.log_test("Complete Session", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Complete Session", False, str(e))

    def test_logout(self):
        """Test logout"""
        try:
            response = self.session.post(f"{self.base_url}/api/auth/logout")
            success = response.status_code == 200
            return self.log_test("Logout", success, f"Status: {response.status_code}")
        except Exception as e:
            return self.log_test("Logout", False, str(e))

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting DevGrill AI API Tests")
        print("=" * 50)
        
        # Basic API test
        self.test_api_root()
        
        # Auth flow
        self.test_register()
        self.test_login_admin()
        self.test_get_me()
        
        # Session management
        self.test_create_session()
        self.test_list_sessions()
        self.test_get_session()
        
        # Interview flow
        self.test_generate_question()
        time.sleep(2)  # Wait for AI processing
        self.test_evaluate_answer()
        
        # Bookmarks
        self.test_create_bookmark()
        self.test_list_bookmarks()
        
        # Dashboard analytics
        self.test_dashboard_overview()
        self.test_weak_topics()
        self.test_skill_radar()
        self.test_score_trend()
        
        # Session comparison
        self.test_session_comparison()
        
        # Complete session
        self.test_complete_session()
        
        # Logout
        self.test_logout()
        
        # Results
        print("=" * 50)
        print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = DevGrillAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())