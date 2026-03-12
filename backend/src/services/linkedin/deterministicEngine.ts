import { computeExperienceTimeline } from "./experienceEngine";
import { computeCareerGrowth } from "./growthEngine";
import { processSkills } from "./skillEngine";

export function computeDeterministicInsights(data: any) {
  const { positions = [], skills = [] } = data;

  const { totalExperienceYears } =
  computeExperienceTimeline(positions);

  const careerGrowthSpeed =
  computeCareerGrowth(positions, totalExperienceYears);

  const processedSkills = processSkills(skills);

  return {
  totalExperienceYears,
  careerGrowthSpeed,
  skillClusters: processedSkills ,
};
}

