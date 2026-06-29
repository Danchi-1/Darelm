import json
import asyncio
from openai import AsyncOpenAI
from app.core.config import settings

class QwenClient:
    def _get_client_and_model(self, tier="smart"):
        # We prioritize OpenRouter for the mock if available
        if settings.OPENROUTER_API_KEY:
            client = AsyncOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY
            )
            # Switch to alternative free Qwen model since qwen3-coder is rate-limited upstream
            return client, "qwen/qwen3-next-80b-a3b-instruct:free"
        elif settings.QWEN_API_KEY:
            client = AsyncOpenAI(
                base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
                api_key=settings.QWEN_API_KEY
            )
            model_name = "qwen-turbo" if tier == "fast" else "qwen-plus"
            return client, model_name
        return None, None

    async def chat_completion(self, messages: list, tools: list = None, tier="smart"):
        client, model_name = self._get_client_and_model(tier)
        if not client:
            raise Exception("No AI configured.")
            
        return await client.chat.completions.create(
            model=model_name,
            messages=messages,
            tools=tools,
            extra_headers={"HTTP-Referer": "https://darelm.ai", "X-Title": "Darelm Platform"} if settings.OPENROUTER_API_KEY else None
        )

    async def generate_json(self, prompt: str, system_prompt: str, retries: int = 10, tier="smart") -> str:
        client, model_name = self._get_client_and_model(tier)
        if not client:
            raise Exception("No AI configured.")
            
        import openai
        for attempt in range(retries):
            try:
                response = await client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"} if "qwen" in model_name else None,
                    extra_headers={"HTTP-Referer": "https://darelm.ai", "X-Title": "Darelm Platform"} if settings.OPENROUTER_API_KEY else None
                )
                return response.choices[0].message.content
            except openai.RateLimitError as e:
                if attempt == retries - 1:
                    raise e
                print(f"[QWEN API] Rate limit hit. Retrying in 35 seconds... (Attempt {attempt + 1}/{retries})")
                await asyncio.sleep(35)
            except Exception as e:
                if "429" in str(e) and attempt < retries - 1:
                    print(f"[QWEN API] Rate limit hit (429). Retrying in 35 seconds... (Attempt {attempt + 1}/{retries})")
                    await asyncio.sleep(35)
                else:
                    raise e

    async def stream_chat(self, prompt: str, system_prompt: str, dataset_context: dict = None, history: list = None, on_complete=None, tier="smart"):
        """
        Yields server-sent events. Orchestrates the ReAct loop if tools are called.
        """
        client, model_name = self._get_client_and_model(tier)
        if not client:
            yield f"data: {json.dumps({'error': 'No AI configured.'})}\n\n"
            return

        from app.agents.tools import execute_python_sandbox
        
        # Build the initial context
        context_msg = "You have no datasets loaded."
        dataset_path_for_sandbox = None
        sandbox_filename = None
        
        if dataset_context:
            url_or_connection = dataset_context.get('url_or_connection', '')
            if not url_or_connection.startswith('http'):
                dataset_path_for_sandbox = url_or_connection
                ext = ".csv" if "csv" in dataset_context.get("dataset_type", "csv").lower() else ".xlsx"
                sandbox_filename = f"/home/user/dataset{ext}"
                url_or_connection = f"{sandbox_filename} (Use this exact path in pandas)"
                
            context_msg = f"""
Dataset Loaded:
- Name: {dataset_context.get('dataset_name')}
- URL/Connection: {url_or_connection}
- Schema: {json.dumps(dataset_context.get('schema'))}
"""
            
        full_system = system_prompt + f"\n\nCONTEXT:\n{context_msg}"
        
        messages = [{"role": "system", "content": full_system}]
        if history:
            messages.extend(history)
            
        messages.append({"role": "user", "content": prompt})

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

        MAX_LOOPS = 4
        loop_count = 0
        
        # Accumulators for database persistence
        final_content = ""
        final_thought = ""
        all_tool_calls = []

        while loop_count < MAX_LOOPS:
            loop_count += 1
            
            try:
                stream = await client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    tools=tools,
                    stream=True,
                    extra_headers={"HTTP-Referer": "https://darelm.ai", "X-Title": "Darelm Platform"} if settings.OPENROUTER_API_KEY else None
                )

                tool_calls = []
                is_calling_tool = False
                first_content_in_loop = True
                
                async for chunk in stream:
                    delta = chunk.choices[0].delta
                    
                    if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                        final_thought += delta.reasoning_content
                        yield f"data: {json.dumps({'thought': delta.reasoning_content})}\n\n"
                    
                    if delta.content:
                        content_to_yield = delta.content
                        if first_content_in_loop and loop_count > 1:
                            # Prepend spacing so continuation doesn't glue to previous loops
                            content_to_yield = "\n\n" + content_to_yield
                            first_content_in_loop = False
                        else:
                            first_content_in_loop = False
                            
                        final_content += content_to_yield
                        yield f"data: {json.dumps({'content': content_to_yield})}\n\n"
                    
                    if delta.tool_calls:
                        is_calling_tool = True
                        for tc in delta.tool_calls:
                            if len(tool_calls) <= tc.index:
                                tc_id = tc.id or f"call_{loop_count}_{tc.index}"
                                tc_name = tc.function.name if tc.function else "unknown"
                                tool_calls.append({"id": tc_id, "function": {"name": tc_name, "arguments": ""}})
                                
                                yield f"data: {json.dumps({'tool_call': {'id': tc_id, 'name': tc_name, 'status': 'running'}})}\n\n"
                                
                            if tc.function and tc.function.arguments:
                                tool_calls[tc.index]["function"]["arguments"] += tc.function.arguments

                if not is_calling_tool:
                    if on_complete:
                        on_complete(final_content, final_thought, all_tool_calls)
                    yield "data: [DONE]\n\n"
                    return
                
                all_tool_calls.extend(tool_calls)
                
                assistant_msg = {"role": "assistant", "content": None, "tool_calls": [
                    {"id": tc["id"], "type": "function", "function": {"name": tc["function"]["name"], "arguments": tc["function"]["arguments"]}}
                    for tc in tool_calls
                ]}
                messages.append(assistant_msg)

                for tc in tool_calls:
                    if tc["function"]["name"] == "execute_python":
                        args_str = tc["function"]["arguments"]
                        try:
                            args = json.loads(args_str)
                            code = args.get("code", "")
                            # Fix Qwen double-escaped newlines in JSON
                            code = code.replace("\\n", "\n")
                            result = execute_python_sandbox(code, dataset_path_for_sandbox, sandbox_filename)
                            status = "completed"
                            tc["result"] = result
                        except Exception as e:
                            result = f"Error: {str(e)}"
                            status = "failed"
                            tc["result"] = result
                        
                        yield f"data: {json.dumps({'tool_result': {'id': tc['id'], 'result': result, 'status': status}})}\n\n"
                        
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "name": tc["function"]["name"],
                            "content": result
                        })
                
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                if on_complete:
                    on_complete(final_content, final_thought, all_tool_calls)
                return
                
        yield f"data: {json.dumps({'content': '\\n\\n*Max agent loops reached. Stopping early.*'})}\n\n"
        if on_complete:
            on_complete(final_content, final_thought, all_tool_calls)
        yield "data: [DONE]\n\n"

qwen_client = QwenClient()
