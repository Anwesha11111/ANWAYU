import os
from openai import OpenAI

# Predefined Nebius API Key provided by user
DEFAULT_API_KEY = "v1.CmQKHHN0YXRpY2tleS1lMDBwNzBwNmt0eW4xMXdlMmcSIXNlcnZpY2VhY2NvdW50LWUwMHZtM3YwYnB2djhwcWZwYTIMCLmg2NEGEICzpuYCOgwIt6PwnAcQgMTFkANAAloDZTAw.AAAAAAAAAAE-9wMO9dk7uKGWB-z3-KICgEO8Ji8zgYWqGqWR-l01yV5BBY-tXXI7GUUvFyL_ZC0z7FHuSfQFXekK8LBp8oYO"

# Initialize Nebius client
# We read from environment variables first, falling back to the hardcoded key.
client = OpenAI(
    base_url="https://api.tokenfactory.nebius.com/v1/",
    api_key=os.environ.get("NEBIUS_API_KEY", DEFAULT_API_KEY)
)

# Call completions API using standard mentor model (Nemotron)
response = client.chat.completions.create(
    model="nvidia/Llama-3_1-Nemotron-Ultra-253B-v1",
    messages=[
        {
            "role": "system",
            "content": "You are a helpful rural education mentor for GramGyan."
        },
        {
            "role": "user",
            "content": "Explain what GramGyan does."
        }
    ]
)

print(response.to_json())
