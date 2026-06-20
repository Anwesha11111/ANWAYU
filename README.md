# GramGyan: Empowering Rural Education with Optimized AI

## Problem Statement

Rural education often suffers from a lack of personalized mentorship, standardized evaluation, and exposure to industry-relevant skills. While Artificial Intelligence has the potential to bridge this gap, deploying high-end, responsive AI solutions presents a significant challenge: doing so within strict hardware, cost, or throughput budgets (e.g., a maximum of 59 Tokens/second). 

The core problem is: **How can we deliver a comprehensive, multi-modal educational platform—featuring real-time mentoring, complex project planning, background safety moderation, advanced STEM problem-solving, and vision-based grading—without causing system bottlenecks or exceeding a strict throughput ceiling?**

## Our Solution: GramGyan's Dynamic AI Architecture

GramGyan is a role-based platform (connecting Students, Teachers, NGOs, and Companies) powered by a sophisticated **Dynamic AI Model Routing Architecture** built on the **Nebius** platform. 

To maximize our project's performance under the strict 59 Tok/s constraint, we don't rely on a single monolithic model. Instead, we carefully match each functional module to a specific, lightning-fast public endpoint. This allows us to fully saturate our 59 Tok/s ceiling where heavy reasoning is needed, while keeping conversational and background tasks ultra-lightweight.

### The 5-Pillar Model Routing Strategy

#### 1. Fast Conversational Chat & Multilingual AI Mentor
*   **Model:** `NVIDIA Nemotron-3-Nano-Omni` (90 Tok/s)
*   **Role:** The core interface for real-time student interaction. It is an ultra-efficient, agentic omni-modal reasoning model designed for rapid dialogue, easily exceeding our baseline to ensure zero latency in conversations.

#### 2. Dynamic Project Guidance & Multi-Agent Planning
*   **Model:** `NVIDIA Nemotron-3-Ultra-550b-a55b` (59 Tok/s)
*   **Role:** Engaged when a student triggers "Project Guidance Mode" to map out step-by-step plans. This heavy 550B hybrid MoE model is explicitly optimized for demanding structural reasoning and hits our exact 59 Tok/s ceiling perfectly.

#### 3. Scam Detection & Safety Layer (Background Guardrails)
*   **Model:** `Qwen Qwen3-30B-A3B-Instruct-2507` (70 Tok/s)
*   **Role:** Runs silently in the background, analyzing links and checking messages for predatory behavior. It's exceptionally fast at categorization and returns strict JSON validation almost instantaneously.

#### 4. Advanced Math, Code Debugging & Complex STEM Problems
*   **Model:** `Qwen Qwen3-Next-80B-A3B-Thinking` (85 Tok/s)
*   **Role:** Our high-end "thinking" tier for deep, multi-step math and coding deliberation. It provides enterprise-grade precision much faster than standard deep-reasoning flagships.

#### 5. Homework & Media Submission Processing (Vision Tier)
*   **Model:** `Qwen Qwen2.5-VL-72B-Instruct` (20 Tok/s)
*   **Role:** Handles photographs of assignments or hand-drawn diagrams. While slower, it provides state-of-the-art vision-language reasoning and high-precision OCR alignment.

### Execution Blueprint
To ensure the system never bottlenecks:
1.  **Asynchronous Safety:** The background safety filtering (`Qwen3-30B`) is wrapped in an asynchronous worker pool so it never blocks the student's live chat stream.
2.  **Semantic Caching:** We use a local Redis cache mapped with `Qwen Qwen3-Embedding-8B` to completely bypass the LLM layer for duplicate textbook queries, saving precious throughput.

## Project Structure
- `/src` - Backend server and API routes.
- `/gramgyan-frontend` - The static frontend application with role-based access.
