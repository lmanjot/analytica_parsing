import requests
import json

def test_sftp_api():
    """Test the SFTP-based HL7 parser API"""
    url = 'http://localhost:8000/parse-hl7'
    
    # Test with a sample file path
    payload = {
        "file_path": "/path/to/sample.hl7"  # Replace with actual file path
    }
    
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            print('✅ API test successful!')
            result = response.json()
            print(f'File path: {result["file_path"]}')
            print(f'Message type: {result["message_type"]}')
            print(f'Number of segments: {len(result["segments"])}')
            print('Segments found:')
            for segment in result["segments"]:
                print(f'  - {segment["segment_type"]} ({len(segment["fields"])} fields)')
        else:
            print(f'❌ API test failed with status {response.status_code}: {response.text}')
    except Exception as e:
        print(f'❌ API test failed: {e}')

def test_api_endpoint():
    """Test the API endpoint"""
    url = "http://localhost:8000/parse-hl7"
    payload = {"file_path": "/test/sample.hl7"}
    
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            print("API test successful!")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
            return True
        else:
            print(f"API test failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"API test failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing HL7 SFTP Parser API...")
    print("=" * 50)
    
    print("1. Testing API endpoint (make sure server is running)...")
    api_success = test_api_endpoint()
    
    print("\n" + "=" * 50)
    print(f"Results: API={api_success}")
    print("\nNote: This test requires:")
    print("- SFTP credentials in environment variables (SFTP_USERNAME, SFTP_PASSWORD)")
    print("- Valid file path on the SFTP server")
    print("- Server running on localhost:8000")