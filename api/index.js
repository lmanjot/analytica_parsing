const express = require('express');
const { Client } = require('ssh2');
const app = express();

app.use(express.json());

// HL7 Parser Functions
function parseHL7Segment(segment) {
    const parts = segment.split('|');
    const segmentType = parts[0];
    
    const parsedSegment = {
        segment_type: segmentType,
        fields: []
    };
    
    // Parse fields based on segment type
    for (let i = 1; i < parts.length; i++) {
        const field = parts[i];
        if (field) {
            // Handle repeated fields (separated by ^)
            if (field.includes('^')) {
                const subfields = field.split('^');
                const parsedField = {
                    field_number: i,
                    value: field,
                    subfields: subfields
                };
                parsedSegment.fields.push(parsedField);
            } else {
                const parsedField = {
                    field_number: i,
                    value: field
                };
                parsedSegment.fields.push(parsedField);
            }
        }
    }
    
    return parsedSegment;
}

function parseHL7Message(hl7Data) {
    const lines = hl7Data.trim().split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) {
        throw new Error("Empty HL7 message");
    }
    
    // Parse MSH segment first to get message type
    const mshSegment = parseHL7Segment(lines[0]);
    let messageType = "Unknown";
    
    if (mshSegment.fields && mshSegment.fields.length >= 8) {
        const messageTypeField = mshSegment.fields[8].value; // MSH.9
        if (messageTypeField.includes('^')) {
            messageType = messageTypeField.split('^')[0];
        } else {
            messageType = messageTypeField;
        }
    }
    
    // Parse all segments
    const segments = [];
    const segmentCounts = {};
    
    for (const line of lines) {
        const segment = parseHL7Segment(line);
        const segmentType = segment.segment_type;
        
        // Count segments for grouping
        if (!segmentCounts[segmentType]) {
            segmentCounts[segmentType] = 0;
        }
        segmentCounts[segmentType]++;
        
        // Add segment number for repeated segments
        segment.segment_number = segmentCounts[segmentType];
        segments.push(segment);
    }
    
    // Group segments by type
    const groupedSegments = {};
    for (const segment of segments) {
        const segType = segment.segment_type;
        if (!groupedSegments[segType]) {
            groupedSegments[segType] = [];
        }
        groupedSegments[segType].push(segment);
    }
    
    return {
        message_header: groupedSegments.MSH || [],
        patient_identification: groupedSegments.PID || [],
        patient_visit: groupedSegments.PV1 || [],
        common_order: groupedSegments.ORC || [],
        observation_request: groupedSegments.OBR || [],
        observations: groupedSegments.OBX || [],
        notes: groupedSegments.NTE || [],
        specimen: groupedSegments.SPM || [],
        all_segments: segments,
        segment_counts: segmentCounts,
        message_type: messageType
    };
}

function downloadFileFromSFTP(filePath) {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        
        conn.on('ready', () => {
            conn.sftp((err, sftp) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                sftp.readFile(filePath, 'utf8', (err, data) => {
                    conn.end();
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(data);
                });
            });
        });
        
        conn.on('error', (err) => {
            reject(err);
        });
        
        const username = process.env.SFTP_USERNAME;
        const password = process.env.SFTP_PASSWORD;
        const hostname = 'anacom.analytica.ch';
        
        if (!username || !password) {
            reject(new Error('SFTP credentials not found in environment variables'));
            return;
        }
        
        conn.connect({
            host: hostname,
            username: username,
            password: password,
            readyTimeout: 30000
        });
    });
}

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'HL7 Parser API', version: '1.0.0', status: 'running' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', service: 'HL7 Parser API' });
});

app.post('/api/test-parse', (req, res) => {
    try {
        const sampleHL7 = `MSH|^~\\&|TEST|TEST|||20250101120000||ORU^R01|123|P|2.4
PID|1||12345||TEST^PATIENT||19900101|M|||ADR^^CITY^STATE^ZIP^COUNTRY||TEL||
OBX|1|NM|TEST^Test Result^TEST||10.5|mg/dl^^L|5.0-15.0||||F||||||||`;
        
        const parsedData = parseHL7Message(sampleHL7);
        res.json({
            status: 'success',
            message_type: parsedData.message_type,
            segments: parsedData.all_segments.length,
            test: 'HL7 parsing works'
        });
    } catch (error) {
        res.json({ status: 'error', message: error.message });
    }
});

app.post('/api/test-sftp', (req, res) => {
    try {
        const username = process.env.SFTP_USERNAME;
        const password = process.env.SFTP_PASSWORD;
        
        res.json({
            status: 'ok',
            username_set: !!username,
            password_set: !!password,
            username_preview: username ? username.substring(0, 3) + '***' : 'Not set',
            hostname: 'anacom.analytica.ch'
        });
    } catch (error) {
        res.json({ status: 'error', message: error.message });
    }
});

app.post('/api/parse-hl7', async (req, res) => {
    try {
        const { file_path } = req.body;
        
        if (!file_path) {
            return res.status(400).json({ error: 'file_path is required' });
        }
        
        // Download file from SFTP
        const hl7Content = await downloadFileFromSFTP(file_path);
        
        // Parse HL7 content
        const parsedData = parseHL7Message(hl7Content);
        
        res.json({
            parsed_data: parsedData,
            message_type: parsedData.message_type,
            segments: parsedData.all_segments,
            file_path: file_path
        });
        
    } catch (error) {
        res.status(400).json({ error: `Error processing HL7 file: ${error.message}` });
    }
});

// Export for Vercel
module.exports = app;