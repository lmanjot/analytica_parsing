import requests
import json

# Your example HL7 data
hl7_sample = r"""MSH|^~\&|ANALYTICA|ANALYTICA|||20250925120306||ORU^R01|27061608|P|2.4||||||8859
PID|1||2149273^^^^^ANALYTICA||KALINOVIC^GORAN||19960401|M|||ADR^^CITY^CITY^ZIP^COUNTRY||TEL||
PV1|1|U||||||||||||||||||
ORC|NW|0125395972MISC^ANALYTICA|0125395972MISC^ANALYTICA|0125395972^ANALYTICA|CM||^^^20250924183444^^R|||||NICHR^NIEHUS^CHRISTIAN^^^^^ANALYTICA|||
OBR|0|0125395972MISC^ANALYTICA|0125395972MISC^ANALYTICA|MISC^ANALYTICA||20250924183444||||||||||NICHR^NIEHUS^CHRISTIAN^^^^^ANALYTICA|||||||||||^^^20250924183444^^R
OBX|1|NM|LEUK^Leukozyten^ANALYTICA||7.3|G/l^^L|3.9-10.2||||F||||||||
OBX|2|NM|ERY^Erythrozyten^ANALYTICA||5.30|T/l^^L|4.30-5.75||||F||||||||
OBX|3|NM|HB^Hämoglobin^ANALYTICA||15.4|g/dl^^L|13.5-17.2||||F||||||||
OBX|4|NM|HKT^Hämatokrit^ANALYTICA||44.9|%^^L|39.5-50.5||||F||||||||
OBX|5|NM|MCV^MCV^ANALYTICA||84.7|fl^^L|80-99||||F||||||||
OBX|6|NM|MCH^MCH^ANALYTICA||29.1|pg^^L|27.0-33.5||||F||||||||
OBX|7|NM|MCHC^MCHC^ANALYTICA||34.3|g/dl^^L|31.5-36.0||||F||||||||
OBX|8|NM|RDW^EC-Anisozytose (RDW-CV)^ANALYTICA||12.6|%^^L|11.5-15.0||||F||||||||
OBX|9|NM|THRO^Thrombozyten^ANALYTICA||231|G/l^^L|150-370||||F||||||||
OBX|10|NM|CRP^CRP^ANALYTICA||<0.6|mg/l^^L|<5||||F||||||||
OBX|11|NM|FERR^Ferritin^ANALYTICA||70|ug/l^^L|22-322||||F||||||||
NTE|1||Kommentar zu Ferritin:|R
NTE|2||Werte < 30 ug/l können auf einen Eisenmangel hinweisen. Bei chronischen Erkrankungen (Herzinsuffizienz, entzündliche Darmerkrankungen, Tumorleiden) gelten Zielwerte > 100 ug/l. Bei Patienten mit chronischer Niereninsuffizienz oder Restless-Legs-Syndrom gelten ebenfalls höhere Grenzwerte. Siehe Detailangaben im Analysenverzeichnis. |R
NTE|3||Bei Patienten mit chronisch-entzündlichen Erkrankungen kann die Bestimmung der Transferrinsättigung sinnvoll sein.|R
OBX|12|NM|ZINK^Zink^ANALYTICA||10.6|umol/l^^L|8.7-17.6||||F||||||||
OBX|13|NM|VITD3^25-OH-Vitamin D^ANALYTICA||28|ug/l^^L|>20||||F||||||||
NTE|1|| 
NTE|2||Beurteilung des Vitamin D-Status gemäss BLV (Bundesamt für Lebensmittelsicherheit und Veterinärwesen):
NTE|3||    < 10 ug/l Schwerer Mangel
NTE|4||10 - 20 ug/l Mangel
NTE|5||    > 20 ug/l Ausreichende Vitamin D-Versorgung
NTE|6||    > 30 ug/l Zielwert für Sturz/Frakturprävention
OBX|14|NM|TSH^TSH basal^ANALYTICA||1.06|mU/l^^L|0.55-4.78||||F||||||||
OBX|15|NM|CORT8^Cortisol 8 Uhr^ANALYTICA||515|nmol/l^^L|133-537||||F||||||||"""

def test_local_parser():
    """Test the parser locally without API"""
    from main import parse_hl7_message
    
    try:
        result = parse_hl7_message(hl7_sample)
        print("Local parsing successful!")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return True
    except Exception as e:
        print(f"Local parsing failed: {e}")
        return False

def test_api_endpoint():
    """Test the API endpoint"""
    url = "http://localhost:8000/parse-hl7"
    payload = {"hl7_data": hl7_sample}
    
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
    print("Testing HL7 Parser...")
    print("=" * 50)
    
    # Test local parser first
    print("1. Testing local parser...")
    local_success = test_local_parser()
    
    print("\n" + "=" * 50)
    print("2. Testing API endpoint (make sure server is running)...")
    api_success = test_api_endpoint()
    
    print("\n" + "=" * 50)
    print(f"Results: Local={local_success}, API={api_success}")