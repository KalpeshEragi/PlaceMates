# Implementation Plan: Gemini Insight Generation + Caching Service

## Overview

This implementation plan breaks down the Gemini-based insight generation service into discrete, testable coding tasks. The service generates human-readable career insights from derived intelligence metrics with intelligent caching to minimize API costs. Implementation follows a bottom-up approach: database schema → core utilities → service modules → API integration → testing.

## Tasks

- [x] 1. Set up database schema and types
  - [x] 1.1 Add InsightProfile model to Prisma schema
    - Add InsightProfile model with fields: id, userId, modelVersion, promptVersion, statsHash, insightsJson, generatedAt, createdAt, updatedAt
    - Add unique constraint on userId field
    - Add index on userId field
    - Add InsightProfile relation to UserAuth model
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 1.2 Generate and apply database migration
    - Run `npx prisma migrate dev --name add-insight-profile`
    - Verify migration creates InsightProfile table with correct schema
    - _Requirements: 1.1_
  
  - [x] 1.3 Create TypeScript type definitions
    - Create `backend/src/services/geminiInsight/types.ts`
    - Define StatsSnapshot interface (11 fields)
    - Define InsightJSON interface (8 sections)
    - Define CacheValidation interface
    - Define InsightServiceConfig constants
    - _Requirements: 2.2, 4.5, 9.2_

- [x] 2. Implement stats snapshot builder
  - [x] 2.1 Create statsSnapshotBuilder module
    - Create `backend/src/services/geminiInsight/statsSnapshotBuilder.ts`
    - Implement buildStatsSnapshot function that fetches DerivedMetrics, LinkedInDerivedMetric, and CareerIntelligence
    - Extract 11 required fields: primaryDomain, domainDistribution, topSkills, ownershipIndex, engineeringDiscipline, systemComplexity, consistency, readinessScore, alignmentScore, cognitiveStyle, topProjectsSummary
    - Round numeric scores to 2 decimal places
    - Limit topSkills to 8 entries maximum
    - Limit topProjectsSummary to 3 project names
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 2.2 Implement size validation and hash generation
    - Validate snapshot size does not exceed 2048 bytes
    - Generate SHA256 hash using canonical JSON (sorted keys)
    - Return both snapshot and hash
    - _Requirements: 2.4, 2.5_
  
  - [ ]* 2.3 Write property test for stats snapshot content validation
    - **Property 1: Stats Snapshot Content Validation**
    - **Validates: Requirements 2.2, 2.3**
    - Verify snapshot contains exactly 11 required fields
    - Verify snapshot excludes raw GitHub data, commit arrays, and README text
  
  - [ ]* 2.4 Write property test for stats snapshot size limit
    - **Property 2: Stats Snapshot Size Limit**
    - **Validates: Requirements 2.4**
    - Verify JSON-stringified snapshot is at most 2048 bytes
  
  - [ ]* 2.5 Write property test for stats hash determinism
    - **Property 3: Stats Hash Determinism**
    - **Validates: Requirements 2.5**
    - Verify generating hash twice produces identical values
    - Verify hash is valid 64-character hexadecimal string

- [x] 3. Implement cache validator
  - [x] 3.1 Create cacheValidator module
    - Create `backend/src/services/geminiInsight/cacheValidator.ts`
    - Implement validateCache function that queries InsightProfile by userId
    - Return 'miss' if no profile exists
    - Return 'stale_hash' if statsHash differs
    - Return 'stale_version' if promptVersion differs
    - Return 'hit' with cached insights if all match
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ]* 3.2 Write property test for cache validation logic
    - **Property 4: Cache Validation Logic**
    - **Validates: Requirements 3.2, 3.3, 3.4**
    - Verify cache hit returns cached insights without API call
    - Verify statsHash mismatch triggers regeneration
    - Verify promptVersion mismatch triggers regeneration
  
  - [ ]* 3.3 Write unit tests for cache validator
    - Test cache hit scenario (all match)
    - Test cache miss scenario (no profile)
    - Test stale hash scenario
    - Test stale version scenario
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [-] 5. Implement Gemini prompt builder
  - [x] 5.1 Create promptBuilder module
    - Create `backend/src/services/geminiInsight/promptBuilder.ts`
    - Implement buildGeminiPrompt function that accepts StatsSnapshot
    - Include analytical tone instructions without exaggeration
    - Specify 2-4 sentences per section
    - Prohibit buzzwords
    - Specify JSON output format with 8 sections
    - Include only derived statistics, not raw source data
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ]* 5.2 Write property test for prompt content exclusion
    - **Property 5: Prompt Content Exclusion**
    - **Validates: Requirements 4.6**
    - Verify prompt does not contain raw GitHub data, commit arrays, or README text
    - Verify prompt contains only derived statistics from StatsSnapshot

