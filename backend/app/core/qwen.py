# Backwards-compatibility shim: qwen.py is deprecated in favor of llm.py
from app.core.llm import LLMClient as QwenClient, llm_client as qwen_client  # noqa: F401
