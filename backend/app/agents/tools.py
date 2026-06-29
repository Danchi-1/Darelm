import os
import json
import pandas as pd
from sqlalchemy.orm import Session
from app.db.models import Dataset
from app.core.config import settings

def get_dataset_context(dataset_id: str, db: Session) -> dict:
    """
    Reads the dataset from the database and extracts the schema and sample rows using pandas.
    Returns a dictionary to be injected into the system prompt or returned by a tool.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        return {"error": "Dataset not found"}

    result = {
        "dataset_name": dataset.name,
        "dataset_type": dataset.dataset_type,
        "size_bytes": dataset.size_bytes,
        "url_or_connection": dataset.storage_url or dataset.connection_string,
        "schema": None,
        "sample": None
    }

    # Extract schema if it's a file
    if dataset.dataset_type.lower() in ["csv", "excel"] and dataset.storage_url:
        try:
            # Handle local fallback vs full URL
            path = dataset.storage_url
            if path.startswith("local://"):
                path = path.replace("local://", "")
                
            if not path.startswith("http"):
                path = os.path.abspath(path)
                # Fallback to compressed file if original was deleted by async task
                if not os.path.exists(path) and os.path.exists(f"{path}.gz"):
                    path = f"{path}.gz"
                    result["url_or_connection"] = path

            if dataset.dataset_type.lower() == "csv":
                df = pd.read_csv(path, nrows=5)
            else:
                df = pd.read_excel(path, nrows=5)
            
            # Format schema
            schema_dict = {col: str(dtype) for col, dtype in df.dtypes.items()}
            result["schema"] = schema_dict
            result["sample"] = df.to_dict(orient="records")
        except Exception as e:
            result["error_loading_schema"] = str(e)
            
    return result

def execute_python_sandbox(code: str, dataset_path: str = None, sandbox_filename: str = None) -> str:
    """
    Executes AI-generated Python code in a secure E2B sandbox.
    """
    from e2b_code_interpreter import Sandbox
    
    if not settings.E2B_API_KEY:
        return "Error: E2B_API_KEY is not configured. Sandbox execution unavailable."

    os.environ["E2B_API_KEY"] = settings.E2B_API_KEY

    try:
        with Sandbox.create() as sandbox:
            if dataset_path and sandbox_filename and not dataset_path.startswith("http"):
                try:
                    if dataset_path.startswith("local://"):
                        dataset_path = dataset_path.replace("local://", "")
                    abs_path = os.path.abspath(dataset_path)
                    
                    if abs_path.endswith('.gz'):
                        # Chunked upload for compressed massive datasets
                        with open(abs_path, 'rb') as f:
                            chunk_size = 5 * 1024 * 1024
                            part_num = 0
                            while True:
                                chunk = f.read(chunk_size)
                                if not chunk:
                                    break
                                sandbox.files.write(f"{sandbox_filename}.gz.part{part_num}", chunk)
                                part_num += 1
                        # Reconstruct and unzip inside sandbox
                        sandbox.commands.run(f"cat {sandbox_filename}.gz.part* > {sandbox_filename}.gz && rm {sandbox_filename}.gz.part*")
                        # Prepend python code to unzip the dataset before the AI code runs
                        unzip_code = f"import gzip, shutil; \nwith gzip.open('{sandbox_filename}.gz', 'rb') as f_in:\n  with open('{sandbox_filename}', 'wb') as f_out:\n    shutil.copyfileobj(f_in, f_out)\n"
                        code = unzip_code + code
                    else:
                        with open(abs_path, 'rb') as f:
                            sandbox.files.write(sandbox_filename, f.read())
                except Exception as e:
                    return f"Error uploading dataset to sandbox: {str(e)}"
                    
            execution = sandbox.run_code(code)
            
            output = ""
            if execution.logs.stdout:
                output += "STDOUT:\n" + "\n".join(execution.logs.stdout) + "\n"
            if execution.logs.stderr:
                output += "STDERR:\n" + "\n".join(execution.logs.stderr) + "\n"
            if execution.error:
                output += "ERROR:\n" + execution.error.name + ": " + execution.error.value
                
            return output if output else "Execution successful. No output."
    except Exception as e:
        return f"Sandbox initialization error: {str(e)}"