- [x] 6. Implement Gemini API client
  - [x] 6.1 Create geminiClient module
    - Create `backend/src/services/geminiInsight/geminiClient.ts`
    - Read GEMINI_API_KEY from environment variables
    - Implement callGeminiAPI function using @google/generative-ai SDK
    - Use model 'gemini-2.0-flash'
    - Set temperature to 0.3
    - Set maxOutputTokens to 1024
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 6.2 Implement response validation
    - Strip markdown code fences from response
    - Parse JSON response
    - Validate response contains valid JSON
    - Validate response contains all 8 required sections (heroSummary, domainInsight, skillInsight, engineeringInsight, growthInsight, alignmentInsight, projectInsight, gapInsight)
    - Throw error if validation fails
    - _Requirements: 5.4, 5.5_
  
  - [ ]* 6.3 Write property test for API request configuration
    - **Property 6: Gemini API Request Configuration**
    - **Validates: Requirements 5.2, 5.3**
    - Verify temperature is set to 0.3
    - Verify max token limit is enforced
  
  - [ ]* 6.4 Write property test for API response validation
    - **Property 7: API Response Validation**
    - **Validates: Requirements 5.4, 5.5**
    - Verify client validates response is valid JSON
    - Verify client validates all 8 sections are present
  
  - [ ]* 6.5 Write unit tests for Gemini client
    - Test API key is read from environment
    - Test successful response parsing
    - Test invalid JSON handling
    - Test missing sections handling
    - _Requirements: 5.1, 5.4, 5.5_

- [x] 7. Implement fallback generator
  - [x] 7.1 Create fallbackGenerator module
    - Create `backend/src/services/geminiInsight/fallbackGenerator.ts`
    - Implement generateDeterministicInsights function
    - Generate all 8 insight sections using deterministic templates
    - Use snapshot data to populate templates
    - Ensure output matches InsightJSON structure
    - _Requirements: 6.1, 6.2_
  
  - [ ]* 7.2 Write unit tests for fallback generator
    - Test deterministic template generation
    - Test all 8 sections are generated
    - Test output structure matches InsightJSON
    - _Requirements: 6.1, 6.2_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [-] 9. Implement main service orchestrator
  - [x] 9.1 Create geminiInsightService module
    - Create `backend/src/services/geminiInsight/index.ts`
    - Define PROMPT_VERSION constant as "insight_v1"
    - Define MODEL_VERSION constant as "intelligence_v3"
    - Export service configuration constants
    - _Requirements: 7.1, 7.2_
  
  - [x] 9.2 Implement generateInsights function
    - Validate user exists and onboardingStage equals "intelligence_ready"
    - Call buildStatsSnapshot to generate snapshot and hash
    - Call validateCache to check for cached insights
    - Return cached insights on cache hit
    - On cache miss, call buildGeminiPrompt and callGeminiAPI
    - Implement try-catch for Gemini API errors
    - Call generateDeterministicInsights on API failure
    - Log errors with userId and statsHash only (no sensitive data)
    - _Requirements: 3.1, 3.2, 6.1, 6.2, 6.3, 8.2, 10.2, 10.3_
  
  - [x] 9.3 Implement database persistence
    - Use Prisma upsert to store/update InsightProfile
    - Store modelVersion, promptVersion, statsHash, insightsJson, generatedAt
    - Update updatedAt timestamp on regeneration
    - Return InsightJSON to caller
    - _Requirements: 1.1, 1.4, 9.1, 9.3, 9.4_
  
  - [ ]* 9.4 Write property test for error handling without exceptions
    - **Property 8: Error Handling Without Exceptions**
    - **Validates: Requirements 6.1, 6.2, 6.4**
    - Verify service returns valid InsightJSON on API timeout
    - Verify service returns valid InsightJSON on invalid JSON response
    - Verify service never throws unhandled exceptions
  
  - [ ]* 9.5 Write property test for secure logging
    - **Property 9: Secure Logging**
    - **Validates: Requirements 6.3, 10.2, 10.3, 10.4**
    - Verify error logs contain only userId and statsHash
    - Verify logs do not contain full prompt content in production
    - Verify logs do not contain API keys
  
  - [ ]* 9.6 Write unit tests for service orchestrator
    - Test onboarding stage validation (reject if not "intelligence_ready")
    - Test cache hit scenario (no API call)
    - Test cache miss scenario (API call made)
    - Test statsHash change triggers regeneration
    - Test promptVersion change triggers regeneration
    - Test API timeout returns fallback
    - Test invalid JSON returns fallback
    - Test database persistence on successful generation
    - _Requirements: 3.2, 3.3, 3.4, 6.1, 6.2, 8.2, 9.3, 9.4_

