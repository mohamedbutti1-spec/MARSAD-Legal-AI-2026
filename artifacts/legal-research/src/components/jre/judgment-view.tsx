import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AuthorityHierarchy } from './authority-hierarchy';
import type { JudgmentOutput } from '@/types/jre';

interface JudgmentViewProps {
  judgment: JudgmentOutput;
}

export function JudgmentView({ judgment }: JudgmentViewProps) {
  const { verificationStatus, legalityScore, riskScore } = judgment;

  return (
    <div className="space-y-6" dir="rtl">
      {/* ── Header: scores + verification ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Verification badge */}
        {verificationStatus.allAuthoritiesVerified ? (
          <div className="flex items-center gap-1.5 text-heading text-sm font-medium bg-heading/10 dark:bg-heading/20 border border-heading/25 dark:border-heading/40 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            الاستشهادات موثَّقة ({verificationStatus.verifiedCount})
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-gold/80 text-sm font-medium bg-gold/10 dark:bg-gold/20 border border-gold/25 dark:border-gold/75 px-3 py-1.5 rounded-full">
            <AlertTriangle className="w-4 h-4" />
            {verificationStatus.fabricatedCitationsFiltered} استشهاد(ات) غير موثَّق — تمَّ حذفه
          </div>
        )}

        {/* Legality score */}
        {legalityScore !== undefined && (
          <div className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border ${
            legalityScore >= 70 ? 'bg-heading/10 text-heading border-heading/25 dark:bg-heading/20 dark:text-heading dark:border-heading/40'
            : legalityScore >= 40 ? 'bg-gold/10 text-gold border-gold/25 dark:bg-gold/20 dark:text-gold/80 dark:border-gold/75'
            : 'bg-destructive/10 text-destructive border-destructive/25 dark:bg-destructive/20 dark:text-destructive dark:border-destructive/40'
          }`}>
            <ShieldAlert className="w-4 h-4" />
            درجة المشروعية: {legalityScore}%
          </div>
        )}

        {/* Risk score */}
        {riskScore !== undefined && (
          <div className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border ${
            riskScore <= 30 ? 'bg-heading/10 text-heading border-heading/25 dark:bg-heading/20 dark:text-heading dark:border-heading/40'
            : riskScore <= 60 ? 'bg-gold/10 text-gold border-gold/25 dark:bg-gold/20 dark:text-gold/80 dark:border-gold/75'
            : 'bg-destructive/10 text-destructive border-destructive/25 dark:bg-destructive/20 dark:text-destructive dark:border-destructive/40'
          }`}>
            <AlertTriangle className="w-4 h-4" />
            مستوى المخاطرة: {riskScore}%
          </div>
        )}
      </div>

      {/* ── Case title ─────────────────────────────────────────────────────── */}
      <div className="text-center border-b pb-4">
        <h2 className="text-lg font-bold text-foreground">{judgment.caseTitle}</h2>
        <div className="text-sm text-muted-foreground mt-1">
          {judgment.facts.applicantAr || judgment.facts.applicant}
          {' '}<span className="text-muted-foreground/60">ضد</span>{' '}
          {judgment.facts.respondentAr || judgment.facts.respondent}
        </div>
      </div>

      {/* ── Reasons ───────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-primary rounded-full inline-block" />
          الأسباب
        </h3>
        <div className="bg-muted/30 rounded-lg p-4 border leading-loose text-sm whitespace-pre-wrap font-arabic">
          {judgment.reasons}
        </div>
      </section>

      {/* Theory content intentionally excluded from judgment view.
          It lives in the per-stage inline sections and the التحليل النظري tab.
          The judgment must contain only binding UAE legal analysis. */}

      {/* ── Holding ───────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-heading rounded-full inline-block" />
          خلاصة الحكم
        </h3>
        <div className="bg-heading/10 border border-heading/25 dark:border-heading/40 rounded-lg p-4 text-sm leading-loose font-arabic">
          {judgment.holding}
        </div>
      </section>

      {/* ── Operative Order ───────────────────────────────────────────────── */}
      <section>
        <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-heading rounded-full inline-block" />
          المنطوق
        </h3>
        <div className="bg-heading/10 border border-heading/25 dark:border-heading/40 rounded-lg p-4 space-y-3">
          <div className="text-sm leading-loose font-arabic whitespace-pre-wrap">{judgment.order}</div>
          {judgment.orderEn && (
            <div className="pt-3 border-t border-heading/25 dark:border-heading/40">
              <div className="text-xs text-muted-foreground mb-1" dir="ltr">English translation:</div>
              <div className="text-sm text-muted-foreground leading-relaxed" dir="ltr">{judgment.orderEn}</div>
            </div>
          )}
        </div>
      </section>

      {/* ── Authority Hierarchy ───────────────────────────────────────────── */}
      {judgment.authorityHierarchy.length > 0 && (
        <section>
          <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-heading rounded-full inline-block" />
            هرمية السلطات القانونية
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <AuthorityHierarchy authorities={judgment.authorityHierarchy} />
          </div>
        </section>
      )}
    </div>
  );
}
