import json
import asyncio
from openai import AsyncOpenAI
from app.core.config import settings

class QwenClient:
    def _get_client_and_model(self):
        # We prioritize OpenRouter for the mock if available
        if settings.OPENROUTER_API_KEY:
            client = AsyncOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY
            )
            return client, "qwen/qwen-2.5-72b-instruct"
        elif settings.QWEN_API_KEY:
            client = AsyncOpenAI(
                base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
                api_key=settings.QWEN_API_KEY
            )
            return client, "qwen-plus"
        return None, None

    async def stream_chat(self, prompt: str, system_prompt: str, dataset_context: dict = None):
        """
        Yields server-sent events. Orchestrates the ReAct loop if tools are called.
        """
        client, model_name = self._get_client_and_model()
        if not client:
            yield f"data: {json.dumps({'error': 'No AI configured.'})}\n\n"
            return

        from app.agents.tools import execute_python_sandbox
        
        # Build the initial context
        context_msg = "You have no datasets loaded."
        if dataset_context:
            context_msg = f"""
Dataset Loaded:
- Name: {dataset_context.get('dataset_name')}
- URL/Connection: {dataset_context.get('url_or_connection')}
- Schema: {json.dumps(dataset_context.get('schema'))}
"""
            
        full_system = system_prompt + f"\n\nCONTEXT:\n{context_msg}"
        
        messages = [
            {"role": "system", "content": full_system},
            {"role": "user", "content": prompt}
        ]

        tools = [{
            "type": "function",
            "function": {
                "name": "execute_python",
                "description": "Execute Python code in a secure sandbox. Use pandas to read the dataset URL provided in the context. Always use print() to output results so you can see them.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "The python code to execute"
                        }
                    },
                    "required": ["code"]
                }
            }
        }]

        MAX_LOOPS = 3
        loop_count = 0

        while loop_count < MAX_LOOPS:
            loop_count += 1
            
            try:
                # Start a stream
                stream = await client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    tools=tools,
                    stream=True,
                    extra_headers={"HTTP-Referer": "https://darelm.ai", "X-Title": "Darelm Platform"} if settings.OPENROUTER_API_KEY else None
                )

                tool_calls = []
                is_calling_tool = False
                
                async for chunk in stream:
                    delta = chunk.choices[0].delta
                    
                    # If the AI is streaming normal text
                    if delta.content:
                        yield f"data: {json.dumps({'content': delta.content})}\n\n"
                    
                    # If the AI decides to call a tool, we accumulate the arguments
                    if delta.tool_calls:
                        is_calling_tool = True
                        for tc in delta.tool_calls:
                            if len(tool_calls) <= tc.index:
                                tool_calls.append({"id": tc.id, "function": {"name": tc.function.name, "arguments": ""}})
                            if tc.function.arguments:
                                tool_calls[tc.index]["function"]["arguments"] += tc.function.arguments

                if not is_calling_tool:
                    # Final answer completed
                    yield "data: [DONE]\n\n"
                    return

                # If we get here, the AI called a tool. Execute it.
                yield f"data: {json.dumps({'content': '\n\n*Running Python analysis...*\n'})}\n\n"
                
                # Append the AI's tool call intent to history
                assistant_msg = {"role": "assistant", "content": None, "tool_calls": [
                    {"id": tc["id"], "type": "function", "function": {"name": tc["function"]["name"], "arguments": tc["function"]["arguments"]}}
                    for tc in tool_calls
                ]}
                messages.append(assistant_msg)

                # Execute all tools
                for tc in tool_calls:
                    if tc["function"]["name"] == "execute_python":
                        args = json.loads(tc["function"]["arguments"])
                        result = execute_python_sandbox(args["code"])
                        
                        # Add the observation back
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "name": tc["function"]["name"],
                            "content": result
                        })
                
                # The loop will now restart and send the history + tool observations back to Qwen!
                
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                return
                
        yield f"data: {json.dumps({'content': '\n\n*Max agent loops reached. Stopping early.*'})}\n\n"
        yield "data: [DONE]\n\n"

qwen_client = QwenClient()
