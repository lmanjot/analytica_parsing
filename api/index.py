from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import os

app = FastAPI(title="HL7 Parser API", description="Parse HL7 files from SFTP server")

class FilePathRequest(BaseModel):
    file_path: str

class HL7Response(BaseModel):
    parsed_data: Dict[str, Any]
    message_type: str
    segments: List[Dict[str, Any]]
    file_path: str

def parse_hl7_segment(segment: str) -> Dict[str, Any]:
    """Parse a single HL7 segment into structured data"""
    parts = segment.split('|')
    segment_type = parts[0]
    
    parsed_segment = {
        "segment_type": segment_type,
        "fields": []
    }
    
    # Parse fields based on segment type
    for i, field in enumerate(parts[1:], 1):
        if field:
            # Handle repeated fields (separated by ^)
            if '^' in field:
                subfields = field.split('^')
                parsed_field = {
                    "field_number": i,
                    "value": field,
                    "subfields": subfields
                }
            else:
                parsed_field = {
                    "field_number": i,
                    "value": field
                }
            parsed_segment["fields"].append(parsed_field)
    
    return parsed_segment

def parse_hl7_message(hl7_data: str) -> Dict[str, Any]:
    """Parse complete HL7 message into structured JSON"""
    lines = [line.strip() for line in hl7_data.strip().split('\n') if line.strip()]
    
    if not lines:
        raise ValueError("Empty HL7 message")
    
    # Parse MSH segment first to get message type
    msh_segment = parse_hl7_segment(lines[0])
    message_type = "Unknown"
    
    if msh_segment["fields"] and len(msh_segment["fields"]) >= 8:
        message_type_field = msh_segment["fields"][8]["value"]  # MSH.9
        if '^' in message_type_field:
            message_type = message_type_field.split('^')[0]
        else:
            message_type = message_type_field
    
    # Parse all segments
    segments = []
    segment_counts = {}
    
    for line in lines:
        segment = parse_hl7_segment(line)
        segment_type = segment["segment_type"]
        
        # Count segments for grouping
        if segment_type not in segment_counts:
            segment_counts[segment_type] = 0
        segment_counts[segment_type] += 1
        
        # Add segment number for repeated segments
        segment["segment_number"] = segment_counts[segment_type]
        segments.append(segment)
    
    # Group segments by type
    grouped_segments = {}
    for segment in segments:
        seg_type = segment["segment_type"]
        if seg_type not in grouped_segments:
            grouped_segments[seg_type] = []
        grouped_segments[seg_type].append(segment)
    
    return {
        "message_header": grouped_segments.get("MSH", []),
        "patient_identification": grouped_segments.get("PID", []),
        "patient_visit": grouped_segments.get("PV1", []),
        "common_order": grouped_segments.get("ORC", []),
        "observation_request": grouped_segments.get("OBR", []),
        "observations": grouped_segments.get("OBX", []),
        "notes": grouped_segments.get("NTE", []),
        "specimen": grouped_segments.get("SPM", []),
        "all_segments": segments,
        "segment_counts": segment_counts,
        "message_type": message_type
    }

@app.get("/")
async def root():
    return {"message": "HL7 Parser API", "version": "1.0.0", "status": "running"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "HL7 Parser API"}

@app.post("/api/test-parse")
async def test_parse():
    """Test parsing with sample HL7 data"""
    try:
        sample_hl7 = """MSH|^~\\&|TEST|TEST|||20250101120000||ORU^R01|123|P|2.4
PID|1||12345||TEST^PATIENT||19900101|M|||ADR^^CITY^STATE^ZIP^COUNTRY||TEL||
OBX|1|NM|TEST^Test Result^TEST||10.5|mg/dl^^L|5.0-15.0||||F||||||||"""
        
        parsed_data = parse_hl7_message(sample_hl7)
        return {
            "status": "success",
            "message_type": parsed_data["message_type"],
            "segments": len(parsed_data["all_segments"]),
            "test": "HL7 parsing works"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/test-sftp")
async def test_sftp_connection():
    """Test SFTP connection and environment variables"""
    try:
        username = os.getenv('SFTP_USERNAME')
        password = os.getenv('SFTP_PASSWORD')
        
        return {
            "status": "ok",
            "username_set": bool(username),
            "password_set": bool(password),
            "username_preview": username[:3] + "***" if username else "Not set",
            "hostname": "anacom.analytica.ch"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/parse-hl7", response_model=HL7Response)
async def parse_hl7_file(request: FilePathRequest):
    """
    Parse HL7 file from SFTP server and return as JSON
    """
    try:
        # For now, return a placeholder response
        # We'll add SFTP functionality once basic parsing works
        return HL7Response(
            parsed_data={"message": "SFTP functionality temporarily disabled for debugging"},
            message_type="TEST",
            segments=[],
            file_path=request.file_path
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing HL7 file: {str(e)}")

# For Vercel deployment
def handler(request):
    return app