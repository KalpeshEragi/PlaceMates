const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    // Detailed eval analysis
    const evals = await p.resumeEvaluation.findMany({ orderBy: { createdAt: 'desc' } });
    
    console.log('=== DETAILED EVALUATION ANALYSIS ===\n');
    
    // Score distribution
    const zeroBase = evals.filter(e => e.baseScore === 0).length;
    const zeroDraft = evals.filter(e => e.draftScore === 0).length;
    const zeroFinal = evals.filter(e => e.finalScore === 0).length;
    const sameBaseDraft = evals.filter(e => e.baseScore === e.draftScore).length;
    const emptyIterScores = evals.filter(e => e.iterationScores.length === 0).length;
    
    console.log(`Total evals: ${evals.length}`);
    console.log(`Zero baseScore: ${zeroBase}`);
    console.log(`Zero draftScore: ${zeroDraft}`);
    console.log(`Zero finalScore: ${zeroFinal}`);
    console.log(`baseScore === draftScore: ${sameBaseDraft}`);
    console.log(`Empty iterationScores: ${emptyIterScores}`);
    
    // Ablation mode breakdown
    const modes = {};
    evals.forEach(e => { modes[e.ablationMode] = (modes[e.ablationMode] || 0) + 1; });
    console.log('\nAblation modes:', modes);
    
    // Improvement stats
    const improvements = evals.filter(e => e.baseScore > 0 && e.finalScore > 0)
      .map(e => e.finalScore - e.baseScore);
    if (improvements.length > 0) {
      const avg = improvements.reduce((a,b) => a+b, 0) / improvements.length;
      const max = Math.max(...improvements);
      const min = Math.min(...improvements);
      console.log(`\nImprovement stats (n=${improvements.length}):`);
      console.log(`  Avg: +${avg.toFixed(1)}`);
      console.log(`  Max: +${max}`);
      console.log(`  Min: +${min}`);
      console.log(`  Positive improvements: ${improvements.filter(i => i > 0).length}`);
      console.log(`  No change: ${improvements.filter(i => i === 0).length}`);
      console.log(`  Negative: ${improvements.filter(i => i < 0).length}`);
    }
    
    // Per-user breakdown
    const userMap = {};
    evals.forEach(e => {
      if (!userMap[e.userId]) userMap[e.userId] = [];
      userMap[e.userId].push(e);
    });
    console.log(`\nUsers with evaluations: ${Object.keys(userMap).length}`);
    
    // Iteration scores analysis
    const allIterScores = evals.flatMap(e => e.iterationScores);
    if (allIterScores.length > 0) {
      console.log(`\nIteration scores (total points): ${allIterScores.length}`);
      console.log(`  Avg iteration score: ${(allIterScores.reduce((a,b)=>a+b,0)/allIterScores.length).toFixed(1)}`);
    }

    // Check TailoredResume vs ResumeEvaluation alignment
    const resumeCount = await p.tailoredResume.count();
    console.log(`\nTailoredResumes: ${resumeCount}`);
    console.log(`ResumeEvaluations: ${evals.length}`);
    console.log(`Gap: ${resumeCount - evals.length} resumes without evaluation records`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await p.$disconnect();
  }
})();
