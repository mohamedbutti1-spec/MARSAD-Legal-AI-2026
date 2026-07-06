import React, { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, Gavel, Users, Shield, CheckCircle2, XCircle,
  AlertCircle, Loader2, Scale, Bot, ChevronDown, ChevronRight,
  BookOpen, BarChart3, ScrollText, Award, Sparkles, User,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DISPUTE_TYPE_LABELS } from '@/types/jre';
import {
  PANEL_SIZE_CONFIG, DISPOSAL_POSITION_CONFIG, OPINION_TYPE_CONFIG, STATUS_CONFIG,
  type JdcChamber, type JudgeAnalysis, type PanelSize, type OpinionType,
} from '@/types/jdc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-AE', { year: 'numeric', month: 'long', day: 'numeric' });
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  const r = 28, circ = 2 * Math.PI * r;
  const fill = ((100 - score) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round" />
      </svg>
      <span className="text-lg font-bold -mt-[52px] z-10">{score}</span>
      <span className="text-xs text-muted-foreground mt-8">{label}</span>
    </div>
  );
}

function PanelIcon({ size }: { size: PanelSize }) {
  if (size === 1) return <User className="w-4 h-4" />;
  if (size === 3) return <Users className="w-4 h-4" />;
  return <Scale className="w-4 h-4" />;
}

// ─── Judge Card ───────────────────────────────────────────────────────────────

