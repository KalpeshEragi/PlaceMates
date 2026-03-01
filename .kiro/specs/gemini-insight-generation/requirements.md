# Requirements Document

## Introduction

This document specifies requirements for a production-ready Gemini-based insight generation service that creates human-readable insights from user profile statistics. The system leverages existing intelligence data (DerivedMetrics, LinkedInDerivedMetric, CareerIntelligence) to generate versioned, cached insights that avoid redundant API calls and maintain cost efficiency.

## Glossary

- **Insight_Service**: The service responsible for generating, caching, and retrieving profile insights
- **Stats_Snapshot**: A compact JSON representation of derived statistics used for insight generation
- **Stats_Hash**: A SHA256 hash of the Stats_Snapshot used for cache validation
- **Insight_Profile**: Database entity storing versioned insights and cache metadata
- **Gemini_Client**: The client interface for communicating with the Gemini API
- **Prompt_Version**: A semantic version identifier for the prompt template (e.g., "insight_v1")
- **Model_Version**: A semantic version identifier for the intelligence model (e.g., "intelligence_v3")
- **Insight_JSON**: Structured JSON containing 8 insight sections for profile display

## Requirements

### Requirement 1: Insight Profile Storage

**User Story:** As a system administrator, I want versioned insight storage, so that regeneration only occurs when necessary

#### Acceptance Criteria

1. THE Insight_Service SHALL create an InsightProfile database model with fields: id, userId, modelVersion, promptVersion, statsHash, insightsJson, generatedAt, createdAt, updatedAt
2. THE Insight_Service SHALL enforce a unique constraint on the userId field
3. THE Insight_Service SHALL create a database index on the userId field
4. THE Insight_Service SHALL store the Prompt_Version and Model_Version with each Insight_Profile record

### Requirement 2: Stats Snapshot Generation

**User Story:** As a developer, I want a compact stats representation, so that Gemini API calls remain cost-effective

#### Acceptance Criteria

1. WHEN generating a Stats_Snapshot, THE Insight_Service SHALL fetch the latest DerivedMetrics, LinkedInDerivedMetric, and CareerIntelligence records for the user
2. THE Insight_Service SHALL include only these fields in the Stats_Snapshot: primaryDomain, domainDistribution, topSkills, ownershipIndex, engineeringDiscipline, systemComplexity, consistency, readinessScore, alignmentScore, cognitiveStyle, topProjectsSummary
3. THE Insight_Service SHALL exclude raw GitHub data, commit arrays, and README text from the Stats_Snapshot
4. THE Insight_Service SHALL limit the Stats_Snapshot size to 2048 bytes maximum
5. THE Insight_Service SHALL generate a SHA256 hash of the JSON-stringified Stats_Snapshot

### Requirement 3: Cache Validation

**User Story:** As a product owner, I want to avoid redundant API calls, so that operational costs remain low

#### Acceptance Criteria

1. WHEN an insight generation request is received, THE Insight_Service SHALL query for an existing Insight_Profile matching the userId
2. IF an Insight_Profile exists with matching statsHash and promptVersion, THEN THE Insight_Service SHALL return the cached insightsJson without calling the Gemini_Client
3. IF the statsHash differs from the cached value, THEN THE Insight_Service SHALL regenerate insights
4. IF the promptVersion differs from the cached value, THEN THE Insight_Service SHALL regenerate insights
5. IF no Insight_Profile exists for the userId, THEN THE Insight_Service SHALL generate new insights

### Requirement 4: Gemini Prompt Construction

**User Story:** As a data scientist, I want structured prompt templates, so that insight quality remains consistent

#### Acceptance Criteria

