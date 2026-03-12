export function computeProfileScore(data: any): number {
  let score = 0;

  if (data.profile?.headline) score += 10;
  if (data.profile?.summary) score += 15;
  if (data.positions?.length >= 3) score += 15;
  if (data.skills?.length >= 10) score += 15;
  if (data.projects?.length) score += 10;
  if (data.certifications?.length) score += 10;
  if (data.education?.length) score += 10;
  if (data.connections?.length) score += 15;

  return score;
}