from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import paramiko
import os
import io

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

def download_file_from_sftp(file_path: str) -> str:
    """Download file from SFTP server and return content as string"""
    try:
        # Get credentials from environment variables
        username = os.getenv('SFTP_USERNAME')
        password = os.getenv('SFTP_PASSWORD')
        hostname = 'anacom.analytica.ch'
        
        if not username or not password:
            raise ValueError("SFTP credentials not found in environment variables")
        
        # Create SFTP connection
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        ssh.connect(hostname, username=username, password=password)
        sftp = ssh.open_sftp()
        
        # Download file content
        with sftp.open(file_path, 'r') as remote_file:
            content = remote_file.read().decode('utf-8')
        
        sftp.close()
        ssh.close()
        
        return content
        
    except Exception as e:
        raise Exception(f"Failed to download file from SFTP: {str(e)}")

@app.post("/parse-hl7", response_model=HL7Response)
async def parse_hl7_file(request: FilePathRequest):
    """
    Parse HL7 file from SFTP server and return as JSON
    """
    try:
        # Download file from SFTP
        hl7_content = download_file_from_sftp(request.file_path)
        
        # Parse HL7 content
        parsed_data = parse_hl7_message(hl7_content)
        
        return HL7Response(
            parsed_data=parsed_data,
            message_type=parsed_data["message_type"],
            segments=parsed_data["all_segments"],
            file_path=request.file_path
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing HL7 file: {str(e)}")

@app.get("/")
async def root():
    return {"message": "HL7 Parser API", "version": "1.0.0", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "HL7 Parser API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)