1. THE Insight_Service SHALL implement a buildGeminiPrompt function that accepts a Stats_Snapshot and returns a prompt string
2. THE buildGeminiPrompt function SHALL instruct the Gemini_Client to use an analytical tone without exaggeration or hallucination
3. THE buildGeminiPrompt function SHALL specify that each insight section contains 2 to 4 sentences
4. THE buildGeminiPrompt function SHALL prohibit buzzwords in the generated insights
5. THE buildGeminiPrompt function SHALL specify JSON output format with 8 sections: heroSummary, domainInsight, skillInsight, engineeringInsight, growthInsight, alignmentInsight, projectInsight, gapInsight
6. THE buildGeminiPrompt function SHALL include only derived statistics in the prompt, not raw source data

### Requirement 5: Gemini API Integration

**User Story:** As a developer, I want reliable Gemini API communication, so that insights generate successfully

#### Acceptance Criteria

1. THE Gemini_Client SHALL read the API key from environment variables
2. WHEN calling the Gemini API, THE Gemini_Client SHALL set temperature to 0.3
3. THE Gemini_Client SHALL enforce a maximum token limit in API requests
4. THE Gemini_Client SHALL validate that the API response contains valid JSON
5. THE Gemini_Client SHALL validate that the response JSON contains all 8 required insight sections

### Requirement 6: Error Handling and Fallback

**User Story:** As a user, I want the system to remain functional during API failures, so that my experience is not disrupted

#### Acceptance Criteria

1. IF the Gemini_Client times out, THEN THE Insight_Service SHALL return a minimal deterministic template
2. IF the Gemini_Client returns invalid JSON, THEN THE Insight_Service SHALL return a minimal deterministic template
3. IF the Gemini_Client fails for any reason, THEN THE Insight_Service SHALL log the error with userId and Stats_Hash only
4. THE Insight_Service SHALL never throw unhandled exceptions that break the frontend

### Requirement 7: Version Control

**User Story:** As a developer, I want automatic cache invalidation on prompt changes, so that users receive updated insights

#### Acceptance Criteria

1. THE Insight_Service SHALL define a constant PROMPT_VERSION with initial value "insight_v1"
2. THE Insight_Service SHALL define a constant MODEL_VERSION with initial value "intelligence_v3"
3. WHEN the prompt template changes, THE Insight_Service SHALL increment the PROMPT_VERSION value
4. WHEN PROMPT_VERSION changes, THE Insight_Service SHALL automatically invalidate cached insights for all users on their next request

### Requirement 8: API Route Implementation

**User Story:** As a frontend developer, I want a dedicated endpoint for insight generation, so that I can trigger it on demand

#### Acceptance Criteria

1. THE Insight_Service SHALL expose a POST endpoint at /profile/generate-insights
2. WHEN the endpoint receives a request, THE Insight_Service SHALL validate that the user's onboardingStage equals "intelligence_ready"
3. IF the onboardingStage validation fails, THEN THE Insight_Service SHALL return an error response with status 400
4. WHEN the endpoint successfully generates insights, THE Insight_Service SHALL return the Insight_JSON with status 200
5. THE Insight_Service SHALL not automatically generate insights on profile load

### Requirement 9: Insight Storage Format

**User Story:** As a frontend developer, I want structured insight data, so that I can render it consistently

#### Acceptance Criteria

1. THE Insight_Service SHALL store insights in the insightsJson field as a JSON object
2. THE insightsJson object SHALL contain exactly 8 string fields: heroSummary, domainInsight, skillInsight, engineeringInsight, growthInsight, alignmentInsight, projectInsight, gapInsight
3. THE Insight_Service SHALL store the generation timestamp in the generatedAt field
4. THE Insight_Service SHALL update the updatedAt field on every insight regeneration

### Requirement 10: Security and Privacy

**User Story:** As a security engineer, I want secure API key management and minimal logging, so that user data remains protected

#### Acceptance Criteria

1. THE Gemini_Client SHALL retrieve the API key exclusively from environment variables
2. THE Insight_Service SHALL not log full prompt content in production environments
3. THE Insight_Service SHALL log only the Stats_Hash and userId for debugging purposes
4. THE Insight_Service SHALL not expose API keys in error messages or responses
