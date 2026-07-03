import { describe, expect, test } from "vitest";
import { groundSkills, groundingCorpus } from "@/lib/rolefit/resumeSkills";
import type { ParsedProfile } from "@/lib/rolefit/parseProfile";

// The real candidate skills line + tech mentions, mirroring scripts/fixtures/profile.txt.
const BACKGROUND = `Andrew Malvani
Lead AI/ML Engineer at General Atomics. Avoided $15M/yr with an in-house AI chatbot
(AWS Bedrock, Azure AI Foundry, LiteLLM, Azure Functions). Self-service RAG platform
using hybrid search on Azure AI Search, pgvector, and Python. Agentic search with
GraphRAG on Amazon OpenSearch, Amazon Neptune, and AWS Bedrock. Infrastructure-as-code
with Terraform/Terragrunt and GitHub Actions CI/CD. Multi-agent systems on Azure Durable
Functions, Python, LangGraph, Semantic Kernel, and the Claude SDK. LiteLLM gateway on
Kubernetes. MuleSoft API management.
Skills: Python, Javascript, Typescript, Node, SQL, AWS, Azure, CI/CD, Git, REST APIs,
TDD, OOP, Claude Code, LLMs, Agents`;

const PROFILE: ParsedProfile = {
  name: "Andrew Malvani",
  contact: "a@b.com",
  educationEntries: ["Georgia Tech - MS, Computer Science"],
  certifications: ["Azure AI Engineer Associate", "AWS Solutions Architect Associate"],
  experience: [
    { role: "Lead AI/ML Engineer", company: "General Atomics", dates: "2023 – Present", sourceBullets: [] },
  ],
};

const corpus = groundingCorpus(PROFILE, BACKGROUND);

describe("groundSkills", () => {
  test("keeps real skills, including rephrasings and grouped/qualified variants", () => {
    const real = [
      "Python", "TypeScript", "Node.js", "SQL", "OOP", "TDD", "Git", "REST APIs", "LLMs",
      "AWS (Bedrock, OpenSearch, Neptune)", "Azure (AI Foundry, AI Search, Functions)",
      "PostgreSQL/pgvector", "Kubernetes", "Terraform/Terragrunt", "GitHub Actions CI/CD",
      "CI/CD (GitHub Actions)", "LangGraph", "Claude SDK", "Semantic Kernel", "Azure AI Search",
      "RAG architectures", "Multi-agent systems", "Vector databases (pgvector)", "LLM evaluation",
    ];
    expect(groundSkills(real, corpus)).toEqual(real);
  });

  test("drops JD-adjacent fabrications that share no token with the background", () => {
    const withFakes = [
      "Python", "GraphQL", "Docker", "AWS Lambda", "S3", "functional programming",
      "ETL/ELT patterns", "Airflow", "dbt", "React Native", "Kafka", "Datadog",
    ];
    expect(groundSkills(withFakes, corpus)).toEqual(["Python"]);
  });

  test("does not confuse 'functional' with the real token 'functions'", () => {
    // Background has "Azure Functions"/"Durable Functions" but never "functional".
    expect(groundSkills(["functional programming"], corpus)).toEqual([]);
  });

  test("empty corpus leaves the list untouched (nothing to check against)", () => {
    const skills = ["GraphQL", "Docker"];
    expect(groundSkills(skills, new Set())).toEqual(skills);
  });
});
