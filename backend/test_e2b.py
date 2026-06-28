import os
from e2b_code_interpreter import Sandbox
from dotenv import load_dotenv

load_dotenv()
with Sandbox.create() as sandbox:
    print("Writing to sandbox...")
    try:
        sandbox.files.write("/home/user/test.txt", b"hello world bytes")
        print("Write succeeded!")
    except Exception as e:
        print("Write failed:", e)
        
    execution = sandbox.run_code("import os; print(os.listdir('/home/user'))")
    if execution.logs.stdout:
        print("Output:", execution.logs.stdout)
