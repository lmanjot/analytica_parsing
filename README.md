# HL7 Parser API

A FastAPI-based web service that receives HL7 format data, parses it, and returns structured JSON.

## Features

- **HL7 v2.4 Support**: Parses HL7 ORU (Observation Result Unsolicited) messages
- **Segment Parsing**: Supports all major HL7 segments including MSH, PID, PV1, ORC, OBR, OBX, NTE, SPM
- **Field Decomposition**: Automatically parses subfields separated by `^` characters
- **JSON Output**: Returns well-structured JSON with grouped segments and metadata
- **Error Handling**: Comprehensive error handling with meaningful error messages
- **FastAPI**: Modern, fast web framework with automatic API documentation

## Supported HL7 Segments

- **MSH** (Message Header) - Contains message metadata
- **PID** (Patient Identification) - Patient demographic information
- **PV1** (Patient Visit) - Visit/encounter information
- **ORC** (Common Order) - Order control information
- **OBR** (Observation Request) - Test/observation request details
- **OBX** (Observation/Result) - Test results and values
- **NTE** (Notes and Comments) - Additional notes and comments
- **SPM** (Specimen) - Specimen information

## Installation

1. **Clone or download the project files**

2. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

## Usage

### Starting the Server

```bash
# Option 1: Using the run script
python run_server.py

# Option 2: Using uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The server will start on `http://localhost:8000`

### API Documentation

Once the server is running, you can access:
- **Interactive API docs**: http://localhost:8000/docs
- **Alternative docs**: http://localhost:8000/redoc
- **Health check**: http://localhost:8000/health

### API Endpoints

#### POST /parse-hl7

Parses HL7 data and returns structured JSON.

**Request Body:**
```json
{
  "hl7_data": "MSH|^~\\&|ANALYTICA|ANALYTICA|||20250925120306||ORU^R01|27061608|P|2.4||||||8859\nPID|1||2149273^^^^^ANALYTICA||KALINOVIC^GORAN||19960401|M|||ADR^^CITY^CITY^ZIP^COUNTRY||TEL||"
}
```

**Response:**
```json
{
  "parsed_data": {
    "message_header": [...],
    "patient_identification": [...],
    "patient_visit": [...],
    "common_order": [...],
    "observation_request": [...],
    "observations": [...],
    "notes": [...],
    "specimen": [...],
    "all_segments": [...],
    "segment_counts": {...},
    "message_type": "ORU"
  },
  "message_type": "ORU",
  "segments": [...]
}
```

### Example Usage

#### Using curl:
```bash
curl -X POST "http://localhost:8000/parse-hl7" \
     -H "Content-Type: application/json" \
     -d '{
       "hl7_data": "MSH|^~\\&|ANALYTICA|ANALYTICA|||20250925120306||ORU^R01|27061608|P|2.4||||||8859\nPID|1||2149273^^^^^ANALYTICA||KALINOVIC^GORAN||19960401|M|||ADR^^CITY^CITY^ZIP^COUNTRY||TEL||"
     }'
```

#### Using Python:
```python
import requests

hl7_data = """MSH|^~\\&|ANALYTICA|ANALYTICA|||20250925120306||ORU^R01|27061608|P|2.4||||||8859
PID|1||2149273^^^^^ANALYTICA||KALINOVIC^GORAN||19960401|M|||ADR^^CITY^CITY^ZIP^COUNTRY||TEL||"""

response = requests.post(
    "http://localhost:8000/parse-hl7",
    json={"hl7_data": hl7_data}
)

if response.status_code == 200:
    result = response.json()
    print(f"Message type: {result['message_type']}")
    print(f"Number of segments: {len(result['segments'])}")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

## Testing

Run the test script to verify everything works:

```bash
python test_hl7.py
```

This will test both the local parser and the API endpoint.

## JSON Output Structure

The API returns a structured JSON with the following main sections:

- **message_header**: MSH segments with message metadata
- **patient_identification**: PID segments with patient info
- **patient_visit**: PV1 segments with visit details
- **common_order**: ORC segments with order information
- **observation_request**: OBR segments with test requests
- **observations**: OBX segments with test results
- **notes**: NTE segments with comments
- **specimen**: SPM segments with specimen info
- **all_segments**: Complete list of all parsed segments
- **segment_counts**: Count of each segment type
- **message_type**: Extracted message type (e.g., "ORU")

Each segment contains:
- **segment_type**: The HL7 segment identifier (MSH, PID, etc.)
- **segment_number**: Sequential number for repeated segments
- **fields**: Array of parsed fields with field numbers and values
- **subfields**: For fields containing `^` separators

## Error Handling

The API provides comprehensive error handling:
- Invalid HL7 format returns HTTP 400 with error details
- Empty messages are rejected
- Parsing errors include specific error messages
- Server errors return HTTP 500 with error information

## Requirements

- Python 3.8+
- FastAPI 0.110.0+
- Uvicorn 0.27.0+
- Pydantic 2.6.0+

## License

This project is provided as-is for HL7 parsing needs.