from pathlib import Path
import runpy


root_server = Path(__file__).resolve().parents[2] / "server.py"
runpy.run_path(str(root_server), run_name="__main__")