- [x] 10. Implement API route
  - [x] 10.1 Add generate-insights endpoint to profile routes
    - Open `backend/src/routes/profile.ts`
    - Add POST /profile/generate-insights endpoint
    - Use requireAuth middleware
    - Call generateInsights with req.userId
    - Return 400 error if onboarding stage validation fails
    - Return 200 with insights JSON on success
    - Return 500 on unexpected errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 10.2 Write property test for onboarding stage validation
    - **Property 10: Onboarding Stage Validation**
    - **Validates: Requirements 8.2**
    - Verify endpoint rejects requests when onboardingStage != "intelligence_ready"
    - Verify endpoint returns 400 error response
  
  - [ ]* 10.3 Write integration tests for API endpoint
    - Test POST /profile/generate-insights returns 401 if not authenticated
    - Test POST /profile/generate-insights returns 400 if onboarding not ready
    - Test POST /profile/generate-insights returns 200 with insights
    - Test response contains all 8 insight sections
    - Test insights are stored in database
    - Test second call returns cached insights (verify no duplicate API call)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [-] 11. Implement environment configuration
  - [x] 11.1 Add GEMINI_API_KEY to environment configuration
    - Open `backend/src/config/env.ts`
    - Add GEMINI_API_KEY to env object
    - Read from process.env.GEMINI_API_KEY
    - Default to empty string if not set
    - _Requirements: 5.1, 10.1_
  
  - [x] 11.2 Update .env.example file
    - Add GEMINI_API_KEY entry with placeholder
    - Add comment explaining the key is required for insight generation
    - _Requirements: 10.1_
  
  - [ ]* 11.3 Write property test for secure API key management
    - Verify API key is retrieved exclusively from environment variables
    - Verify API key is not logged in any environment
    - Verify API key is not exposed in error messages
    - _Requirements: 10.1, 10.2, 10.4_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Add property-based testing infrastructure
  - [ ] 13.1 Install fast-check library
    - Run `npm install --save-dev fast-check @types/fast-check`
    - Verify installation in package.json
  
  - [ ] 13.2 Create property test utilities
    - Create `backend/src/services/geminiInsight/__tests__/propertyTestUtils.ts`
    - Implement arbitraryIntelligenceData generator for fast-check
    - Implement arbitraryStatsSnapshot generator
    - Implement arbitraryInsightJSON generator
    - Configure minimum 100 iterations per property test

- [ ]* 14. Write property test for insight storage structure
  - **Property 11: Insight Storage Structure**
  - **Validates: Requirements 9.1, 9.2, 9.3**
  - Verify insightsJson field is valid JSON object
  - Verify insightsJson contains exactly 8 string fields
  - Verify generatedAt field is valid timestamp

- [ ]* 15. Write property test for version persistence
  - **Property 12: Version Persistence**
  - **Validates: Requirements 1.4**
  - Verify InsightProfile records contain non-empty modelVersion
  - Verify InsightProfile records contain non-empty promptVersion

- [ ]* 16. Write property test for timestamp update on regeneration
  - **Property 13: Timestamp Update on Regeneration**
  - **Validates: Requirements 9.4**
  - Verify updatedAt timestamp is more recent after regeneration
  - Verify updatedAt changes when insights are regenerated

- [x] 17. Final checkpoint - Ensure all tests pass
  - Run full test suite
  - Verify all unit tests pass
  - Verify all property-based tests pass
  - Verify all integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Implementation uses TypeScript throughout (as specified in design document)
- Property tests use fast-check library with minimum 100 iterations
- Checkpoints ensure incremental validation and allow for user feedback
- Database migration should be tested in development environment before production deployment
- GEMINI_API_KEY must be configured in environment before testing API integration
- Cache validation logic is critical for cost optimization - test thoroughly
- Fallback generator ensures system never fails completely, even during API outages
