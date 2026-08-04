/**
 * UpgradeGate — blocks premium features behind an elegant plan-upgrade CTA.
 *
 * Usage:
 *   <UpgradeGate feature="shamsi_framework" bypass={isOwner}>
 *     <PremiumContent />
 *   </UpgradeGate>
 *
 * When the user's plan is sufficient (or bypass=true), children render normally.
 * Otherwise an overlay card is shown with the required plan and upgrade CTA.
 */
import React from 'react';
import { useLocation } from 'wouter';
import { Lock, Sparkles, ArrowLeft } from 'lucide-react';
import {
  type GatedFeature,
  type PlanId,
  FEATURE_PLAN,
  planAtLeast,
  PLANS,
  requiredPlanNameAr,
} from '@/lib/plan-config';
import { useUserContext } from '@/lib/user-context';

interface UpgradeGateProps {
  feature: GatedFeature;
  /** When true, gate is bypassed regardless of plan (e.g. isOwner) */
  bypass?: boolean;
  /** Override the default blocking behaviour — just show a soft banner */
  soft?: boolean;
  children: React.ReactNode;
}

// ── Soft banner (non-blocking) ────────────────────────────────────────────────
function SoftBanner({ feature }: { feature: GatedFeature }) {
  const [, navigate] = useLocation();
  const requiredPlan = FEATURE_PLAN[feature];
  const plan = PLANS.find(p => p.id === requiredPlan);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 mb-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-gold shrink-0" />
        <span className="text-xs text-foreground/80">
          هذه الميزة تتطلب خطة <span className="font-semibold text-gold">{plan?.nameAr}</span> أو أعلى
        </span>
      </div>
      <button
        type="button"
        onClick={() => navigate('/pricing')}
        className="shrink-0 text-[11px] font-bold text-background bg-gold hover:opacity-90 px-3 py-1.5 rounded-lg transition-opacity"
      >
        ترقية
      </button>
    </div>
  );
}

// ── Full blocking gate ────────────────────────────────────────────────────────
function GateOverlay({ feature }: { feature: GatedFeature }) {
  const [, navigate] = useLocation();
  const requiredPlan = FEATURE_PLAN[feature];
  const plan = PLANS.find(p => p.id === requiredPlan);

  return (
    <div className="flex flex-col items-center justify-center min-h-[280px] rounded-2xl border border-gold/20 bg-muted/30 backdrop-blur-sm px-6 py-10 text-center gap-5">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center">
        <Lock className="w-7 h-7 text-gold" />
      </div>

      {/* Text */}
      <div className="space-y-2 max-w-xs">
        <p className="font-semibold text-foreground text-base">
          هذه الميزة متاحة بخطة {requiredPlanNameAr(feature)} فأعلى
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {plan?.id === 'enterprise'
            ? 'تواصل معنا للحصول على خطة مؤسسية مخصصة.'
            : `قم بالترقية إلى خطة ${plan?.nameAr} للوصول إلى هذه الميزة وغيرها من المزايا المتقدمة.`}
        </p>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={() => navigate('/pricing')}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-background text-sm font-bold hover:opacity-90 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          عرض خطط الاشتراك
        </button>
        <button
          type="button"
          onClick={() => navigate(-1 as never)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </button>
      </div>

      {/* Coming-soon note */}
      <p className="text-[11px] text-muted-foreground/50 max-w-xs">
        سيُفعَّل الاشتراك فور توفر بوابة الدفع · Apple Pay · Google Pay · بطاقة ائتمانية
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function UpgradeGate({ feature, bypass = false, soft = false, children }: UpgradeGateProps) {
  const { isOwner } = useUserContext();
  // Read plan from context — falls back to 'free' if not set
  const userPlan = (useUserContext() as { plan?: PlanId }).plan ?? 'free';

  // Owners always bypass plan gates (role-based access takes precedence)
  const canAccess = bypass || isOwner || planAtLeast(userPlan, FEATURE_PLAN[feature]);

  if (canAccess) return <>{children}</>;
  if (soft) return (
    <>
      <SoftBanner feature={feature} />
      {children}
    </>
  );
  return <GateOverlay feature={feature} />;
}

// ── Inline usage badge ────────────────────────────────────────────────────────
/** Small pill badge indicating a feature requires a specific plan */
export function PlanBadge({ plan }: { plan: PlanId }) {
  const p = PLANS.find(x => x.id === plan);
  const colorMap: Record<PlanId, string> = {
    free: 'bg-muted/50 text-muted-foreground border-border',
    professional: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    expert: 'bg-gold/10 text-gold border-gold/25',
    enterprise: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${colorMap[plan]}`}>
      <Lock className="w-2.5 h-2.5" />
      {p?.nameAr ?? plan}
    </span>
  );
}
