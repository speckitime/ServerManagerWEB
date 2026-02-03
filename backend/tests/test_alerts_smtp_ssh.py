"""
Test suite for Nexus Command - Alerts, SMTP, and SSH features
Tests the new features: Alerts page, Alert Rules, SMTP configuration, SSH Terminal
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@nexuscommand.local"
TEST_PASSWORD = "KG4GaMYWiNBxsYFW"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def linux_server_id(auth_headers):
    """Get a Linux server ID for testing"""
    response = requests.get(f"{BASE_URL}/api/servers", headers=auth_headers)
    assert response.status_code == 200
    servers = response.json()
    linux_servers = [s for s in servers if s.get("os_type") == "linux"]
    if linux_servers:
        return linux_servers[0]["id"]
    return None


@pytest.fixture(scope="module")
def windows_server_id(auth_headers):
    """Get a Windows server ID for testing"""
    response = requests.get(f"{BASE_URL}/api/servers", headers=auth_headers)
    assert response.status_code == 200
    servers = response.json()
    windows_servers = [s for s in servers if s.get("os_type") == "windows"]
    if windows_servers:
        return windows_servers[0]["id"]
    return None


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ API health check passed")


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test successful login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == TEST_EMAIL
        assert data["user"]["role"] == "admin"
        print("✓ Login successful")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials rejected")


class TestAlerts:
    """Alert system tests"""
    
    def test_list_alerts(self, auth_headers):
        """Test listing alerts"""
        response = requests.get(f"{BASE_URL}/api/alerts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Alerts list returned {len(data)} alerts")
    
    def test_list_alerts_with_filters(self, auth_headers):
        """Test listing alerts with status filter"""
        response = requests.get(f"{BASE_URL}/api/alerts?status=active", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Filtered alerts returned {len(data)} active alerts")
    
    def test_get_active_alerts_count(self, auth_headers):
        """Test getting active alerts count by severity"""
        response = requests.get(f"{BASE_URL}/api/alerts/active-count", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "critical" in data
        assert "warning" in data
        assert "info" in data
        print(f"✓ Active alerts count: total={data['total']}, critical={data['critical']}, warning={data['warning']}, info={data['info']}")


class TestAlertRules:
    """Alert rules tests"""
    
    def test_list_alert_rules(self, auth_headers):
        """Test listing alert rules"""
        response = requests.get(f"{BASE_URL}/api/alert-rules", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have default rules created on startup
        assert len(data) >= 3, "Expected at least 3 default alert rules"
        print(f"✓ Alert rules list returned {len(data)} rules")
        
        # Verify rule structure
        for rule in data:
            assert "id" in rule
            assert "name" in rule
            assert "metric_type" in rule
            assert "threshold" in rule
            assert "severity" in rule
            assert "enabled" in rule
    
    def test_create_alert_rule(self, auth_headers):
        """Test creating a new alert rule"""
        rule_data = {
            "name": "TEST_High Network Usage",
            "metric_type": "cpu",
            "comparison": "gt",
            "threshold": 85.0,
            "severity": "warning",
            "server_ids": [],
            "enabled": True
        }
        response = requests.post(f"{BASE_URL}/api/alert-rules", headers=auth_headers, json=rule_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == rule_data["name"]
        assert data["threshold"] == rule_data["threshold"]
        print(f"✓ Created alert rule: {data['name']}")
        return data["id"]
    
    def test_update_alert_rule(self, auth_headers):
        """Test updating an alert rule"""
        # First create a rule
        rule_data = {
            "name": "TEST_Update Rule",
            "metric_type": "memory",
            "comparison": "gt",
            "threshold": 80.0,
            "severity": "info",
            "enabled": True
        }
        create_response = requests.post(f"{BASE_URL}/api/alert-rules", headers=auth_headers, json=rule_data)
        assert create_response.status_code == 200
        rule_id = create_response.json()["id"]
        
        # Update the rule
        update_data = {"threshold": 95.0, "severity": "critical"}
        update_response = requests.put(f"{BASE_URL}/api/alert-rules/{rule_id}", headers=auth_headers, json=update_data)
        assert update_response.status_code == 200
        updated_rule = update_response.json()
        assert updated_rule["threshold"] == 95.0
        assert updated_rule["severity"] == "critical"
        print(f"✓ Updated alert rule threshold to {updated_rule['threshold']}")
    
    def test_delete_alert_rule(self, auth_headers):
        """Test deleting an alert rule"""
        # First create a rule to delete
        rule_data = {
            "name": "TEST_Delete Rule",
            "metric_type": "disk",
            "comparison": "gt",
            "threshold": 99.0,
            "severity": "critical",
            "enabled": False
        }
        create_response = requests.post(f"{BASE_URL}/api/alert-rules", headers=auth_headers, json=rule_data)
        assert create_response.status_code == 200
        rule_id = create_response.json()["id"]
        
        # Delete the rule
        delete_response = requests.delete(f"{BASE_URL}/api/alert-rules/{rule_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        print(f"✓ Deleted alert rule {rule_id}")


class TestSMTPConfiguration:
    """SMTP configuration tests"""
    
    def test_get_smtp_settings(self, auth_headers):
        """Test getting SMTP settings (admin only)"""
        response = requests.get(f"{BASE_URL}/api/settings/smtp", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "smtp_host" in data
        assert "smtp_port" in data
        assert "smtp_user" in data
        assert "smtp_from" in data
        assert "alert_email_to" in data
        assert "configured" in data
        print(f"✓ SMTP settings retrieved, configured={data['configured']}")
    
    def test_save_smtp_settings(self, auth_headers):
        """Test saving SMTP settings"""
        smtp_config = {
            "smtp_host": "smtp.test.example.com",
            "smtp_port": 587,
            "smtp_user": "test@example.com",
            "smtp_password": "testpassword123",
            "smtp_from": "alerts@example.com",
            "alert_email_to": "admin@example.com"
        }
        response = requests.post(f"{BASE_URL}/api/settings/smtp", headers=auth_headers, json=smtp_config)
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "SMTP configuration saved"
        print("✓ SMTP settings saved successfully")
        
        # Verify settings were saved
        get_response = requests.get(f"{BASE_URL}/api/settings/smtp", headers=auth_headers)
        assert get_response.status_code == 200
        saved_config = get_response.json()
        assert saved_config["smtp_host"] == smtp_config["smtp_host"]
        assert saved_config["smtp_user"] == smtp_config["smtp_user"]
        assert saved_config["configured"] == True
        print("✓ SMTP settings verified after save")
    
    def test_smtp_test_email_without_real_server(self, auth_headers):
        """Test SMTP test email endpoint (will fail without real SMTP server)"""
        response = requests.post(f"{BASE_URL}/api/settings/smtp/test", headers=auth_headers)
        # This will fail because we don't have a real SMTP server, but endpoint should work
        assert response.status_code in [200, 500]  # 500 expected without real SMTP
        print("✓ SMTP test endpoint accessible (expected to fail without real SMTP server)")


class TestSSHEndpoints:
    """SSH terminal endpoint tests"""
    
    def test_ssh_connect_linux_server(self, auth_headers, linux_server_id):
        """Test SSH connect endpoint for Linux server"""
        if not linux_server_id:
            pytest.skip("No Linux server available for testing")
        
        # This will fail to actually connect (no real server), but endpoint should work
        ssh_credentials = {
            "username": "testuser",
            "password": "testpassword"
        }
        response = requests.post(
            f"{BASE_URL}/api/servers/{linux_server_id}/ssh/connect",
            headers=auth_headers,
            json=ssh_credentials
        )
        # Expected to fail connection but endpoint should be accessible
        assert response.status_code in [200, 400, 500]
        print(f"✓ SSH connect endpoint accessible for Linux server (status: {response.status_code})")
    
    def test_ssh_connect_windows_server_rejected(self, auth_headers, windows_server_id):
        """Test SSH connect is rejected for Windows servers"""
        if not windows_server_id:
            pytest.skip("No Windows server available for testing")
        
        ssh_credentials = {
            "username": "testuser",
            "password": "testpassword"
        }
        response = requests.post(
            f"{BASE_URL}/api/servers/{windows_server_id}/ssh/connect",
            headers=auth_headers,
            json=ssh_credentials
        )
        # Should be rejected for Windows servers
        assert response.status_code == 400
        assert "SSH only available for Linux servers" in response.json().get("detail", "")
        print("✓ SSH correctly rejected for Windows server")


class TestRDPEndpoints:
    """RDP file generation tests"""
    
    def test_rdp_file_generation_windows(self, auth_headers, windows_server_id):
        """Test RDP file generation for Windows server"""
        if not windows_server_id:
            pytest.skip("No Windows server available for testing")
        
        response = requests.get(
            f"{BASE_URL}/api/servers/{windows_server_id}/rdp-file",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "filename" in data
        assert "content" in data
        assert data["filename"].endswith(".rdp")
        assert "full address" in data["content"]
        print(f"✓ RDP file generated: {data['filename']}")
    
    def test_rdp_file_rejected_for_linux(self, auth_headers, linux_server_id):
        """Test RDP file generation is rejected for Linux servers"""
        if not linux_server_id:
            pytest.skip("No Linux server available for testing")
        
        response = requests.get(
            f"{BASE_URL}/api/servers/{linux_server_id}/rdp-file",
            headers=auth_headers
        )
        assert response.status_code == 400
        assert "RDP only available for Windows servers" in response.json().get("detail", "")
        print("✓ RDP correctly rejected for Linux server")


class TestServerEndpoints:
    """Server-related endpoint tests"""
    
    def test_list_servers(self, auth_headers):
        """Test listing servers"""
        response = requests.get(f"{BASE_URL}/api/servers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # Should have demo servers
        print(f"✓ Server list returned {len(data)} servers")
    
    def test_get_server_detail(self, auth_headers, linux_server_id):
        """Test getting server details"""
        if not linux_server_id:
            pytest.skip("No Linux server available")
        
        response = requests.get(f"{BASE_URL}/api/servers/{linux_server_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "hostname" in data
        assert "ip_address" in data
        assert "os_type" in data
        print(f"✓ Server detail retrieved: {data['hostname']}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_alert_rules(self, auth_headers):
        """Clean up TEST_ prefixed alert rules"""
        response = requests.get(f"{BASE_URL}/api/alert-rules", headers=auth_headers)
        if response.status_code == 200:
            rules = response.json()
            for rule in rules:
                if rule["name"].startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/alert-rules/{rule['id']}", headers=auth_headers)
                    print(f"  Cleaned up rule: {rule['name']}")
        print("✓ Test data cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
