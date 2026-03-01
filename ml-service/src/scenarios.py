from typing import Dict, List, Optional

SCENARIOS = {
    "scenario_1": {
        "id": "scenario_1",
        "name": "Cerah Berawan (Clear)",
        "description": "Kondisi normal, tidak ada hujan.",
        "data": {
            "rainfall_bogor": 0.0, 
            "rainfall_jakarta": 0.0, 
            "tma_manggarai": 300.0
        },
        "god_mode_enabled": False
    },
    "scenario_2": {
        "id": "scenario_2",
        "name": "Hujan Ringan (Light Rain)",
        "description": "Hujan intensitas rendah, aman.",
        "data": {
            "rainfall_bogor": 20.0, 
            "rainfall_jakarta": 10.0, 
            "tma_manggarai": 450.0
        },
        "god_mode_enabled": False
    },
    "scenario_3": {
        "id": "scenario_3",
        "name": "Banjir Historis (Historical)",
        "description": "Simulasi data banjir Jakarta 2020.",
        "data": {
            "rainfall_bogor": 150.0, 
            "rainfall_jakarta": 85.0, 
            "tma_manggarai": 950.0
        },
        "god_mode_enabled": False
    },
    "scenario_4": {
        "id": "scenario_4",
        "name": "Badai Ekstrem (Extreme)",
        "description": "Curah hujan sangat tinggi.",
        "data": {
            "rainfall_bogor": 200.0, 
            "rainfall_jakarta": 150.0, 
            "tma_manggarai": 1000.0
        },
        "god_mode_enabled": False
    },
    "scenario_demo": {
        "id": "scenario_demo",
        "name": "GOD MODE (Force Critical)",
        "description": "Override sistem untuk demo darurat.",
        "data": {
            "rainfall_bogor": 999.9, 
            "rainfall_jakarta": 999.9, 
            "tma_manggarai": 1100.0
        },
        "god_mode_enabled": True
    }
}

def get_scenario(scenario_id: str) -> Optional[Dict]:
    return SCENARIOS.get(scenario_id)

def list_scenarios() -> List[Dict]:
    return list(SCENARIOS.values())