function JudgeCard({ judge, isMajority }: { judge: JudgeAnalysis; isMajority: boolean }) {
  const [open, setOpen] = useState(false);
  const dispConf    = DISPOSAL_POSITION_CONFIG[judge.disposalPosition];
  const opinConf    = judge.opinionType ? OPINION_TYPE_CONFIG[judge.opinionType] : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`border rounded-xl overflow-hidden transition-all ${
        isMajority ? 'border-primary/30' : 'border-border'
      }`}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 text-right hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                isMajority
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {judge.judgeId}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{judge.nameAr}</span>
                  {opinConf && (
                    <Badge className={`text-xs ${opinConf.color} border-0`}>{opinConf.labelAr}</Badge>
                  )}
                  <Badge className={`text-xs ${dispConf.color} border-0`}>
                    {dispConf.icon} {dispConf.labelAr}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{judge.holding}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-center">
                  <div className={`text-lg font-bold ${
                    judge.legalityAssessment.score >= 70 ? 'text-emerald-600' :
                    judge.legalityAssessment.score >= 40 ? 'text-amber-600' : 'text-red-600'
                  }`}>{judge.legalityAssessment.score}</div>
                  <div className="text-xs text-muted-foreground">مشروعية</div>
                </div>
                {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t p-4 space-y-4 bg-muted/10">
            {/* Jurisdiction */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">الاختصاص والقبول</h4>
              <div className="flex items-start gap-2">
                {judge.jurisdictionFinding.admissible
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                }
                <p className="text-sm text-foreground leading-relaxed">{judge.jurisdictionFinding.admissibilityGrounds}</p>
              </div>
            </div>

            {/* Legislation */}
            {judge.applicableLegislation?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">التشريعات المنطبقة</h4>
                <div className="space-y-1">
                  {judge.applicableLegislation.map((leg, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {leg.authorityClass === 'binding' ? 'مُلزِم' : 'مرجعي'}
                      </Badge>
                      <span>{leg.titleAr}</span>
                      {leg.ragTag && (
                        <span className="text-xs text-primary font-mono">{leg.ragTag}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Precedents */}
            {judge.precedents?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">السوابق القضائية</h4>
                <div className="space-y-1">
                  {judge.precedents.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {p.authorityClass === 'binding' ? 'مُلزِم' : 'مرجعي'}
                      </Badge>
                      <span className="font-mono text-xs">{p.caseRef}</span>
                      <span className="text-muted-foreground">{p.court} {p.year}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proportionality */}
            {judge.proportionality?.applicable && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">مراجعة التناسب</h4>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs border-0 ${
                    judge.proportionality.overallFinding === 'proportionate'
                      ? 'bg-emerald-100 text-emerald-700'
                      : judge.proportionality.overallFinding === 'disproportionate'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {judge.proportionality.overallFinding === 'proportionate' ? 'متناسب' :
                     judge.proportionality.overallFinding === 'disproportionate' ? 'غير متناسب' : 'لا ينطبق'}
                  </Badge>
                </div>
              </div>
            )}

            {/* AI Decision */}
            {(judge.aiDecisionAnalysis?.dimensions?.length ?? 0) > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Bot className="w-3 h-3" /> القرار الرقمي — الأبعاد السبعة
                </h4>
                <div className="grid grid-cols-2 gap-1">
                  {judge.aiDecisionAnalysis!.dimensions!.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      {d.compliant
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        : <XCircle className="w-3 h-3 text-red-500 shrink-0" />}
                      <span>{d.dimensionAr}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Theory note */}
            {judge.theoryNote && (
              <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> ملاحظة نظرية — غير مُلزِمة
                </p>
                <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                  {judge.theoryNote.slice(0, 300)}{judge.theoryNote.length > 300 ? '...' : ''}
                </p>
              </div>
            )}

            {/* Individual holding */}
            <div className="bg-muted/40 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-muted-foreground mb-1">منطوق القاضي الفردي</h4>
              <p className="text-sm text-foreground leading-relaxed">{judge.holding}</p>
              {judge.holdingEn && (
                <p className="text-xs text-muted-foreground mt-1 italic">{judge.holdingEn}</p>
              )}
            </div>

            {/* Reasons */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">الأسباب القانونية</h4>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{judge.reasons}</p>
            </div>

            {/* Verification */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {judge.verificationStatus.allAuthoritiesVerified
                ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                : <AlertCircle className="w-3 h-3 text-amber-500" />}
              {judge.verificationStatus.message}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Authority Hierarchy ──────────────────────────────────────────────────────

function AuthorityHierarchy({ hierarchy }: { hierarchy: import('@/types/jre').JreAuthorityEntry[] }) {
  const classOrder = ['binding', 'persuasive', 'non_binding'];
  const byClass = classOrder
    .map((cls) => ({
      cls,
      entries: hierarchy.filter((h) => h.authorityClass === cls),
    }))
    .filter((g) => g.entries.length > 0);

  const classLabels: Record<string, string> = {
    binding:     'مُلزِم — Binding',
    persuasive:  'مرجعي — Persuasive',
    non_binding: 'غير مُلزِم — Non-Binding',
  };
  const classColors: Record<string, string> = {
    binding:     'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400',
    persuasive:  'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
    non_binding: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <div className="space-y-4">
      {byClass.map(({ cls, entries }) => (
        <div key={cls}>
          <div className={`text-xs font-semibold px-2 py-1 rounded border inline-block mb-2 ${classColors[cls]}`}>
            {classLabels[cls]}
          </div>
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 border rounded-lg">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                  {entry.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{entry.titleAr}</span>
                    {entry.ragTag && (
                      <span className="text-xs text-primary font-mono">{entry.ragTag}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs">مستوى {entry.hierarchyLevel}</Badge>
                    <Badge variant="outline" className="text-xs">{entry.role}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Chamber Detail Page ─────────────────────────────────────────────────

export default function JdcChamberPage() {
  const params  = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(params.id ?? '', 10);

  const { data, isLoading, isError } = useQuery<JdcChamber>({
    queryKey: ['jdc-chamber', id],
    queryFn:  () => apiFetch(`/api/jdc/chambers/${id}`).then((r) => r.json()).then((d: { chamber: JdcChamber }) => d.chamber),
    enabled:  !isNaN(id),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">جارٍ تحميل ملف الدائرة...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
          <p className="text-muted-foreground">تعذَّر تحميل الدائرة القضائية</p>
          <Button variant="ghost" onClick={() => navigate('/jdc')} className="mt-3">
            <ArrowRight className="w-4 h-4 ml-2" /> العودة
          </Button>
        </div>
      </div>
    );
  }

  const chamber     = data;
  const del         = chamber.deliberation;
  const panelConf   = PANEL_SIZE_CONFIG[chamber.panelSize as PanelSize] ?? PANEL_SIZE_CONFIG[3];
  const stConf      = STATUS_CONFIG[chamber.status] ?? STATUS_CONFIG.deliberating;
  const dtConf      = DISPUTE_TYPE_LABELS[chamber.disputeType] ?? DISPUTE_TYPE_LABELS.other;

  const majorityPos = del?.majorityPosition;
  const dispConf    = majorityPos ? DISPOSAL_POSITION_CONFIG[majorityPos] : null;

  const majorityJudges   = del?.judges.filter((j: JudgeAnalysis) => j.opinionType === 'majority')   ?? [];
  const dissentingJudges = del?.judges.filter((j: JudgeAnalysis) => j.opinionType === 'dissenting') ?? [];
  const concurringJudges = del?.judges.filter((j: JudgeAnalysis) => j.opinionType === 'concurring') ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Back nav */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/jdc')} className="mb-4">
        <ArrowRight className="w-4 h-4 ml-2" />
        الدوائر القضائية
      </Button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <PanelIcon size={chamber.panelSize as PanelSize} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{chamber.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className={`text-xs ${stConf.color} border-0`}>
                {chamber.status === 'deliberating' && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                {stConf.labelAr}
              </Badge>
              <Badge className={`text-xs ${panelConf.color} border-0`}>{panelConf.labelAr}</Badge>
              <Badge className={`text-xs ${dtConf.color} border-0`}>{dtConf.ar}</Badge>
              {dispConf && (
                <Badge className={`text-xs ${dispConf.color} border-0 font-medium`}>
                  {dispConf.icon} {dispConf.labelAr}
                </Badge>
              )}
              {chamber.hasAiDecision === 'true' && (
                <Badge className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0">
                  <Bot className="w-3 h-3 ml-1" /> قرار رقمي
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 p-3 bg-muted/30 rounded-lg">
          <span><span className="font-medium text-foreground">المدعي:</span> {chamber.parties?.applicantAr || chamber.parties?.applicant || '—'}</span>
          <span className="text-border">|</span>
          <span><span className="font-medium text-foreground">المدعى عليه:</span> {chamber.parties?.respondentAr || chamber.parties?.respondent || '—'}</span>
          <span className="text-border">|</span>
          <span>{formatDate(chamber.createdAt)}</span>
        </div>
      </div>

      {/* Score strip */}
      {del && (del.legalityScore != null || del.riskScore != null) && (
        <div className="flex items-center justify-center gap-8 mb-6 p-4 border rounded-xl bg-card">
          {del.legalityScore != null && <ScoreRing score={del.legalityScore} label="درجة المشروعية" />}
          {del.riskScore != null && <ScoreRing score={del.riskScore} label="درجة المخاطر" />}
        </div>
      )}

      {del ? (
        <Tabs defaultValue="panel" dir="rtl">
          <TabsList className="w-full grid grid-cols-5 mb-6">
            <TabsTrigger value="panel" className="text-xs">
              <Users className="w-3 h-3 ml-1" /> الهيئة
            </TabsTrigger>
            <TabsTrigger value="majority" className="text-xs">
              <Award className="w-3 h-3 ml-1" /> رأي الأغلبية
            </TabsTrigger>
            <TabsTrigger value="opinions" className="text-xs" disabled={!del.dissentingOpinionAr && !del.concurringOpinionAr}>
              <ScrollText className="w-3 h-3 ml-1" /> آراء أخرى
            </TabsTrigger>
            <TabsTrigger value="holding" className="text-xs">
              <Gavel className="w-3 h-3 ml-1" /> الحكم
            </TabsTrigger>
            <TabsTrigger value="authorities" className="text-xs">
              <BookOpen className="w-3 h-3 ml-1" /> السلطات
            </TabsTrigger>
          </TabsList>

          {/* ── Panel Tab ─────────────────────────────────────────────────────── */}
          <TabsContent value="panel" className="space-y-3">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'الأغلبية', count: majorityJudges.length, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                { label: 'المعارضون', count: dissentingJudges.length, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10' },
                { label: 'الموافقون بأسباب مختلفة', count: concurringJudges.length, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
              ].map((item) => (
                <div key={item.label} className={`${item.bg} rounded-lg p-3 text-center`}>
                  <div className={`text-2xl font-bold ${item.color}`}>{item.count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
            {del.judges.map((judge: JudgeAnalysis) => (
              <JudgeCard
                key={judge.judgeId}
                judge={judge}
                isMajority={del.majorityJudgeIds.includes(judge.judgeId)}
              />
            ))}
          </TabsContent>

          {/* ── Majority Opinion Tab ───────────────────────────────────────────── */}
          <TabsContent value="majority" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-lg">رأي الأغلبية</h2>
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                {majorityJudges.map((j: JudgeAnalysis) => j.nameAr).join(' • ')}
              </Badge>
            </div>

            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">موقف الأغلبية</h3>
              <p className="text-foreground leading-relaxed">{del.majorityOpinionAr}</p>
              {del.majorityOpinionEn && (
                <p className="text-sm text-muted-foreground italic mt-2" dir="ltr">{del.majorityOpinionEn}</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <ScrollText className="w-4 h-4" /> أسباب الأغلبية القانونية
              </h3>
              <div className="prose prose-sm max-w-none text-foreground leading-loose whitespace-pre-line">
                {del.majorityReasonsAr}
              </div>
              {del.majorityReasonsEn && (
                <div className="mt-4 p-3 bg-muted/30 rounded-lg border">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">English Summary</p>
                  <p className="text-sm text-foreground italic leading-relaxed" dir="ltr">{del.majorityReasonsEn}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Other Opinions Tab ────────────────────────────────────────────── */}
          <TabsContent value="opinions" className="space-y-6">
            {del.dissentingOpinionAr && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <h2 className="font-semibold">الرأي المخالف</h2>
                  <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                    {dissentingJudges.map((j) => j.nameAr).join(' • ')}
                  </Badge>
                </div>
                <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-5">
                  <p className="text-foreground leading-relaxed whitespace-pre-line">{del.dissentingOpinionAr}</p>
                  {del.dissentingOpinionEn && (
                    <p className="text-sm text-muted-foreground italic mt-3" dir="ltr">{del.dissentingOpinionEn}</p>
                  )}
                </div>
              </div>
            )}

            {del.concurringOpinionAr && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-500" />
                  <h2 className="font-semibold">الرأي الموافق (بأسباب مختلفة)</h2>
                  <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                    {concurringJudges.map((j) => j.nameAr).join(' • ')}
                  </Badge>
                </div>
                <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
                  <p className="text-foreground leading-relaxed whitespace-pre-line">{del.concurringOpinionAr}</p>
                  {del.concurringOpinionEn && (
                    <p className="text-sm text-muted-foreground italic mt-3" dir="ltr">{del.concurringOpinionEn}</p>
                  )}
                </div>
              </div>
            )}

            {!del.dissentingOpinionAr && !del.concurringOpinionAr && (
              <div className="text-center py-10 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
                <p>إجماع الهيئة — لا توجد آراء مخالفة أو موافقة بأسباب مختلفة</p>
              </div>
            )}
          </TabsContent>

          {/* ── Final Holding Tab ─────────────────────────────────────────────── */}
          <TabsContent value="holding" className="space-y-5">
            {/* Final holding */}
            <div className="border-2 border-primary/20 rounded-xl p-5 bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <Gavel className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-lg">الحكم النهائي للدائرة</h2>
                {dispConf && (
                  <Badge className={`${dispConf.color} border-0 text-sm`}>
                    {dispConf.icon} {dispConf.labelAr}
                  </Badge>
                )}
              </div>
              <p className="text-foreground text-base leading-loose font-medium">{del.finalHoldingAr}</p>
              {del.finalHoldingEn && (
                <p className="text-sm text-muted-foreground italic mt-2" dir="ltr">{del.finalHoldingEn}</p>
              )}
            </div>

            {/* Operative order */}
            <div className="border-2 border-amber-200 dark:border-amber-800 rounded-xl p-5 bg-amber-50/50 dark:bg-amber-900/10">
              <div className="flex items-center gap-2 mb-3">
                <Scale className="w-5 h-5 text-amber-600" />
                <h2 className="font-semibold text-lg text-amber-800 dark:text-amber-300">منطوق الحكم</h2>
              </div>
              <p className="text-foreground text-base leading-loose whitespace-pre-line font-medium">{del.operativeOrderAr}</p>
              {del.operativeOrderEn && (
                <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-700">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Operative Order (English)</p>
                  <p className="text-sm text-foreground italic leading-relaxed" dir="ltr">{del.operativeOrderEn}</p>
                </div>
              )}
            </div>

            {/* Vote breakdown */}
            <div className="border rounded-xl p-4 bg-card">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> نتيجة التصويت
              </h3>
              <div className="space-y-2">
                {del.judges.map((j: JudgeAnalysis) => {
                  const opConf = j.opinionType ? OPINION_TYPE_CONFIG[j.opinionType as OpinionType] : null;
                  const dp     = DISPOSAL_POSITION_CONFIG[j.disposalPosition as import('@/types/jdc').DisposalPosition];
                  return (
                    <div key={j.judgeId} className="flex items-center gap-3 text-sm">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        del.majorityJudgeIds.includes(j.judgeId)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}>{j.judgeId}</div>
                      <span className="flex-1 font-medium">{j.nameAr}</span>
                      {opConf && <Badge className={`text-xs ${opConf.color} border-0`}>{opConf.labelAr}</Badge>}
                      <Badge className={`text-xs ${dp.color} border-0`}>{dp.icon} {dp.labelAr}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ── Authorities Tab ───────────────────────────────────────────────── */}
          <TabsContent value="authorities" className="space-y-5">
            {/* Authority hierarchy */}
            {del.authorityHierarchy?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> هرمية السلطات القانونية
                </h3>
                <AuthorityHierarchy hierarchy={del.authorityHierarchy} />
              </div>
            )}

            {/* Verification report */}
            <div className="border rounded-xl p-4 bg-card">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" /> تقرير التحقق من المصادر
              </h3>
              <div className="flex items-center gap-2 mb-3">
                {del.verificationReport.allAuthoritiesVerified
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  : <AlertCircle className="w-5 h-5 text-amber-500" />}
                <p className="text-sm text-foreground">{del.verificationReport.overallMessage}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center">
                  <div className="text-xl font-bold text-emerald-600">{del.verificationReport.totalVerified}</div>
                  <div className="text-xs text-muted-foreground">استشهاد موثَّق</div>
                </div>
                <div className={`rounded-lg p-2 text-center ${
                  del.verificationReport.totalFabricated > 0
                    ? 'bg-red-50 dark:bg-red-900/20'
                    : 'bg-muted/30'
                }`}>
                  <div className={`text-xl font-bold ${del.verificationReport.totalFabricated > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {del.verificationReport.totalFabricated}
                  </div>
                  <div className="text-xs text-muted-foreground">تمَّ حذفه</div>
                </div>
              </div>
              {del.verificationReport.perJudge?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">تفصيل لكل قاضٍ:</p>
                  <div className="space-y-1">
                    {del.verificationReport.perJudge.map((pj: { judgeId: number; verified: number; fabricated: number }) => {
                      const judge = del.judges.find((j: JudgeAnalysis) => j.judgeId === pj.judgeId);
                      return (
                        <div key={pj.judgeId} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{judge?.nameAr ?? `قاضٍ ${pj.judgeId}`}:</span>
                          <span className="text-emerald-600">{pj.verified} موثَّق</span>
                          {pj.fabricated > 0 && <span className="text-red-500">{pj.fabricated} محذوف</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          {chamber.status === 'deliberating' ? (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-3" />
              <p className="font-medium">جارٍ التداول بين القضاة...</p>
              <p className="text-sm text-muted-foreground mt-1">يُحلِّل كل قاضٍ القضية باستقلالية تامة</p>
            </>
          ) : (
            <>
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
              <p className="font-medium text-destructive">فشلت المداولة</p>
              <Button variant="outline" className="mt-3" onClick={() => navigate('/jdc')}>العودة</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
