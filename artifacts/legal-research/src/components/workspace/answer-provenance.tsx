import React from 'react';
import { Shield, BookOpen, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/user-context';

interface Authority {
  ragTag?: string;
  documentId?: number;
  titleAr?: string;
  title?: string;
  authorityClass?: 'binding' | 'persuasive' | 'non_binding';
  confidenceScore?: number;
  confidenceLabel?: string;
}

interface AnswerProvenanceProps {
  citedAuthorities: Authority[];
  verificationReport?: Record<string, unknown>;
  confidenceLevel: number | null;
  retrievalInventory?: Record<string, unknown>;
  generationTimestamp: string | null;
  modelVersion: string | null;
}

const CLASS_CONFIG: Record<string, { label: string; labelEn: string; variant: 'default' | 'secondary' | 'outline'; bg: string }> = {
  binding:     { label: 'ملزم',     labelEn: 'Binding',      variant: 'default',   bg: 'bg-heading/15 text-heading/75 border-heading/40' },
  persuasive:  { label: 'إرشادي',  labelEn: 'Persuasive',   variant: 'secondary', bg: 'bg-blue-100 text-blue-800 border-blue-300' },
  non_binding: { label: 'غير ملزم', labelEn: 'Non-binding',  variant: 'outline',   bg: 'bg-gray-100 text-gray-700 border-gray-300' },
};

function confidenceBg(score: number): string {
  if (score >= 0.85) return 'bg-heading/15 text-heading/75';
  if (score >= 0.65) return 'bg-blue-100 text-blue-800';
  if (score >= 0.4)  return 'bg-gold/15 text-gold/75';
  return 'bg-gray-100 text-gray-600';
}

export function AnswerProvenance({
  citedAuthorities,
  confidenceLevel,
  generationTimestamp,
  modelVersion,
}: AnswerProvenanceProps) {
  const t = useT();

  const binding    = citedAuthorities.filter((a) => a.authorityClass === 'binding');
  const persuasive = citedAuthorities.filter((a) => a.authorityClass === 'persuasive');
  const nonBinding = citedAuthorities.filter((a) => a.authorityClass === 'non_binding');

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-700" />
          <span className="text-sm font-semibold text-blue-900">
            {t('مصادر الاستشهاد', 'Cited Authorities')}
          </span>
        </div>
        {confidenceLevel !== null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${confidenceBg(confidenceLevel)}`}>
            {t('ثقة', 'Confidence')}: {Math.round(confidenceLevel * 100)}%
          </span>
        )}
      </div>

      {/* Summary counts */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full bg-heading/15 text-heading/75 border border-heading/40">
          {t('ملزم', 'Binding')}: {binding.length}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
          {t('إرشادي', 'Persuasive')}: {persuasive.length}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-300">
          {t('غير ملزم', 'Non-binding')}: {nonBinding.length}
        </span>
      </div>

      {/* Authority list */}
      {citedAuthorities.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('لا توجد مصادر', 'No cited sources')}</p>
      ) : (
        <ul className="space-y-1.5">
          {citedAuthorities.map((auth, i) => {
            const cls = auth.authorityClass ?? 'persuasive';
            const cfg = CLASS_CONFIG[cls] ?? CLASS_CONFIG.persuasive;
            const score = auth.confidenceScore ?? 0;
            return (
              <li key={i} className="flex items-start gap-2 text-xs">
                <BookOpen className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                <span className="flex-1 text-gray-800 leading-relaxed">
                  {auth.titleAr || auth.title || auth.ragTag || `[${auth.documentId ?? i}]`}
                </span>
                <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded border ${cfg.bg}`}>
                  {t(cfg.label, cfg.labelEn)}
                </span>
                <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${confidenceBg(score)}`}>
                  {Math.round(score * 100)}%
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer */}
      {(modelVersion || generationTimestamp) && (
        <div className="mt-3 pt-2 border-t border-blue-200 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          {modelVersion && (
            <span className="flex items-center gap-1">
              <Info className="w-3 h-3" />
              {t('النموذج', 'Model')}: {modelVersion}
            </span>
          )}
          {generationTimestamp && (
            <span>
              {t('وقت التوليد', 'Generated')}: {new Date(generationTimestamp).toLocaleString('ar-AE')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
