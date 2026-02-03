#!/usr/bin/env python3
"""
Nexus Command Backend API Testing Suite
Tests all API endpoints with proper authentication
"""

import requests
import sys
import json
from datetime import datetime

class NexusCommandAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({"name": name, "details": details})

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make API request with proper headers"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)

            success = response.status_code == expected_status
            return success, response
        except Exception as e:
            return False, str(e)

    def test_health_check(self):
        """Test health endpoint"""
        success, response = self.make_request('GET', 'health', expected_status=200)
        if success:
            data = response.json()
            self.log_test("Health Check", 'status' in data and data['status'] == 'healthy')
        else:
            self.log_test("Health Check", False, f"Failed to connect: {response}")

    def test_login(self):
        """Test login with admin credentials"""
        login_data = {
            "email": "admin@nexuscommand.local",
            "password": "KG4GaMYWiNBxsYFW"
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        if success:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                self.user_id = data['user']['id']
                self.log_test("Admin Login", True, f"Logged in as {data['user']['email']}")
                return True
            else:
                self.log_test("Admin Login", False, "Missing token or user in response")
        else:
            self.log_test("Admin Login", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Connection Error'}")
        return False

    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        success, response = self.make_request('GET', 'dashboard/stats', expected_status=200)
        if success:
            data = response.json()
            required_fields = ['total_servers', 'online_servers', 'offline_servers', 'total_updates_available']
            has_all_fields = all(field in data for field in required_fields)
            self.log_test("Dashboard Stats", has_all_fields, f"Stats: {data}")
        else:
            self.log_test("Dashboard Stats", False, f"Status: {response.status_code}")

    def test_servers_list(self):
        """Test servers listing endpoint"""
        success, response = self.make_request('GET', 'servers', expected_status=200)
        if success:
            data = response.json()
            is_list = isinstance(data, list)
            self.log_test("Servers List", is_list, f"Found {len(data) if is_list else 0} servers")
            return data if is_list else []
        else:
            self.log_test("Servers List", False, f"Status: {response.status_code}")
            return []

    def test_server_creation(self):
        """Test creating a new server"""
        server_data = {
            "hostname": "test-server-api",
            "ip_address": "192.168.1.200",
            "os_type": "linux",
            "os_version": "Ubuntu 22.04",
            "description": "Test server created by API test",
            "ssh_port": 22,
            "ssh_username": "root",
            "tags": ["test", "api"]
        }
        
        success, response = self.make_request('POST', 'servers', server_data, expected_status=201)
        if success:
            data = response.json()
            has_id = 'id' in data
            self.log_test("Server Creation", has_id, f"Created server: {data.get('hostname', 'Unknown')}")
            return data.get('id') if has_id else None
        else:
            self.log_test("Server Creation", False, f"Status: {response.status_code}")
            return None

    def test_server_detail(self, server_id):
        """Test getting server details"""
        if not server_id:
            self.log_test("Server Detail", False, "No server ID provided")
            return
            
        success, response = self.make_request('GET', f'servers/{server_id}', expected_status=200)
        if success:
            data = response.json()
            has_required_fields = all(field in data for field in ['id', 'hostname', 'ip_address'])
            self.log_test("Server Detail", has_required_fields, f"Server: {data.get('hostname', 'Unknown')}")
        else:
            self.log_test("Server Detail", False, f"Status: {response.status_code}")

    def test_tasks_list(self):
        """Test tasks listing endpoint"""
        success, response = self.make_request('GET', 'tasks', expected_status=200)
        if success:
            data = response.json()
            is_list = isinstance(data, list)
            self.log_test("Tasks List", is_list, f"Found {len(data) if is_list else 0} tasks")
        else:
            self.log_test("Tasks List", False, f"Status: {response.status_code}")

    def test_task_creation(self):
        """Test creating a new task"""
        task_data = {
            "name": "Test Update Task",
            "task_type": "update",
            "command": "apt update && apt upgrade -y",
            "schedule": "0 2 * * 0",
            "server_ids": [],
            "enabled": True
        }
        
        success, response = self.make_request('POST', 'tasks', task_data, expected_status=200)
        if success:
            data = response.json()
            has_id = 'id' in data
            self.log_test("Task Creation", has_id, f"Created task: {data.get('name', 'Unknown')}")
            return data.get('id') if has_id else None
        else:
            self.log_test("Task Creation", False, f"Status: {response.status_code}")
            return None

    def test_users_list(self):
        """Test users listing endpoint (admin only)"""
        success, response = self.make_request('GET', 'users', expected_status=200)
        if success:
            data = response.json()
            is_list = isinstance(data, list)
            self.log_test("Users List", is_list, f"Found {len(data) if is_list else 0} users")
        else:
            self.log_test("Users List", False, f"Status: {response.status_code}")

    def test_ip_overview(self):
        """Test IP overview endpoint"""
        success, response = self.make_request('GET', 'ip-overview', expected_status=200)
        if success:
            data = response.json()
            is_list = isinstance(data, list)
            self.log_test("IP Overview", is_list, f"Found {len(data) if is_list else 0} IP entries")
        else:
            self.log_test("IP Overview", False, f"Status: {response.status_code}")

    def test_activity_logs(self):
        """Test activity logs endpoint"""
        success, response = self.make_request('GET', 'activity-logs?limit=5', expected_status=200)
        if success:
            data = response.json()
            is_list = isinstance(data, list)
            self.log_test("Activity Logs", is_list, f"Found {len(data) if is_list else 0} activity entries")
        else:
            self.log_test("Activity Logs", False, f"Status: {response.status_code}")

    def test_server_metrics(self, server_id):
        """Test server metrics endpoint"""
        if not server_id:
            self.log_test("Server Metrics", False, "No server ID provided")
            return
            
        success, response = self.make_request('GET', f'servers/{server_id}/metrics', expected_status=200)
        if success:
            data = response.json()
            self.log_test("Server Metrics", True, f"Metrics data received")
        else:
            self.log_test("Server Metrics", False, f"Status: {response.status_code}")

    def test_server_processes(self, server_id):
        """Test server processes endpoint"""
        if not server_id:
            self.log_test("Server Processes", False, "No server ID provided")
            return
            
        success, response = self.make_request('GET', f'servers/{server_id}/processes', expected_status=200)
        if success:
            data = response.json()
            is_list = isinstance(data, list)
            self.log_test("Server Processes", is_list, f"Found {len(data) if is_list else 0} processes")
        else:
            self.log_test("Server Processes", False, f"Status: {response.status_code}")

    def test_server_packages(self, server_id):
        """Test server packages endpoint"""
        if not server_id:
            self.log_test("Server Packages", False, "No server ID provided")
            return
            
        success, response = self.make_request('GET', f'servers/{server_id}/packages', expected_status=200)
        if success:
            data = response.json()
            is_list = isinstance(data, list)
            self.log_test("Server Packages", is_list, f"Found {len(data) if is_list else 0} packages")
        else:
            self.log_test("Server Packages", False, f"Status: {response.status_code}")

    def test_server_logs(self, server_id):
        """Test server logs endpoint"""
        if not server_id:
            self.log_test("Server Logs", False, "No server ID provided")
            return
            
        success, response = self.make_request('GET', f'servers/{server_id}/logs', expected_status=200)
        if success:
            data = response.json()
            is_list = isinstance(data, list)
            self.log_test("Server Logs List", is_list, f"Found {len(data) if is_list else 0} log files")
            
            # Test log content if logs exist
            if is_list and len(data) > 0:
                log_name = data[0]['name']
                success2, response2 = self.make_request('GET', f'servers/{server_id}/logs/{log_name}', expected_status=200)
                if success2:
                    log_data = response2.json()
                    has_content = 'content' in log_data
                    self.log_test("Server Log Content", has_content, f"Log content retrieved for {log_name}")
                else:
                    self.log_test("Server Log Content", False, f"Status: {response2.status_code}")
        else:
            self.log_test("Server Logs List", False, f"Status: {response.status_code}")

    def cleanup_test_data(self, server_id, task_id):
        """Clean up test data"""
        if task_id:
            success, _ = self.make_request('DELETE', f'tasks/{task_id}', expected_status=200)
            self.log_test("Cleanup Task", success, f"Deleted task: {task_id}")
        
        if server_id:
            success, _ = self.make_request('DELETE', f'servers/{server_id}', expected_status=200)
            self.log_test("Cleanup Server", success, f"Deleted server: {server_id}")

    def run_all_tests(self):
        """Run comprehensive API test suite"""
        print("🚀 Starting Nexus Command API Tests")
        print("=" * 50)
        
        # Basic connectivity
        self.test_health_check()
        
        # Authentication
        if not self.test_login():
            print("❌ Login failed - stopping tests")
            return False
        
        # Core endpoints
        self.test_dashboard_stats()
        servers = self.test_servers_list()
        self.test_users_list()
        self.test_ip_overview()
        self.test_activity_logs()
        
        # Tasks
        self.test_tasks_list()
        task_id = self.test_task_creation()
        
        # Server operations
        server_id = self.test_server_creation()
        self.test_server_detail(server_id)
        
        # Use existing server for detailed tests if no new server created
        test_server_id = server_id or (servers[0]['id'] if servers else None)
        
        if test_server_id:
            self.test_server_metrics(test_server_id)
            self.test_server_processes(test_server_id)
            self.test_server_packages(test_server_id)
            self.test_server_logs(test_server_id)
        
        # Cleanup
        self.cleanup_test_data(server_id, task_id)
        
        # Results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['name']}: {test['details']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"✨ Success Rate: {success_rate:.1f}%")
        
        return success_rate >= 80  # Consider 80%+ success rate as passing

def main():
    tester = NexusCommandAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())