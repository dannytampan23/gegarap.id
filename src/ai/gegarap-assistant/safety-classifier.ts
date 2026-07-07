import { SafetyAlert } from './types';

const SAFETY_KEYWORDS: Array<{ re: RegExp; severity: 'high' | 'critical'; type: string }> = [
  { re: /\b(bau gosong|bau terbakar|terbakar|percikan api|kabel terbuka|kabel telanjang|kabel terkelupas|nyetrum|kesetrum|stop kontak panas|mcb panas|meleleh)\b/i, severity: 'critical', type: 'electrical_fire' },
  { re: /\b(air kena colokan|air dekat listrik|air dekat stop kontak|banjir dekat listrik|banjir kena listrik|listrik kena air|stop kontak kena air)\b/i, severity: 'critical', type: 'water_electricity' },
  { re: /\b(gas bocor|bau gas|bau elpiji|bau lpg|suara ledakan|desisan gas|regulator bocor)\b/i, severity: 'critical', type: 'gas_leak' },
  { re: /\b(plafon hampir roboh|atap hampir roboh|retak parah|melengkung turun|struktur miring|dinding miring|balok retak|mau ambruk|hampir ambruk)\b/i, severity: 'critical', type: 'structural_collapse' },
  { re: /\b(asap|api)\b/i, severity: 'critical', type: 'fire' },
];

export function runSafetyClassifier(message: string): { isSafety: boolean; alerts: SafetyAlert[]; riskLevel: 'low' | 'medium' | 'high' | 'critical' } {
  const alerts: SafetyAlert[] = [];
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

  for (const { re, severity, type } of SAFETY_KEYWORDS) {
    const match = message.match(re);
    if (match) {
      alerts.push({ type, severity, keyword: match[0] });
      if (severity === 'critical') {
        riskLevel = 'critical';
      } else if (severity === 'high' && riskLevel !== 'critical') {
        riskLevel = 'high';
      }
    }
  }

  return {
    isSafety: alerts.length > 0,
    alerts,
    riskLevel,
  };
}
