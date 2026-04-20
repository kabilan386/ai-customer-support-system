import os
from typing import AsyncIterator
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

SYSTEM_PROMPT = """You are a helpful AI customer support agent. You assist customers with:
- Order tracking and delivery issues
- Product questions and recommendations
- Refund and return requests
- Account and billing inquiries

Be concise, empathetic, and solution-focused.

Rules:
- For greetings, small talk, or general questions you can answer: end with RESOLVED
- Only end with UNRESOLVED if the customer has a specific issue that requires a human agent (e.g. a complaint, a broken order, a failed refund)
- Never end with UNRESOLVED for greetings like "hi", "hello", "how are you"

End every response with exactly one of: RESOLVED or UNRESOLVED"""

CONTEXT_WINDOW = 10


async def stream_response(
    user_message: str,
    history: list[dict],
) -> AsyncIterator[str]:
    recent_history = history[-CONTEXT_WINDOW:]

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(recent_history)
    messages.append({"role": "user", "content": user_message})

    stream = await client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        stream=True,
        temperature=0.7,
        max_tokens=512,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def is_resolved(bot_response: str) -> bool:
    return "RESOLVED" in bot_response.upper() and "UNRESOLVED" not in bot_response.upper()
