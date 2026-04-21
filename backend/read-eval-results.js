const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { runResearchEval } = require('./dist/controllers/evaluationController.js');

async function testEval() {
  try {
    const req = { user: { id: "admin" } };
    const res = {
      json: (data) => console.log(JSON.stringify(data, null, 2)),
      status: (c) => ({ json: (d) => console.log(c, d) })
    };
    
    // We cannot easily inject into express middleware, so let's just query what's outputted.
    // wait, researchEvaluationService produces a file!
    const fs = require('fs');
    if (fs.existsSync('./evaluation-output/evaluation-results.json')) {
      const data = fs.readFileSync('./evaluation-output/evaluation-results.json', 'utf8');
      console.log('Results output:\n', data.substring(0, 500) + '...');
    } else {
      console.log('No evaluation results file found yet.');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
testEval();
