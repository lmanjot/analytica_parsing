const express = require('express');
const { Client } = require('ssh2');
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

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

// Helper function to get field value by position
function getField(parts, index) {
    return parts[index] || '';
}

// Helper function to get subfield value
function getSubfield(field, index) {
    if (!field) return '';
    const subfields = field.split('^');
    return subfields[index] || '';
}

// Helper function to format date from YYYYMMDD to ISO
function formatDate(hl7Date) {
    if (!hl7Date || hl7Date.length !== 8) return hl7Date;
    return `${hl7Date.substring(0,4)}-${hl7Date.substring(4,6)}-${hl7Date.substring(6,8)}`;
}

// Helper function to format datetime from HL7 timestamp
function formatDateTime(hl7DateTime) {
    if (!hl7DateTime || hl7DateTime.length < 8) return hl7DateTime;
    const date = hl7DateTime.substring(0,8);
    const time = hl7DateTime.substring(8);
    if (time.length >= 6) {
        return `${formatDate(date)}T${time.substring(0,2)}:${time.substring(2,4)}:${time.substring(4,6)}`;
    }
    return formatDate(date);
}

function parseMessageHeader(parts) {
    const messageTypeField = getField(parts, 9);
    const messageTypeParts = messageTypeField.split('^');
    
    return {
        sendingApp: getField(parts, 3),
        sendingFacility: getField(parts, 4),
        messageDateTime: formatDateTime(getField(parts, 7)),
        messageType: {
            id: messageTypeParts[0] || '',
            trigger: messageTypeParts[1] || ''
        },
        controlId: getField(parts, 10),
        processingId: getField(parts, 11),
        version: getField(parts, 12),
        charset: getField(parts, 18) || undefined
    };
}

function parsePatient(parts) {
    const idField = getField(parts, 3);
    const nameField = getField(parts, 5);
    const addressField = getField(parts, 11);
    
    const patient = {
        id: getSubfield(idField, 0),
        assigningAuthority: getSubfield(idField, 5) || undefined,
        lastName: getSubfield(nameField, 0),
        firstName: getSubfield(nameField, 1),
        birthDate: formatDate(getField(parts, 7)),
        sex: getField(parts, 8),
        phone: getField(parts, 13) || undefined
    };
    
    if (addressField) {
        patient.address = {
            street: getSubfield(addressField, 0) || undefined,
            city: getSubfield(addressField, 2) || undefined,
            state: getSubfield(addressField, 3) || undefined,
            zip: getSubfield(addressField, 4) || undefined,
            country: getSubfield(addressField, 5) || undefined
        };
    }
    
    return patient;
}

function parseOrder(parts) {
    const orderingProviderField = getField(parts, 12);
    const orderDateTimeField = getField(parts, 7);
    
    const order = {
        placerOrderNumber: getSubfield(getField(parts, 2), 0) || undefined,
        fillerOrderNumber: getSubfield(getField(parts, 3), 0) || undefined,
        orderControl: getField(parts, 1),
        orderDateTime: getSubfield(orderDateTimeField, 3) ? formatDateTime(getSubfield(orderDateTimeField, 3)) : undefined
    };
    
    if (orderingProviderField) {
        order.orderingProvider = {
            id: getSubfield(orderingProviderField, 0) || undefined,
            last: getSubfield(orderingProviderField, 1) || undefined,
            first: getSubfield(orderingProviderField, 2) || undefined,
            authority: getSubfield(orderingProviderField, 7) || undefined
        };
    }
    
    return order;
}

function parseObservationRequest(parts) {
    const panelField = getField(parts, 4);
    const orderingProviderField = getField(parts, 16);
    const resultDateTimeField = getField(parts, 27);
    
    const obr = {
        panelCode: getSubfield(panelField, 0),
        panelText: getSubfield(panelField, 1) || undefined,
        obrDateTime: formatDateTime(getField(parts, 7)) || undefined,
        resultDateTime: getSubfield(resultDateTimeField, 3) ? formatDateTime(getSubfield(resultDateTimeField, 3)) : undefined
    };
    
    if (orderingProviderField) {
        obr.orderingProvider = {
            id: getSubfield(orderingProviderField, 0) || undefined,
            last: getSubfield(orderingProviderField, 1) || undefined,
            first: getSubfield(orderingProviderField, 2) || undefined,
            authority: getSubfield(orderingProviderField, 7) || undefined
        };
    }
    
    return obr;
}

