export function evaluateBookingEligibility(
  confidenceLevel: 'low' | 'medium' | 'high',
  riskLevel: 'low' | 'medium' | 'high' | 'critical',
  query: string,
  history: { role: string; content: string }[],
  providersAvailable: boolean
): { eligible: boolean; reason: string } {
  if (!providersAvailable) {
    return { eligible: false, reason: 'No providers available for this category/location' };
  }

  const fullText = [...history.map(m => m.content), query].join(' ').toLowerCase();
  
  const userRequestedTechnician = /\b(cari|carikan|rekomendasi|rekomendasikan|pesan|booking|hubungkan|butuh tukang|butuh teknisi|panggil)\b/i.test(fullText);

  if (userRequestedTechnician) {
    return { eligible: true, reason: 'User explicitly requested a technician' };
  }

  if (confidenceLevel === 'high' || confidenceLevel === 'medium') {
    if (riskLevel === 'medium' || riskLevel === 'high' || riskLevel === 'critical') {
       return { eligible: true, reason: 'Medium/High confidence on a risky issue' };
    }
  }

  return { eligible: false, reason: 'Still diagnosing or low risk issue' };
}
