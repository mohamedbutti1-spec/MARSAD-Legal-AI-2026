import React from 'react';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useT } from '@/lib/user-context';
import { apiFetch } from '@/lib/api-fetch';

interface StaleCitationBannerProps {
  projectId: number;
  itemId: number;
  reason: string | null;
  onReviewed: () => void;
}

export function StaleCitationBanner({ projectId, itemId, reason, onReviewed }: StaleCitationBannerProps) {
  const t = useT();
  const [marking, setMarking] = React.useState(false);

  async function handleReview() {
    setMarking(true);
    try {
      const r = await apiFetch(`/api/research/workspace/projects/${projectId}/items/${itemId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (r.ok) onReviewed();
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 mb-4">
      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">
          {t('تحذير: مصادر الاستشهاد قد تكون قديمة', 'Citation sources may be outdated')}
        </p>
        {reason && (
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{reason}</p>
        )}
      </div>
      <button
        onClick={handleReview}
        disabled={marking}
        className="flex items-center gap-1.5 text-xs font-medium text-amber-700 border border-amber-400 rounded-md px-2.5 py-1 hover:bg-amber-100 transition-colors disabled:opacity-50"
      >
        {marking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
        {t('تم المراجعة', 'Mark Reviewed')}
      </button>
    </div>
  );
}