function parseObservation(parts) {
    const codeField = getField(parts, 3);
    const unitsField = getField(parts, 6);
    
    return {
        setId: parseInt(getField(parts, 1)) || 0,
        valueType: getField(parts, 2),
        code: getSubfield(codeField, 0),
        text: getSubfield(codeField, 1),
        system: getSubfield(codeField, 2) || undefined,
        value: getField(parts, 5),
        units: getSubfield(unitsField, 0) || undefined,
        refRange: getField(parts, 7) || undefined,
        abnormalFlags: getField(parts, 8) || undefined,
        status: getField(parts, 11),
        observationDateTime: getField(parts, 14) ? formatDateTime(getField(parts, 14)) : undefined,
        notes: [] // Will be populated with associated NTE segments
    };
}

function parseHL7Message(hl7Data) {
    // Clean up the data - replace \r with \n and handle different line endings
    const cleanedData = hl7Data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleanedData.split('\n').map(line => line.trim()).filter(line => line);
    
    console.log('Number of lines found:', lines.length);
    
    if (lines.length === 0) {
        throw new Error("Empty HL7 message");
    }
    
    let messageHeader = null;
    let patient = null;
    const orders = [];
    const observationRequests = [];
    const observations = [];
    const notes = [];
    
    let currentObservation = null;
    
    for (const line of lines) {
        const parts = line.split('|');
        const segmentType = parts[0];
        
        switch (segmentType) {
            case 'MSH':
                messageHeader = parseMessageHeader(parts);
                break;
                
            case 'PID':
                patient = parsePatient(parts);
                break;
                
            case 'ORC':
                orders.push(parseOrder(parts));
                break;
                
            case 'OBR':
                observationRequests.push(parseObservationRequest(parts));
                break;
                
            case 'OBX':
                currentObservation = parseObservation(parts);
                observations.push(currentObservation);
                break;
                
            case 'NTE':
                const noteText = getField(parts, 3);
                if (currentObservation && noteText) {
                    currentObservation.notes.push(noteText);
                } else if (noteText) {
                    notes.push({
                        setId: parseInt(getField(parts, 1)) || 0,
                        text: noteText
                    });
                }
                break;
        }
    }
    
    return {
        messageHeader,
        patient,
        orders,
        observationRequests,
        observations,
        notes,
        messageType: messageHeader?.messageType?.id || 'Unknown',
        totalSegments: lines.length
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

app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'API is working',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/test-parse', (req, res) => {
    try {
        console.log('Test parse endpoint called');
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
        console.error('Test parse error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Also add a GET version for easier testing
app.get('/api/test-parse', (req, res) => {
    try {
        console.log('Test parse GET endpoint called');
        const sampleHL7 = `MSH|^~\\&|TEST|TEST|||20250101120000||ORU^R01|123|P|2.4
PID|1||12345||TEST^PATIENT||19900101|M|||ADR^^CITY^STATE^ZIP^COUNTRY||TEL||
OBX|1|NM|TEST^Test Result^TEST||10.5|mg/dl^^L|5.0-15.0||||F||||||||`;
        
        console.log('Sample HL7 data:', sampleHL7);
        const parsedData = parseHL7Message(sampleHL7);
        console.log('Parsed data:', JSON.stringify(parsedData, null, 2));
        
        res.json({
            status: 'success',
            message_type: parsedData.message_type,
            segments: parsedData.all_segments.length,
            test: 'HL7 parsing works',
            method: 'GET',
            debug: {
                msh_fields: parsedData.message_header[0]?.fields?.length || 0,
                total_segments: parsedData.all_segments.length
            }
        });
    } catch (error) {
        console.error('Test parse error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            status: 'error', 
            message: error.message,
            stack: error.stack
        });
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