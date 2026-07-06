import React from 'react';
import { CheckCircle2, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
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
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-sm font-medium bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            الاستشهادات موثَّقة ({verificationStatus.verifiedCount})
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-sm font-medium bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-full">
            <AlertTriangle className="w-4 h-4" />
            {verificationStatus.fabricatedCitationsFiltered} استشهاد(ات) غير موثَّق — تمَّ حذفه
          </div>
        )}

        {/* Legality score */}
        {legalityScore !== undefined && (
          <div className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border ${
            legalityScore >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
            : legalityScore >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
          }`}>
            <ShieldAlert className="w-4 h-4" />
            درجة المشروعية: {legalityScore}%
          </div>
        )}

        {/* Risk score */}
        {riskScore !== undefined && (
          <div className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border ${
            riskScore <= 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
            : riskScore <= 60 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
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

      {/* ── Theory disclaimer (if theory was applied) ─────────────────────── */}
      {judgment.theoryAnalysis.applied && (
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <strong>التحليل النظري غير المُلزِم — {judgment.theoryAnalysis.lensName}:</strong>
              <div className="mt-2 leading-relaxed whitespace-pre-wrap">{judgment.theoryAnalysis.analysisAr}</div>
              <div className="mt-3 text-xs opacity-80">{judgment.theoryAnalysis.disclaimer}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Holding ───────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-500 rounded-full inline-block" />
          خلاصة الحكم
        </h3>
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm leading-loose font-arabic">
          {judgment.holding}
        </div>
      </section>

      {/* ── Operative Order ───────────────────────────────────────────────── */}
      <section>
        <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block" />
          المنطوق
        </h3>
        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 space-y-3">
          <div className="text-sm leading-loose font-arabic whitespace-pre-wrap">{judgment.order}</div>
          {judgment.orderEn && (
            <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800">
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
            <span className="w-1 h-5 bg-purple-500 rounded-full inline-block" />
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
